// Connects VS Code to the SENTIQX desktop app on this computer, using only documented VS Code APIs.
// - Code is sent only after the user allows it, and only to 127.0.0.1.
// - A fix is applied only after a diff preview and an explicit "Apply" here in VS Code.
// - Files are never saved by this extension.
const vscode = require("vscode");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 47821;
const MAX_CHARS = 20000;
const POLL_MS = 1500;
const POLL_FOR_MS = 15 * 60 * 1000;
const AUTO_CONTEXT_LINES = 4;
const SCHEME = "sentiqx-fix";

const tokenPath = () => path.join(process.env.APPDATA || "", "com.sentiqx.app", "editor-token");

function readToken() {
  try {
    return fs.readFileSync(tokenPath(), "utf8").trim() || null;
  } catch {
    return null;
  }
}

function request(method, route, body) {
  return new Promise((resolve) => {
    const token = readToken();
    if (!token) return resolve({ status: 0, body: "" });
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request(
      {
        host: "127.0.0.1",
        port: PORT,
        path: route,
        method,
        timeout: 3000,
        headers: { "X-Sentiqx-Token": token, "Content-Type": "application/json", ...(data ? { "Content-Length": data.length } : {}) },
      },
      (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => resolve({ status: res.statusCode, body: text }));
      },
    );
    req.on("error", () => resolve({ status: 0, body: "" }));
    req.on("timeout", () => req.destroy());
    if (data) req.write(data);
    req.end();
  });
}

const severityName = (s) => ["error", "warning", "info", "hint"][s] ?? "info";

function diagnosticsIn(uri, range) {
  return vscode.languages
    .getDiagnostics(uri)
    .filter((d) => d.severity <= vscode.DiagnosticSeverity.Warning && d.range.intersection(range))
    .map((d) => ({
      line: d.range.start.line + 1,
      message: d.message,
      severity: severityName(d.severity),
      source: d.source ?? null,
      code: d.code === undefined ? null : String(typeof d.code === "object" ? d.code.value : d.code),
    }));
}

