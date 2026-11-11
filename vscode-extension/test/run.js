// Runs inside a real VS Code test host, with a temporary profile and folder.
// It exercises the real extension against the real SENTIQX app, which a driver script clicks.
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

const DIR = process.env.SENTIQX_TEST_DIR;
const OUT = path.join(DIR, "result.jsonl");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (o) => fs.appendFileSync(OUT, JSON.stringify(o) + "\n");

async function waitFor(check, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return true;
    await sleep(200);
  }
  return false;
}

exports.run = async function run() {
  const ext = vscode.extensions.getExtension("sentiqx.sentiqx-vscode");
  const api = await ext.activate();
  const file = path.join(DIR, "buggy.ts");
  const doc = await vscode.workspace.openTextDocument(file);
  const editor = await vscode.window.showTextDocument(doc);
  log({ step: "opened", language: doc.languageId });

  // 1. Nothing selected: refuses and sends nothing.
  editor.selection = new vscode.Selection(0, 0, 0, 0);
  await vscode.commands.executeCommand("sentiqx.analyseSelection");
  log({ step: "no-selection", sends: api.sends() });

  // 2. Selected, but permission refused: sends nothing.
  editor.selection = new vscode.Selection(0, 0, doc.lineCount - 1, 0);
  let asks = 0;
  api.setAsk(async () => {
    asks++;
    return undefined;
  });
  await vscode.commands.executeCommand("sentiqx.analyseSelection");
  log({ step: "permission-refused", asks, sends: api.sends() });

  // 3. Real diagnostics from VS Code's TypeScript server.
  await waitFor(() => vscode.languages.getDiagnostics(doc.uri).length > 0, 40000);
  log({
    step: "diagnostics",
    list: vscode.languages.getDiagnostics(doc.uri).map((d) => ({ line: d.range.start.line + 1, source: d.source, message: d.message.slice(0, 70) })),
  });

  // 4. Permission allowed: sends once, and does not ask again next time.
  api.setAsk(async (_, allow) => {
    asks++;
    return allow;
  });
  let answers = 0;
  api.setConfirm(async (_, action) => {
    answers++;
    const previewOpen = vscode.window.tabGroups.all.some((g) => g.tabs.some((t) => t.label.startsWith("SENTIQX fix")));
    // The first request is declined, the second applied.
    log({ step: "apply-question", number: answers, previewOpen, textUnchanged: doc.getText() === before });
    return answers === 1 ? undefined : action;
  });
  const before = doc.getText();
  await vscode.commands.executeCommand("sentiqx.analyseSelection");
  log({ step: "sent", sends: api.sends(), asks });

  // 5. The driver clicks Apply in SENTIQX twice: the first is declined here, the second applied.
  await waitFor(() => answers >= 1, 120000);
  await sleep(500);
  log({ step: "after-decline", textUnchanged: doc.getText() === before });

  const changed = await waitFor(() => doc.getText() !== before, 120000);
  const onDisk = fs.readFileSync(file, "utf8");
  log({ step: "after-apply", changed, text: doc.getText(), unsaved: doc.isDirty, diskUnchanged: onDisk === before });

  // 6. Undo works.
  await vscode.window.showTextDocument(doc);
  await vscode.commands.executeCommand("undo");
  await sleep(300);
  log({ step: "undo", restored: doc.getText() === before });

  // 7. A stale fix is refused: analyse, change the file, then the driver tries to apply.
  await vscode.commands.executeCommand("sentiqx.analyseSelection");
  await sleep(500);
  const edit = new vscode.WorkspaceEdit();
  edit.insert(doc.uri, new vscode.Position(doc.lineCount - 1, 0), "// edited after analysis\n");
  await vscode.workspace.applyEdit(edit);
  const edited = doc.getText();
  const questionsBefore = answers;
  fs.writeFileSync(path.join(DIR, "stale-ready"), "1");
  await waitFor(() => fs.existsSync(path.join(DIR, "stale-clicked")), 90000);
  await sleep(500);
  log({ step: "stale", textUnchanged: doc.getText() === edited, noQuestionAsked: answers === questionsBefore });
  await vscode.commands.executeCommand("undo");

  // 8. Automatic suggestions: off by default, on after the toggle, one send per error.
  await vscode.workspace.getConfiguration("sentiqx").update("autoSuggestions", false, vscode.ConfigurationTarget.Global);
  const s0 = api.sends();
  await doc.save();
  await sleep(2500);
  log({ step: "auto-off", sendsAdded: api.sends() - s0 });

  await vscode.workspace.getConfiguration("sentiqx").update("autoSuggestions", true, vscode.ConfigurationTarget.Global);
  const s1 = api.sends();
  await doc.save();
  await sleep(2500);
  const firstSave = api.sends() - s1;
  await doc.save();
  await sleep(2500);
  log({ step: "auto-on", firstSaveSends: firstSave, secondSaveSends: api.sends() - s1 - firstSave });
  log({ step: "finished" });
};
