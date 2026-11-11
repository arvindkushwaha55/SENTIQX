import { describe, expect, it } from "vitest";
import { dictionaries } from "../i18n";
import { prepareForAi, validateAi } from "./ai";
import { applyFix, fingerprint, lineDiff } from "./diff";
import { diagnosticsToFindings, maskCode, runRules } from "./rules";
import type { EditorContext } from "./types";

const ids = (code: string, lang = "typescript") => runRules(code, lang, 1).map((f) => f.ruleId);

describe("rules on genuinely buggy code", () => {
  const cases: [string, string, string][] = [
    ["assign-in-condition", "typescript", "if (user = admin) { go(); }"],
    ["assign-in-condition", "javascript", "while (done = check(x)) { step(); }"],
    ["nan-compare", "javascript", "if (value === NaN) return;"],
    ["nan-compare", "typescript", "const bad = total != NaN;"],
    ["self-compare", "javascript", "if (a.b === a.b) run();"],
    ["loop-off-by-one", "typescript", "for (let i = 0; i <= items.length; i++) { use(items[i]); }"],
    ["index-at-length", "javascript", "return items[items.length];"],
    ["async-foreach", "typescript", "list.forEach(async (x) => { await save(x); });"],
    ["empty-catch", "javascript", "try { run(); } catch (e) {}"],
    ["eval", "javascript", "const r = eval(input);"],
    ["hardcoded-secret", "typescript", 'const password = "hunter22";'],
    ["py-mutable-default", "python", "def add(x, items=[]):"],
    ["py-bare-except", "python", "except:"],
    ["py-none-compare", "python", "if x == None:"],
    ["py-eval", "python", "result = eval(text)"],
  ];
  it.each(cases)("%s in %s: %s", (id, lang, code) => {
    expect(ids(code, lang)).toContain(id);
  });
});

describe("rules on valid code: no false positives", () => {
  const valid: [string, string][] = [
    ["typescript", "if (user === admin) { go(); }"],
    ["typescript", "if ((match = re.exec(text))) { use(match); }"],
    ["typescript", "while ((node = node.next)) { visit(node); }"],
    ["typescript", "const arrow = (a = 1) => a;"],
    ["typescript", "if (x => x) {}"],
    ["javascript", "if (Number.isNaN(value)) return;"],
    ["javascript", "if (x.a === a) run();"],
    ["javascript", "if (a === ab) run();"],
    ["javascript", "for (let i = 0; i < items.length; i++) { use(items[i]); }"],
    ["javascript", "for (let i = 1; i <= items.length; i++) { use(items[i - 1]); }"],
    ["javascript", "items[items.length] = next;"],
    ["javascript", "return items[items.length - 1];"],
    ["javascript", "await Promise.all(list.map(async (x) => save(x)));"],
    ["javascript", "try { run(); } catch (e) { log(e); }"],
    ["javascript", "myeval(input); obj.eval(input);"],
    ["typescript", "const password = process.env.PASSWORD;"],
    ["typescript", 'const password = "";'],
    ["typescript", 'const label = "if (a = b) and x === NaN and eval(y)";'],
    ["typescript", "// if (a = b) eval(x) items[items.length]"],
    ["typescript", "/* for (let i = 0; i <= a.length; i++) */ run();"],
    ["typescript", "const s = `eval(x) ${name}`;"],
    ["python", "def add(x, items=None):"],
    ["python", "except ValueError:"],
    ["python", "if x is None:"],
    ["python", 'text = "x == None and eval(y)"'],
    ["python", "# if x == None: eval(y)"],
    ["python", "literal_eval(text)"],
  ];
  it.each(valid)("%s: %s", (lang, code) => {
    expect(ids(code, lang)).toEqual([]);
  });

  it("does not run on languages it has no rules for", () => {
    expect(ids("if (a = b) eval(x)", "rust")).toEqual([]);
  });

  it("is not fooled by a comment block spanning lines", () => {
    expect(ids("/*\n if (a = b) {}\n*/\nrun();")).toEqual([]);
    expect(ids('"""\neval(x)\n"""\nrun()', "python")).toEqual([]);
  });
});

describe("rule details", () => {
  it("reports the real line number", () => {
    const f = runRules("ok();\nif (x === NaN) {}", "javascript", 40);
    expect(f[0].line).toBe(41);
    expect(f[0].evidence).toBe("x === NaN");
  });

  it("offers correct mechanical fixes", () => {
    const fix = (code: string, lang = "javascript") => {
      const f = runRules(code, lang, 1)[0];
      return applyFix(code, f.find as string, f.replace as string);
    };
    expect(fix("if (x === NaN) {}")).toBe("if (Number.isNaN(x)) {}");
    expect(fix("if (x !== NaN) {}")).toBe("if (!Number.isNaN(x)) {}");
    expect(fix("for (let i = 0; i <= a.length; i++) {}")).toBe("for (let i = 0; i < a.length; i++) {}");
    expect(fix("return a[a.length];")).toBe("return a[a.length - 1];");
    expect(fix("if (a = b) {}")).toBe("if (a === b) {}");
    expect(fix("if x != None:", "python")).toBe("if x is not None:");
    expect(fix("except:", "python")).toBe("except Exception:");
  });

  it("offers no fix when the same text appears twice", () => {
    const f = runRules("if (x === NaN) {}\nif (x === NaN) {}", "javascript", 1);
    expect(f).toHaveLength(2);
    expect(f[0].find).toBeUndefined();
  });

  it("never shows a detected secret", () => {
    const f = runRules('const apiKey = "sk-abcdef123";', "typescript", 1)[0];
    expect(f.evidence).toBe("[hidden]");
    expect(JSON.stringify(f)).not.toContain("abcdef");
  });

  it("keeps character positions when masking", () => {
    const line = 'const a = "x"; // note';
    expect(maskCode(line, "js")[0]).toHaveLength(line.length);
  });
});