function activate(context) {
  // uri -> the range that was last sent. A fix may only touch that range.
  const sentRanges = new Map();
  const announced = new Set();
  const previews = new Map();
  let confirm = (message, action) => vscode.window.showWarningMessage(message, { modal: true }, action);
  let ask = (message, action) => vscode.window.showInformationMessage(message, { modal: true }, action);
  let sends = 0;
  let pollUntil = 0;
  let timer = null;

  const provider = { provideTextDocumentContent: (uri) => previews.get(uri.toString()) ?? "" };
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider));

  async function allowed() {
    if (context.globalState.get("consent")) return true;
    const allow = "Allow";
    const choice = await ask(
      "Allow SENTIQX to read code you choose? The code goes only to the SENTIQX app on this computer. It is not saved, and it leaves this computer only if you click AI review in SENTIQX.",
      allow,
    );
    if (choice !== allow) return false;
    await context.globalState.update("consent", true);
    return true;
  }

  async function applyFix(req) {
    const result = (status) => request("POST", "/editor/result", { id: req.id, status });
    let doc;
    try {
      doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(req.uri));
    } catch {
      return result("not_found");
    }
    if (doc.version !== req.version) return result("stale");
    const range = sentRanges.get(req.uri);
    if (!range) return result("not_found");
    const selected = doc.getText(range);
    if (selected.split(req.find).length !== 2) return result("not_found");

    const start = doc.offsetAt(range.start) + selected.indexOf(req.find);
    const target = new vscode.Range(doc.positionAt(start), doc.positionAt(start + req.find.length));
    const proposed = doc.getText().slice(0, start) + req.replace + doc.getText().slice(start + req.find.length);

    const previewUri = vscode.Uri.from({ scheme: SCHEME, path: `/${path.basename(doc.fileName)}`, query: req.id });
    previews.set(previewUri.toString(), proposed);
    await vscode.commands.executeCommand("vscode.diff", doc.uri, previewUri, `SENTIQX fix: ${path.basename(doc.fileName)}`, { preview: true });

    const apply = "Apply";
    const choice = await confirm("Apply this SENTIQX fix? It has not been run or tested. The file will not be saved, and you can undo it.", apply);
    previews.delete(previewUri.toString());
    if (choice !== apply) return result("declined");
    if (doc.version !== req.version) return result("stale");

    const edit = new vscode.WorkspaceEdit();
    edit.replace(doc.uri, target, req.replace);
    const ok = await vscode.workspace.applyEdit(edit);
    return result(ok ? "applied" : "stale");
  }

  function startPolling() {
    pollUntil = Date.now() + POLL_FOR_MS;
    if (timer) return;
    timer = setInterval(async () => {
      if (Date.now() > pollUntil) {
        clearInterval(timer);
        timer = null;
        return;
      }
      const res = await request("GET", "/editor/pending");
      if (res.status === 200 && res.body) {
        try {
          await applyFix(JSON.parse(res.body));
        } catch {
          /* a bad message must not stop the extension */
        }
      }
    }, POLL_MS);
  }

  async function send(doc, range, trigger) {
    const payload = {
      file: path.basename(doc.fileName),
      uri: doc.uri.toString(),
      language: doc.languageId,
      version: doc.version,
      startLine: range.start.line + 1,
      endLine: range.end.line + 1,
      code: doc.getText(range),
      trigger,
      diagnostics: diagnosticsIn(doc.uri, range),
    };
    const res = await request("POST", "/editor/context", payload);
    sends++;
    if (res.status === 200) {
      sentRanges.set(payload.uri, range);
      startPolling();
    }
    return res.status;
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("sentiqx.analyseSelection", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showInformationMessage("SENTIQX: select some code first.");
        return;
      }
      if (editor.document.getText(editor.selection).length > MAX_CHARS) {
        vscode.window.showWarningMessage(`SENTIQX: select less code (up to ${MAX_CHARS} characters).`);
        return;
      }
      if (!(await allowed())) return;
      const status = await send(editor.document, new vscode.Range(editor.selection.start, editor.selection.end), "selection");
      if (status === 0) vscode.window.showWarningMessage("SENTIQX: could not reach the app. Is SENTIQX open?");
      else if (status !== 200) vscode.window.showWarningMessage("SENTIQX could not read that selection.");
      else vscode.window.setStatusBarMessage("SENTIQX: sent to the Debug tab", 3000);
    }),

    vscode.commands.registerCommand("sentiqx.toggleAuto", async () => {
      const config = vscode.workspace.getConfiguration("sentiqx");
      const next = !config.get("autoSuggestions");
      if (next && !(await allowed())) return;
      await config.update("autoSuggestions", next, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`SENTIQX automatic suggestions are ${next ? "on" : "off"}.`);
    }),

    vscode.commands.registerCommand("sentiqx.resetPermission", async () => {
      await context.globalState.update("consent", undefined);
      vscode.window.showInformationMessage("SENTIQX will ask for permission again.");
    }),

    // Automatic suggestions: only after a save, only for a real error, and only once per error.
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (!vscode.workspace.getConfiguration("sentiqx").get("autoSuggestions")) return;
      if (!context.globalState.get("consent")) return;
      setTimeout(async () => {
        const first = vscode.languages
          .getDiagnostics(doc.uri)
          .find((d) => d.severity === vscode.DiagnosticSeverity.Error && !announced.has(`${doc.uri}|${d.message}`));
        if (!first) return;
        announced.add(`${doc.uri}|${first.message}`);
        const from = Math.max(0, first.range.start.line - AUTO_CONTEXT_LINES);
        const to = Math.min(doc.lineCount - 1, first.range.end.line + AUTO_CONTEXT_LINES);
        await send(doc, new vscode.Range(from, 0, to, doc.lineAt(to).text.length), "auto");
      }, 1500);
    }),

    { dispose: () => timer && clearInterval(timer) },
  );

  // Only automated tests may answer these questions, and only inside a test host.
  if (context.extensionMode === vscode.ExtensionMode.Test) {
    return { setConfirm: (fn) => (confirm = fn), setAsk: (fn) => (ask = fn), sends: () => sends };
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