describe("validateAi", () => {
  const code = "function f(items) {\n  return items[items.length];\n}";
  const good = {
    line: 11,
    evidence: "return items[items.length];",
    title: "T",
    why: "W",
    how: "H",
    sideEffects: "S",
    confidence: "high",
    find: "items[items.length]",
    replace: "items[items.length - 1]",
  };

  it("keeps a finding whose quote is really on that line", () => {
    const r = validateAi({ findings: [good] }, code, 10);
    expect(r.dropped).toBe(0);
    expect(r.findings[0]).toMatchObject({ source: "ai", line: 11, confidence: "high", find: "items[items.length]" });
  });

  it("drops invented bugs: wrong line, invented quote, missing text", () => {
    const r = validateAi(
      {
        findings: [
          { ...good, line: 10 },
          { ...good, line: 999 },
          { ...good, evidence: "db.query(userInput)" },
          { ...good, evidence: "" },
          { ...good, title: "" },
          { ...good, line: "11" },
          null,
        ],
      },
      code,
      10,
    );
    expect(r.findings).toHaveLength(0);
    expect(r.dropped).toBe(7);
  });

  it("keeps the finding but removes a fix that does not match exactly once", () => {
    for (const find of ["not in the code", "items", ""]) {
      const r = validateAi({ findings: [{ ...good, find }] }, code, 10);
      expect(r.findings[0].find).toBeUndefined();
      expect(r.findings[0].replace).toBeUndefined();
    }
    expect(validateAi({ findings: [{ ...good, find: "return", replace: "return" }] }, code, 10).findings[0].find).toBeUndefined();
  });

  it("treats an unknown confidence as low and bad answers as nothing", () => {
    expect(validateAi({ findings: [{ ...good, confidence: "certain" }] }, code, 10).findings[0].confidence).toBe("low");
    expect(validateAi(null, code, 10).findings).toEqual([]);
    expect(validateAi({ findings: "x" }, code, 10).findings).toEqual([]);
  });

  it("hides secrets before anything is sent", () => {
    const p = prepareForAi('const k = "x";\nconst password = hunter2;\n');
    expect(p.code).not.toContain("hunter2");
    expect(p.hidden).toBeGreaterThan(0);
    expect(p.code.split("\n")).toHaveLength(3);
  });
});

describe("diagnostics", () => {
  const ctx: EditorContext = {
    file: "a.ts", uri: "file:///a.ts", language: "typescript", version: 1, startLine: 5, endLine: 6,
    code: "let a = 1;\nlet b: string = 2;", trigger: "selection",
    diagnostics: [
      { line: 6, message: "Type 'number' is not assignable to type 'string'.", severity: "error", source: "ts" },
      { line: 5, message: "hint", severity: "hint" },
    ],
  };
  it("are labelled as reported by a tool, keep their message and skip hints", () => {
    const f = diagnosticsToFindings(ctx);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ source: "diagnostic", confidence: "reported", line: 6, evidence: "let b: string = 2;" });
    expect(f[0].title).toContain("not assignable");
  });
});

describe("diff helpers", () => {
  it("applies only an unambiguous fix", () => {
    expect(applyFix("a b", "a", "x")).toBe("x b");
    expect(applyFix("a a", "a", "x")).toBeNull();
    expect(applyFix("a", "z", "x")).toBeNull();
    expect(applyFix("a", "", "x")).toBeNull();
  });
  it("shows only what changed, with context", () => {
    expect(lineDiff("one\ntwo\nthree", "one\n2\nthree")).toEqual([
      { kind: "same", text: "one" },
      { kind: "del", text: "two" },
      { kind: "add", text: "2" },
      { kind: "same", text: "three" },
    ]);
  });
  it("fingerprints without containing the code", () => {
    expect(fingerprint("a.ts", "r", "secret code")).not.toContain("secret");
    expect(fingerprint("a.ts", "r", "x")).toBe(fingerprint("a.ts", "r", "x"));
    expect(fingerprint("a.ts", "r", "x")).not.toBe(fingerprint("a.ts", "r", "y"));
  });
});

describe("both languages have text for every rule", () => {
  const ruleIds = [
    "assign-in-condition", "nan-compare", "self-compare", "loop-off-by-one", "index-at-length", "async-foreach",
    "empty-catch", "eval", "hardcoded-secret", "py-mutable-default", "py-bare-except", "py-none-compare", "py-eval",
  ];
  it.each(ruleIds)("%s", (id) => {
    for (const d of [dictionaries.en, dictionaries.hinglish]) {
      expect(d.debug.rules[id]?.title).toBeTruthy();
      expect(d.debug.rules[id]?.why).toBeTruthy();
      expect(d.debug.rules[id]?.how).toBeTruthy();
    }
    expect(dictionaries.en.debug.rules[id].why).not.toBe(dictionaries.hinglish.debug.rules[id].why);
  });
});
