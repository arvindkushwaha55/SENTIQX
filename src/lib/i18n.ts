import type { Language, Status, ToolKind } from "./types";

export interface ApiErrorText {
  what: string;
  meaning: string;
  action: string | null; // null = nothing for the user to do
}

export interface SummaryFacts {
  messages: number;
  people: string[];
  from: string | null;
  to: string | null;
  questions: number;
  actions: number;
  dates: number;
  pending: number | null;
}

/** One shape for both languages: TypeScript fails the build if either side misses a key. */
export interface Dict {
  tagline: string;
  status: Record<Status, string>;
  statusNone: string;
  monitorBadge: { off: string; on: string; paused: string };
  nav: { home: string; live: string; debug: string; intel: string; history: string; settings: string; back: string };
  home: {
    greeting: { morning: string; afternoon: string; evening: string; night: string };
    working: (app: string) => string;
    using: (app: string) => string;
    detecting: string;
    categories: Record<"coding" | "browser" | "terminal" | "communication" | "other", string>;
    stages: { detected: string; context: string; understood: string; unsupported: string };
    context: {
      waitingSource: (app: string) => string;
      connected: (app: string) => string;
      understood: (app: string) => string;
      browser: (app: string) => string;
      communication: (app: string) => string;
      other: (app: string) => string;
    };
    hints: { connect: string; preview: string; paste: string };
    titleHidden: string;
    awarenessOn: string;
    pause: string;
    permission: { title: string; body: string; points: string[]; allow: string; notNow: string };
    off: { title: string; body: string; turnOn: string };
    failed: string;
    summaryTitle: string;
    claudeNotConnected: string;
    recentTitle: string;
    recentEmpty: string;
    quickTitle: string;
    quick: { claude: string; intel: string; preview: string; settings: string };
  };
  controls: { start: string; pause: string; resume: string; stop: string };
  connectorNotReady: string;
  startFailed: (reason: string) => string;
  noEventsHint: string;
  pausedNote: string;
  demoBanner: string;
  win: {
    pin: string;
    unpin: string;
    hide: string;
    close: string;
    pinFailed: string;
    pinnedState: string;
    unpinnedState: string;
  };
  time: {
    justNow: string;
    secondsAgo: (n: number) => string;
    minutesAgo: (n: number) => string;
    hoursAgo: (n: number) => string;
  };
  hero: { session: string; noSession: string; lastEvent: string; noEvents: string };
  consent: {
    title: string;
    intro: string;
    monitored: string[];
    notMonitored: string[];
    changes: string;
    local: string;
    external: string;
    allow: string;
    cancel: string;
  };
  labels: { now: string; done: string; next: string };
  line1: {
    off: string;
    paused: string;
    none: string;
    working: (action: string | null) => string;
    waiting: (tool: string) => string;
    stuck: (minutes: number) => string;
    error: string;
    done: string;
  };
  toolAction: (kind: ToolKind, tool: string) => string;
  line2: {
    none: string;
    some: (n: number, breakdown: string) => string;
  };
  line3: {
    none: string;
    working: string;
    waiting: string;
    stuck: string;
    error: string;
    done: string;
  };
  feed: {
    title: string;
    empty: string;
    prompt: string;
    toolOk: (tool: string) => string;
    toolFailed: (tool: string) => string;
    toolCancelled: (tool: string) => string;
    wait: (tool: string) => string;
    stop: string;
    error: (type: string) => string;
    end: string;
  };
  error: {
    title: string;
    what: string;
    meaning: string;
    fixing: string;
    action: string;
    details: string;
    fixYes: string;
    fixUnknown: string;
    actionNone: string;
    toolFailure: (tool: string) => { what: string; meaning: string };
    api: Record<string, ApiErrorText>;
    apiUnknown: ApiErrorText;
  };
  preview: {
    title: string;
    unavailable: string;
    hint: string;
    urlPlaceholder: string;
    load: string;
    reload: string;
    open: string;
    clear: string;
    invalid: string;
    embedNote: string;
  };
  intel: {
    title: string;
    subtitle: string;
    pasteLabel: string;
    placeholder: string;
    chars: (n: number, max: number) => string;
    tooLong: (max: number) => string;
    privacyTitle: string;
    privacyLines: string[];
    review: string;
    clear: string;
    editText: string;
    analyse: string;
    reviewTitle: string;
    reviewNote: string;
    hidden: (n: number) => string;
    detected: (messages: number, people: number) => string;
    detectedPlain: string;
    whoAreYou: string;
    whoHint: string;
    notSelected: string;
    summaryTitle: string;
    summary: (f: SummaryFacts) => string;
    frequentWords: string;
    pending: string;
    pendingNeedMe: string;
    questions: string;
    actions: string;
    dates: string;
    important: string;
    none: string;
    localNote: string;
    save: string;
    saved: string;
    copy: string;
    copied: string;
    newAnalysis: string;
    savedTitle: string;
    savedNote: string;
    noSaved: string;
    deleteOne: string;
    deleteAll: string;
    empty: string;
  };
  settings: {
    title: string;
    language: string;
    languageHint: string;
    english: string;
    hinglish: string;
    window: string;
    windowHint: string;
    awareness: string;
    awarenessToggle: string;
    awarenessHint: string;
    titlesToggle: string;
    titlesHint: string;
    notifications: string;
    notificationsToggle: string;
    notificationsHint: string;
    filter: string;
    filterHint: string;
    filterPlaceholder: string;
    filterApply: string;
    filterClear: string;
    filterActive: (folder: string) => string;
    filterAll: string;
    filterError: (reason: string) => string;
    on: string;
    off: string;
    privacy: string;
    local: string;
    external: string;
    noExternalYet: string;
    about: string;
    aboutText: string;
  };
  history: {
    title: string;
    empty: string;
    note: string;
    unavailable: string;
    loading: string;
    refresh: string;
    outcome: { finished: string; error: string; ended: string; unknown: string };
    noTools: string;
    toolsLabel: string;
    errorsLabel: string;
    deleteOne: string;
    deleteAll: string;
    confirmAll: string;
    cancel: string;
    storedNote: string;
  };
  notify: {
    waitingTitle: string;
    errorTitle: string;
    stuckTitle: string;
    stuckBody: string;
    doneTitle: string;
  };
  debug: {
    title: string;
    subtitle: string;
    setupTitle: string;
    setupSteps: string[];
    setupPrivacy: string;
    source: { diagnostic: string; rule: string; ai: string };
    confidence: { reported: string; high: string; medium: string; low: string };
    confidenceLabel: string;
    lines: (start: number, end: number) => string;
    line: (n: number) => string;
    trigger: { selection: string; auto: string };
    noFindings: string;
    noRulesFor: (language: string) => string;
    forget: string;
    actions: { explain: string; hideExplain: string; showFix: string; hideFix: string; copyFix: string; copied: string; apply: string; ignore: string };
    why: string;
    how: string;
    sideEffects: string;
    noSideEffects: string;
    diagnosticWhy: string;
    diagnosticHow: string;
    noFixAvailable: string;
    fixTitle: string;
    fixUnverified: string;
    applyConfirm: string;
    applyGo: string;
    applyCancel: string;
    applyWaiting: string;
    applyResult: { applied: string; declined: string; stale: string; not_found: string };
    applyFailed: (reason: string) => string;
    ignoredCount: (n: number) => string;
    showIgnored: string;
    ai: {
      title: string;
      consent: string;
      hiddenNote: (n: number) => string;
      run: string;
      running: string;
      none: string;
      dropped: (n: number) => string;
      failed: (reason: string) => string;
      languageChanged: string;
    };
    rules: Record<string, { title: string; why: string; how: string; sideEffects?: string }>;
  };
}

const list = (items: string[], and: string) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;

const en: Dict = {
  tagline: "Your AI works. SENTIQX understands.",
  status: {
    working: "WORKING",
    waiting: "WAITING FOR USER",
    stuck: "STUCK",
    error: "ERROR",
    done: "DONE",
  },
  statusNone: "NO STATUS YET",
  monitorBadge: { off: "Not monitoring", on: "Monitoring", paused: "Paused" },
  nav: { home: "Home", live: "Claude", debug: "Debug", intel: "Intel", history: "History", settings: "Settings", back: "Back" },
  home: {
    greeting: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Working late" },
    working: (a) => `You're currently working in ${a}.`,
    using: (a) => `You're currently using ${a}.`,
    detecting: "Looking for the active application...",
    categories: { coding: "Coding", browser: "Browser", terminal: "Terminal", communication: "Communication", other: "General app" },
    stages: { detected: "App detected", context: "Context available", understood: "Activity understood", unsupported: "Integration unsupported" },
    context: {
      waitingSource: (a) => `${a} detected. Waiting for an authorised activity source.`,
      connected: (a) => `${a} detected. Claude Code is connected and waiting for its first event.`,
      understood: () => "Verified activity is arriving from Claude Code.",
      browser: (a) => `${a} detected. SENTIQX cannot read its tabs or pages.`,
      communication: (a) => `${a} detected. SENTIQX does not read your chats.`,
      other: (a) => `${a} detected. SENTIQX has no contextual understanding of this app.`,
    },
    hints: {
      connect: "Connect Claude Code",
      preview: "Open live preview",
      paste: "Paste text to summarise",
    },
    titleHidden: "Window title hidden. You can allow it in Settings.",
    awarenessOn: "App detection on",
    pause: "Turn off",
    permission: {
      title: "See which app you're in?",
      body: "SENTIQX can show the application in front of you and update as you switch.",
      points: [
        "Reads only the app's name. Window titles stay off unless you allow them.",
        "Never reads window contents, keystrokes or your screen.",
        "Stays on this computer. Turn it off any time.",
      ],
      allow: "Allow",
      notNow: "Not now",
    },
    off: { title: "App detection is off", body: "SENTIQX is not looking at which app is in front.", turnOn: "Turn on" },
    failed: "Could not read the app detection setting.",
    summaryTitle: "Claude Code",
    claudeNotConnected: "Not connected. Claude Code activity appears here after you connect it.",
    recentTitle: "Recent apps",
    recentEmpty: "Your app switches will appear here. They are not saved.",
    quickTitle: "Quick access",
    quick: { claude: "Claude Code", intel: "Summarise chat", preview: "Live preview", settings: "Settings" },
  },
  controls: { start: "Connect Claude Code", pause: "Pause", resume: "Resume", stop: "Stop" },
  connectorNotReady: "SENTIQX could not open its local receiver, so monitoring cannot start.",
  startFailed: (r) => `Could not start monitoring: ${r}`,
  noEventsHint:
    "No events received yet. Send a message to Claude. Some Claude Code versions may not run hooks in the VS Code panel.",
  pausedNote: "Paused. Nothing is recorded until you resume.",
  demoBanner: "DEMO DATA - not real Claude activity",
  win: {
    pin: "Pinned on top. Click to unpin.",
    unpin: "Not pinned. Click to keep on top.",
    hide: "Hide to tray (monitoring keeps running)",
    close: "Close SENTIQX",
    pinFailed: "Could not change the pin.",
    pinnedState: "Pinned on top",
    unpinnedState: "Not pinned",
  },
  time: {
    justNow: "just now",
    secondsAgo: (n) => `${n}s ago`,
    minutesAgo: (n) => `${n} min ago`,
    hoursAgo: (n) => `${n} h ago`,
  },
  hero: {
    session: "Session",
    noSession: "No session",
    lastEvent: "Last event",
    noEvents: "no events yet",
  },
  consent: {
    title: "Connect Claude Code?",
    intro: "SENTIQX will follow Claude Code sessions on this computer. No folder is needed.",
    monitored: [
      "Which tool Claude is using (for example Write or PowerShell)",
      "The name of the folder Claude is working in",
      "Whether a tool succeeded or failed",
      "When Claude asks for permission or finishes",
    ],
    notMonitored: [
      "Other apps or windows",
      "Your screen (no screenshots or recordings)",
      "Your prompts, commands and file contents",
    ],
    changes:
      "To listen, SENTIQX adds temporary hooks to your Claude settings file (~/.claude/settings.json) and removes them when you stop or close it. Until then, a backup of that file is kept beside it.",
    local: "Stays on this computer: activity, history and settings.",
    external:
      "Sent outside only if you turn on AI summaries, after secrets are removed. Removal is not perfect.",
    allow: "Allow and start",
    cancel: "Cancel",
  },
  labels: { now: "Now", done: "Completed", next: "Next" },
  line1: {
    off: "Monitoring is off.",
    paused: "Monitoring is paused.",
    none: "Waiting for Claude Code activity.",
    working: (a) =>
      a ? `Claude is ${a}.` : "Claude is working on your request. No tool is running right now.",
    waiting: (t) => `Claude is asking permission to use ${t}.`,
    stuck: (m) =>
      `No activity for about ${m} min. Claude may still be thinking or running a long task.`,
    error: "Something went wrong. See the details below.",
    done: "Claude has finished its turn.",
  },
  toolAction: (kind, tool) => {
    switch (kind) {
      case "edit":
        return "creating or editing a file";
      case "run":
        return "running a command";
      case "read":
        return "reading or searching files";
      case "web":
        return "looking something up online";
      case "agent":
        return "running a helper task";
      default:
        return `using ${tool}`;
    }
  },
  line2: {
    none: "No finished actions recorded yet.",
    some: (n, b) => `${n} tool ${n === 1 ? "action" : "actions"} finished successfully (${b}).`,
  },
  line3: {
    none: "Start a Claude Code task and this will update.",
    working: "Likely next: more tool actions, or a final reply.",
    waiting: "Action needed: approve or deny in the Claude window.",
    stuck: "Check the Claude window. It may need your attention.",
    error: "Check whether you need to act. See the details below.",
    done: "Your turn: review the result.",
  },
  feed: {
    title: "Recent activity",
    empty: "Nothing reported yet.",
    prompt: "You sent a message",
    toolOk: (t) => `${t} finished`,
    toolFailed: (t) => `${t} failed`,
    toolCancelled: (t) => `${t} was cancelled`,
    wait: (t) => `Asked permission for ${t}`,
    stop: "Claude finished its turn",
    error: (t) => `Stopped by an error (${t})`,
    end: "Session ended",
  },
  error: {
    title: "Error",
    what: "What happened",
    meaning: "What it means",
    fixing: "Is Claude fixing it?",
    action: "Do you need to act?",
    details: "Original details",
    fixYes: "Claude started another action after this, so it may be retrying. This is not confirmed.",
    fixUnknown: "No sign of a fix yet.",
    actionNone: "Nothing needed from you right now.",
    toolFailure: (tool) => ({
      what: `A ${tool} action failed.`,
      meaning:
        "One step did not work. This is common and Claude often tries another way on its own.",
    }),
    api: {
      rate_limit: {
        what: "Claude hit a usage limit.",
        meaning: "Too many requests were made in a short time.",
        action: "Wait a few minutes, then ask Claude to continue.",
      },
      overloaded: {
        what: "The Claude service is busy.",
        meaning: "The servers are overloaded. It is not a problem with your code.",
        action: "Wait a moment and try again.",
      },
      authentication_failed: {
        what: "Claude could not sign in.",
        meaning: "Your login or API key was not accepted.",
        action: "Sign in to Claude Code again.",
      },
      billing_error: {
        what: "There is a billing problem.",
        meaning: "Your account has a payment or credit issue.",
        action: "Check your Claude account billing.",
      },
      server_error: {
        what: "The Claude service had an internal error.",
        meaning: "The problem is on the service side, not in your project.",
        action: "Try again in a little while.",
      },
      max_output_tokens: {
        what: "Claude's reply was too long and got cut off.",
        meaning: "It hit the maximum length for one reply.",
        action: "Ask Claude to continue.",
      },
    },
    apiUnknown: {
      what: "Claude stopped because of an error.",
      meaning: "The error type is not one SENTIQX knows yet.",
      action: "Check the Claude window for details.",
    },
  },
  preview: {
    title: "Live preview",
    unavailable: "Preview unavailable.",
    hint: "Enter the address of a local dev server to see the real running page. Monitoring does not depend on this.",
    urlPlaceholder: "http://localhost:5173",
    load: "Load",
    reload: "Reload",
    open: "Open in browser",
    clear: "Close preview",
    invalid: "Only local addresses are allowed (localhost or 127.0.0.1).",
    embedNote: "This is the real page. If it stays blank, the page may block being embedded.",
  },
  intel: {
    title: "Communication Intelligence",
    subtitle: "Understand a long chat quickly. You choose exactly what to paste.",
    pasteLabel: "Paste the conversation",
    placeholder: "Paste selected messages here: a WhatsApp export, an email thread, any chat...",
    chars: (n, max) => `${n.toLocaleString()} / ${max.toLocaleString()} characters`,
    tooLong: (max) => `Only the last ${max.toLocaleString()} characters will be analysed.`,
    privacyTitle: "Privacy",
    privacyLines: [
      "You paste the text yourself. SENTIQX never reads WhatsApp, Instagram or email on its own.",
      "Analysis runs on this computer. No AI model is used and nothing is sent over the internet.",
      "The text is kept in memory only. It is erased when you clear it or close the app.",
      "Passwords, codes and key-like text are hidden first. This is not perfect, so review the text.",
    ],
    review: "Review",
    clear: "Clear",
    editText: "Edit text",
    analyse: "Analyse",
    reviewTitle: "Review before analysing",
    reviewNote: "This is exactly what will be analysed.",
    hidden: (n) =>
      n === 0 ? "No sensitive-looking text found." : `${n} sensitive-looking ${n === 1 ? "item" : "items"} hidden.`,
    detected: (m, p) => `${m} ${m === 1 ? "message" : "messages"}, ${p} ${p === 1 ? "participant" : "participants"} detected.`,
    detectedPlain: "No chat format detected, so the text is treated as plain messages.",
    whoAreYou: "Which participant are you? (optional)",
    whoHint: "Needed to find replies you still owe.",
    notSelected: "Not selected",
    summaryTitle: "Summary",
    summary: (f) => {
      const who = f.people.length > 0 ? ` between ${list(f.people.slice(0, 3), "and")}${f.people.length > 3 ? " and others" : ""}` : "";
      const range = f.from && f.to ? ` (${f.from} to ${f.to})` : "";
      const found = `Found ${f.questions} ${f.questions === 1 ? "question" : "questions"}, ${f.actions} action ${f.actions === 1 ? "item" : "items"} and ${f.dates} date or time ${f.dates === 1 ? "mention" : "mentions"}.`;
      const pend = f.pending === null ? "" : ` ${f.pending} ${f.pending === 1 ? "reply" : "replies"} may still be pending.`;
      return `${f.messages} ${f.messages === 1 ? "message" : "messages"}${who}${range}. ${found}${pend}`;
    },
    frequentWords: "Frequent words",
    pending: "Pending replies",
    pendingNeedMe: "Choose which participant you are to see pending replies.",
    questions: "Questions",
    actions: "Action items",
    dates: "Dates and commitments",
    important: "Possibly important",
    none: "None found.",
    localNote:
      "Local rule-based analysis. It looks for explicit signals and can miss things. It does not understand meaning like an AI model.",
    save: "Save summary",
    saved: "Saved",
    copy: "Copy",
    copied: "Copied",
    newAnalysis: "New analysis",
    savedTitle: "Saved summaries",
    savedNote: "A saved summary contains short quotes from the chat. Delete it any time.",
    noSaved: "No saved summaries.",
    deleteOne: "Delete",
    deleteAll: "Delete all",
    empty: "Paste a conversation to begin.",
  },
  settings: {
    title: "Settings",
    language: "Language",
    languageHint: "Applies to all labels, summaries and error explanations.",
    english: "English",
    hinglish: "Hinglish",
    window: "Window",
    windowHint:
      "Pinned keeps SENTIQX above other windows without taking your keyboard focus. Hide sends it to the tray icon. Position and size are remembered.",
    awareness: "App detection",
    awarenessToggle: "Detect the active application",
    awarenessHint: "Reads only the app's name, and only while this is on.",
    titlesToggle: "Show window titles",
    titlesHint: "Titles can contain file names or email subjects. They are shown here only and never saved.",
    notifications: "Notifications",
    notificationsToggle: "Notify me about important moments",
    notificationsHint: "When Claude needs you, stops on an error, may be stuck, or finishes a longer task.",
    filter: "Limit to one project (optional)",
    filterHint: "By default SENTIQX follows every Claude session. Enter a folder path to follow only that project.",
    filterPlaceholder: "C:\\Users\\you\\my-project",
    filterApply: "Apply",
    filterClear: "Clear",
    filterActive: (f) => `Following only: ${f}`,
    filterAll: "Following all Claude sessions.",
    filterError: (r) => `Could not use that folder: ${r}`,
    on: "On",
    off: "Off",
    privacy: "Privacy",
    local: "Stays on this computer: activity, session history, settings.",
    external: "Sent outside: nothing, for now.",
    noExternalYet: "AI summaries are off. Summaries are built on this computer from the events only.",
    about: "About",
    aboutText: "SENTIQX 0.1.0. Phase 1: Claude Code on Windows.",
  },
  history: {
    title: "History",
    empty: "No saved sessions yet.",
    note: "Claude Code sessions appear here after you connect. They stay on this computer.",
    unavailable: "History could not be opened. Monitoring still works.",
    loading: "Loading history...",
    refresh: "Refresh",
    outcome: {
      finished: "Claude finished its last turn",
      error: "Stopped by an error",
      ended: "Session ended",
      unknown: "No final event was reported",
    },
    noTools: "No finished tool actions recorded.",
    toolsLabel: "Verified tool actions",
    errorsLabel: "Errors",
    deleteOne: "Delete this session",
    deleteAll: "Delete all",
    confirmAll: "Delete all history? This cannot be undone.",
    cancel: "Cancel",
    storedNote: "Only tool names, counts, error types, times and the folder name are stored. Never prompts, commands or output.",
  },
  notify: {
    waitingTitle: "Claude needs you",
    errorTitle: "Claude stopped",
    stuckTitle: "Claude may be stuck",
    stuckBody: "No activity for a while. This is only a suspicion, so check the Claude window.",
    doneTitle: "Claude finished",
  },
  debug: {
    title: "Smart Debug",
    subtitle: "Select code in your editor and see what might be wrong, and how sure SENTIQX is.",
    setupTitle: "How to start",
    setupSteps: [
      "Install the SENTIQX extension in VS Code.",
      "Select the code you want checked.",
      "Right-click and choose SENTIQX: Analyse Selection.",
    ],
    setupPrivacy: "Code is read only when you run that command. It stays in memory on this computer and is never saved.",
    source: { diagnostic: "Reported by tool", rule: "Pattern match", ai: "AI suspected" },
    confidence: { reported: "reported", high: "high", medium: "medium", low: "low" },
    confidenceLabel: "Confidence",
    lines: (s, e) => (s === e ? `Line ${s}` : `Lines ${s}-${e}`),
    line: (n) => `Line ${n}`,
    trigger: { selection: "Your selection", auto: "After save" },
    noFindings: "No tool errors or known risky patterns here. This does not prove the code is correct.",
    noRulesFor: (l) => `No pattern checks for ${l} yet. Tool errors and the AI review still work.`,
    forget: "Forget this code",
    actions: { explain: "Explain", hideExplain: "Hide", showFix: "Show Fix", hideFix: "Hide Fix", copyFix: "Copy Fix", copied: "Copied", apply: "Apply Fix", ignore: "Ignore" },
    why: "Why it may be wrong",
    how: "How to improve it",
    sideEffects: "Possible side effects",
    noSideEffects: "None known, but check the code around it.",
    diagnosticWhy: "Your editor's language tools reported this line. The message above is their exact wording.",
    diagnosticHow: "Read the message, then correct that line. The AI review can explain it further.",
    noFixAvailable: "No safe automatic fix for this one.",
    fixTitle: "Suggested change",
    fixUnverified: "Not verified: this change has not been run or tested.",
    applyConfirm: "VS Code will show this change and ask you again. Nothing is saved automatically, and you can undo it.",
    applyGo: "Send to VS Code",
    applyCancel: "Cancel",
    applyWaiting: "Waiting for your answer in VS Code...",
    applyResult: {
      applied: "Applied in VS Code, not saved yet. Press Ctrl+Z there to undo.",
      declined: "You declined it in VS Code. Nothing changed.",
      stale: "The file changed, so nothing was applied. Analyse the code again.",
      not_found: "That code could not be found exactly once, so nothing was applied.",
    },
    applyFailed: (r) => `Could not send the fix: ${r}`,
    ignoredCount: (n) => `${n} ignored`,
    showIgnored: "Show",
    ai: {
      title: "AI review",
      consent: "Sends this selected code to Anthropic through your Claude Code login, and uses your Claude usage. Claude gets no tools, so it can only answer.",
      hiddenNote: (n) => `${n} secret-looking ${n === 1 ? "item" : "items"} will be hidden first. This is not perfect.`,
      run: "Review with Claude",
      running: "Claude is reviewing this code...",
      none: "Claude found no problems in this selection. It can still miss things.",
      dropped: (n) => `${n} AI ${n === 1 ? "answer was" : "answers were"} removed because the quoted code did not match.`,
      failed: (r) => `AI review failed: ${r}`,
      languageChanged: "The language changed. Run the review again to read it in this language.",
    },
    rules: {
      "assign-in-condition": {
        title: "Assignment inside a condition",
        why: "A single = changes the value instead of comparing it, so this condition may not test what it looks like it tests.",
        how: "Use === to compare. If the assignment is on purpose, wrap it in double brackets to show that.",
        sideEffects: "If the assignment was intended, the variable will no longer be updated here.",
      },
      "nan-compare": {
        title: "Comparing with NaN never works",
        why: "NaN is not equal to anything, not even itself, so this check gives the same answer every time.",
        how: "Use Number.isNaN() to check for NaN.",
        sideEffects: "Number.isNaN does not convert values, so a text value gives false.",
      },
      "self-compare": {
        title: "A value compared with itself",
        why: "Comparing something with itself almost always gives the same answer, so one side is probably the wrong variable.",
        how: "Check which two values you meant to compare.",
      },
      "loop-off-by-one": {
        title: "Loop goes one step too far",
        why: "Positions start at 0, so the last valid position is length - 1. With <= the last round reads a position that does not exist.",
        how: "Use < instead of <=.",
        sideEffects: "The loop runs one time fewer. Check code that relied on that extra round.",
      },
      "index-at-length": {
        title: "Reading past the end of a list",
        why: "Positions start at 0, so position length does not exist and this always gives undefined.",
        how: "Use length - 1 to get the last item.",
        sideEffects: "This returns a real item now. An empty list still gives undefined.",
      },
      "async-foreach": {
        title: "forEach does not wait for async work",
        why: "forEach ignores the promises, so the code after it can run before this work finishes, and errors can go unnoticed.",
        how: "Use a for...of loop with await, or await Promise.all with map.",
      },
      "empty-catch": {
        title: "Errors are silently ignored",
        why: "This empty catch hides every error, so failures become very hard to notice and debug.",
        how: "Log or handle the error. If ignoring it is on purpose, add a comment saying why.",
      },
      eval: {
        title: "eval can run unsafe code",
        why: "eval runs text as code. If any part of that text comes from a user, they could run anything.",
        how: "Avoid eval. Use JSON.parse for data, or a lookup table for choosing behaviour.",
      },
      "hardcoded-secret": {
        title: "Possible secret written in the code",
        why: "A password or key in code can be read by anyone with the code, and it stays in git history.",
        how: "Move it to an environment variable or a secret store, and replace the old value if it is real.",
      },
      "py-mutable-default": {
        title: "Shared default list or dict",
        why: "Python creates this default only once, so changes made in one call carry over to the next.",
        how: "Use None as the default, and create the list or dict inside the function.",
      },
      "py-bare-except": {
        title: "Catches every error",
        why: "A bare except also catches things like Ctrl+C and can hide real bugs.",
        how: "Catch the specific error you expect, or at least Exception.",
        sideEffects: "Ctrl+C and program exit will now stop the program instead of being caught here.",
      },
      "py-none-compare": {
        title: "Use is to compare with None",
        why: "== can be changed by a class and give a wrong answer. None should be checked by identity.",
        how: "Use is None or is not None.",
      },
      "py-eval": {
        title: "eval or exec can run unsafe code",
        why: "These run text as code. If any part of that text comes from a user, they could run anything.",
        how: "Avoid them. Use ast.literal_eval or json.loads for data.",
      },
    },
  },
};

const hinglish: Dict = {
  tagline: "Aapka AI kaam karta hai. SENTIQX samajhta hai.",
  status: {
    working: "KAAM CHAL RAHA HAI",
    waiting: "AAPKA INTEZAAR",
    stuck: "ATKA HUA",
    error: "ERROR",
    done: "HO GAYA",
  },
  statusNone: "ABHI STATUS NAHI",
  monitorBadge: { off: "Monitoring band", on: "Monitoring chalu", paused: "Paused" },
  nav: { home: "Home", live: "Claude", debug: "Debug", intel: "Intel", history: "History", settings: "Settings", back: "Wapas" },
  home: {
    greeting: { morning: "Suprabhat", afternoon: "Namaste", evening: "Shubh sandhya", night: "Der raat tak kaam" },
    working: (a) => `Aap abhi ${a} mein kaam kar rahe ho.`,
    using: (a) => `Aap abhi ${a} use kar rahe ho.`,
    detecting: "Active application dhoondh rahe hain...",
    categories: { coding: "Coding", browser: "Browser", terminal: "Terminal", communication: "Communication", other: "General app" },
    stages: { detected: "App mil gaya", context: "Context available", understood: "Activity samajh aayi", unsupported: "Integration support nahi" },
    context: {
      waitingSource: (a) => `${a} mil gaya. Authorised activity source ka intezaar hai.`,
      connected: (a) => `${a} mil gaya. Claude Code connected hai aur pehle event ka intezaar hai.`,
      understood: () => "Claude Code se verified activity aa rahi hai.",
      browser: (a) => `${a} mil gaya. SENTIQX iske tabs ya pages nahi padh sakta.`,
      communication: (a) => `${a} mil gaya. SENTIQX aapki chats nahi padhta.`,
      other: (a) => `${a} mil gaya. SENTIQX is app ka context nahi samajhta.`,
    },
    hints: {
      connect: "Claude Code connect karo",
      preview: "Live preview kholo",
      paste: "Summary ke liye text paste karo",
    },
    titleHidden: "Window title chhupa hai. Settings mein allow kar sakte ho.",
    awarenessOn: "App detection chalu",
    pause: "Band karo",
    permission: {
      title: "Dekhein ki aap kis app mein ho?",
      body: "SENTIQX samne wala application dikha sakta hai, aur app badalne par update hota hai.",
      points: [
        "Sirf app ka naam padhta hai. Window titles tabhi jab aap allow karo.",
        "Window ka content, keystrokes ya screen kabhi nahi padhta.",
        "Sab isi computer par rehta hai. Jab chaho band kar do.",
      ],
      allow: "Allow karo",
      notNow: "Abhi nahi",
    },
    off: { title: "App detection band hai", body: "SENTIQX nahi dekh raha ki samne kaunsa app hai.", turnOn: "Chalu karo" },
    failed: "App detection ki setting nahi padh paaye.",
    summaryTitle: "Claude Code",
    claudeNotConnected: "Connected nahi hai. Connect karne ke baad Claude Code ki activity yahan dikhegi.",
    recentTitle: "Haal ke apps",
    recentEmpty: "Aapke app switches yahan dikhenge. Ye save nahi hote.",
    quickTitle: "Quick access",
    quick: { claude: "Claude Code", intel: "Chat ki summary", preview: "Live preview", settings: "Settings" },
  },
  controls: {
    start: "Claude Code connect karo",
    pause: "Pause",
    resume: "Resume",
    stop: "Stop",
  },
  connectorNotReady: "SENTIQX apna local receiver nahi khol paaya, isliye monitoring shuru nahi ho sakti.",
  startFailed: (r) => `Monitoring shuru nahi ho paayi: ${r}`,
  noEventsHint:
    "Abhi tak koi event nahi aaya. Claude ko ek message bhejo. Kuch Claude Code versions VS Code panel mein hooks nahi chalate.",
  pausedNote: "Paused hai. Resume karne tak kuch record nahi hoga.",
  demoBanner: "DEMO DATA - asli Claude activity nahi hai",
  win: {
    pin: "Upar pinned hai. Unpin karne ke liye click karo.",
    unpin: "Pinned nahi hai. Upar rakhne ke liye click karo.",
    hide: "Tray mein chhupao (monitoring chalti rahegi)",
    close: "SENTIQX band karo",
    pinFailed: "Pin badal nahi paaya.",
    pinnedState: "Upar pinned",
    unpinnedState: "Pinned nahi",
  },
  time: {
    justNow: "abhi abhi",
    secondsAgo: (n) => `${n} sec pehle`,
    minutesAgo: (n) => `${n} min pehle`,
    hoursAgo: (n) => `${n} ghante pehle`,
  },
  hero: {
    session: "Session",
    noSession: "Koi session nahi",
    lastEvent: "Aakhri event",
    noEvents: "abhi koi event nahi",
  },
  consent: {
    title: "Claude Code connect karein?",
    intro: "SENTIQX is computer ke Claude Code sessions ko follow karega. Koi folder nahi chahiye.",
    monitored: [
      "Claude kaunsa tool use kar raha hai (jaise Write ya PowerShell)",
      "Jis folder mein Claude kaam kar raha hai, uska naam",
      "Tool safal hua ya fail",
      "Claude kab permission maangta hai ya kaam khatam karta hai",
    ],
    notMonitored: [
      "Dusre apps ya windows",
      "Aapki screen (koi screenshot ya recording nahi)",
      "Aapke prompts, commands aur file ka content",
    ],
    changes:
      "Sunne ke liye SENTIQX aapki Claude settings file (~/.claude/settings.json) mein temporary hooks jodta hai, aur Stop karne ya app band karne par hata deta hai. Tab tak us file ka backup uske paas rehta hai.",
    local: "Isi computer par rehta hai: activity, history aur settings.",
    external:
      "Bahar tabhi jata hai jab aap AI summaries on karoge, secrets hatane ke baad. Hatana perfect nahi hota.",
    allow: "Allow karo aur shuru karo",
    cancel: "Cancel",
  },
  labels: { now: "Abhi", done: "Complete", next: "Aage" },
  line1: {
    off: "Monitoring band hai.",
    paused: "Monitoring paused hai.",
    none: "Claude Code ki activity ka intezaar hai.",
    working: (a) =>
      a
        ? `Claude ${a}.`
        : "Claude aapke request par kaam kar raha hai. Abhi koi tool nahi chal raha.",
    waiting: (t) => `Claude ${t} use karne ki permission maang raha hai.`,
    stuck: (m) =>
      `Lagbhag ${m} min se koi activity nahi. Ho sakta hai Claude abhi bhi soch raha ho ya lamba kaam chal raha ho.`,
    error: "Kuch galat ho gaya. Neeche details dekho.",
    done: "Claude ne apna turn khatam kar diya.",
  },
  toolAction: (kind, tool) => {
    switch (kind) {
      case "edit":
        return "file bana ya badal raha hai";
      case "run":
        return "ek command chala raha hai";
      case "read":
        return "files padh ya dhoondh raha hai";
      case "web":
        return "online kuch dekh raha hai";
      case "agent":
        return "ek helper task chala raha hai";
      default:
        return `${tool} use kar raha hai`;
    }
  },
  line2: {
    none: "Abhi tak koi action poora hone ka record nahi hai.",
    some: (n, b) => `${n} tool action safalta se poore hue (${b}).`,
  },
  line3: {
    none: "Claude Code mein task shuru karo, yeh update hoga.",
    working: "Likely next: aur tool actions, ya final reply.",
    waiting: "Aapko karna hai: Claude window mein approve ya deny karo.",
    stuck: "Claude window dekho. Ho sakta hai use aapki zaroorat ho.",
    error: "Dekho ki aapko kuch karna hai ya nahi. Neeche details hain.",
    done: "Ab aapki baari: result check karo.",
  },
  feed: {
    title: "Haal ki activity",
    empty: "Abhi kuch report nahi hua.",
    prompt: "Aapne message bheja",
    toolOk: (t) => `${t} poora hua`,
    toolFailed: (t) => `${t} fail hua`,
    toolCancelled: (t) => `${t} cancel hua`,
    wait: (t) => `${t} ki permission maangi`,
    stop: "Claude ne turn khatam kiya",
    error: (t) => `Error se ruk gaya (${t})`,
    end: "Session khatam",
  },
  error: {
    title: "Error",
    what: "Kya hua",
    meaning: "Iska matlab",
    fixing: "Kya Claude theek kar raha hai?",
    action: "Kya aapko kuch karna hai?",
    details: "Original details",
    fixYes:
      "Iske baad Claude ne dusra action shuru kiya, to ho sakta hai woh dobara try kar raha ho. Yeh pakka nahi hai.",
    fixUnknown: "Theek karne ka abhi koi sanket nahi hai.",
    actionNone: "Abhi aapko kuch karne ki zaroorat nahi.",
    toolFailure: (tool) => ({
      what: `${tool} ka ek action fail ho gaya.`,
      meaning:
        "Ek step nahi chala. Yeh aam baat hai, aur Claude aksar khud dusra tareeka try karta hai.",
    }),
    api: {
      rate_limit: {
        what: "Claude ki usage limit poori ho gayi.",
        meaning: "Thode time mein bahut zyada requests ho gayi.",
        action: "Kuch minute ruko, phir Claude ko continue karne bolo.",
      },
      overloaded: {
        what: "Claude service abhi busy hai.",
        meaning: "Servers par load zyada hai. Aapke code mein dikkat nahi hai.",
        action: "Thodi der ruko aur dobara try karo.",
      },
      authentication_failed: {
        what: "Claude login nahi kar paaya.",
        meaning: "Aapka login ya API key accept nahi hui.",
        action: "Claude Code mein dobara sign in karo.",
      },
      billing_error: {
        what: "Billing mein dikkat hai.",
        meaning: "Aapke account mein payment ya credit ki problem hai.",
        action: "Apne Claude account ki billing check karo.",
      },
      server_error: {
        what: "Claude service mein internal error aaya.",
        meaning: "Dikkat service ki taraf hai, aapke project mein nahi.",
        action: "Thodi der baad dobara try karo.",
      },
      max_output_tokens: {
        what: "Claude ka reply bahut lamba tha aur beech mein kat gaya.",
        meaning: "Ek reply ki maximum length poori ho gayi.",
        action: "Claude ko continue karne bolo.",
      },
    },
    apiUnknown: {
      what: "Claude ek error ki wajah se ruk gaya.",
      meaning: "Yeh error type SENTIQX abhi nahi jaanta.",
      action: "Details ke liye Claude window dekho.",
    },
  },
  preview: {
    title: "Live preview",
    unavailable: "Preview available nahi hai.",
    hint: "Asli chalta hua page dekhne ke liye local dev server ka address daalo. Monitoring is par depend nahi karti.",
    urlPlaceholder: "http://localhost:5173",
    load: "Load karo",
    reload: "Reload",
    open: "Browser mein kholo",
    clear: "Preview band karo",
    invalid: "Sirf local address allowed hai (localhost ya 127.0.0.1).",
    embedNote: "Yeh asli page hai. Agar khaali dikhe, to ho sakta hai page embed hone se rok raha ho.",
  },
  intel: {
    title: "Communication Intelligence",
    subtitle: "Lambi chat jaldi samjho. Kya paste karna hai, yeh aap hi chunte ho.",
    pasteLabel: "Conversation paste karo",
    placeholder: "Chune hue messages yahan paste karo: WhatsApp export, email thread, koi bhi chat...",
    chars: (n, max) => `${n.toLocaleString()} / ${max.toLocaleString()} characters`,
    tooLong: (max) => `Sirf aakhri ${max.toLocaleString()} characters analyse honge.`,
    privacyTitle: "Privacy",
    privacyLines: [
      "Text aap khud paste karte ho. SENTIQX WhatsApp, Instagram ya email ko apne aap kabhi nahi padhta.",
      "Analysis isi computer par hota hai. Koi AI model use nahi hota aur internet par kuch nahi jata.",
      "Text sirf memory mein rehta hai. Clear karne ya app band karne par mit jata hai.",
      "Password, code aur key jaisa text pehle chhupa diya jata hai. Yeh perfect nahi hai, isliye text review karo.",
    ],
    review: "Review karo",
    clear: "Clear",
    editText: "Text badlo",
    analyse: "Analyse karo",
    reviewTitle: "Analyse karne se pehle review karo",
    reviewNote: "Bilkul yahi text analyse hoga.",
    hidden: (n) => (n === 0 ? "Koi sensitive jaisa text nahi mila." : `${n} sensitive jaisi cheez chhupayi gayi.`),
    detected: (m, p) => `${m} message, ${p} participant mile.`,
    detectedPlain: "Koi chat format nahi mila, isliye text ko seedhe messages ki tarah liya gaya.",
    whoAreYou: "Aap kaun se participant ho? (optional)",
    whoHint: "Aapke baaki reply dhoondhne ke liye zaroori hai.",
    notSelected: "Chuna nahi",
    summaryTitle: "Summary",
    summary: (f) => {
      const who = f.people.length > 0 ? `${list(f.people.slice(0, 3), "aur")}${f.people.length > 3 ? " aur baaki" : ""} ke beech ` : "";
      const range = f.from && f.to ? ` (${f.from} se ${f.to})` : "";
      const pend = f.pending === null ? "" : ` ${f.pending} reply abhi pending ho sakte hain.`;
      return `${who}${f.messages} messages${range}. ${f.questions} sawaal, ${f.actions} action item aur ${f.dates} date ya time ke mention mile.${pend}`;
    },
    frequentWords: "Baar-baar aaye shabd",
    pending: "Pending replies",
    pendingNeedMe: "Pending replies dekhne ke liye chuno ki aap kaun se participant ho.",
    questions: "Sawaal",
    actions: "Action items",
    dates: "Dates aur commitments",
    important: "Shayad zaroori",
    none: "Kuch nahi mila.",
    localNote:
      "Local rule-based analysis. Yeh saaf signals dhoondhta hai aur kuch chhoot sakta hai. Yeh AI model ki tarah matlab nahi samajhta.",
    save: "Summary save karo",
    saved: "Save ho gaya",
    copy: "Copy",
    copied: "Copy ho gaya",
    newAnalysis: "Nayi analysis",
    savedTitle: "Saved summaries",
    savedNote: "Saved summary mein chat ke chhote quotes hote hain. Jab chaho delete kar do.",
    noSaved: "Koi saved summary nahi hai.",
    deleteOne: "Delete",
    deleteAll: "Sab delete karo",
    empty: "Shuru karne ke liye conversation paste karo.",
  },
  settings: {
    title: "Settings",
    language: "Bhasha",
    languageHint: "Sabhi labels, summaries aur error explanations par lagu hota hai.",
    english: "English",
    hinglish: "Hinglish",
    window: "Window",
    windowHint:
      "Pinned hone par SENTIQX dusri windows ke upar rehta hai aur aapka keyboard focus nahi leta. Hide karne par yeh tray icon mein chala jata hai. Position aur size yaad rakhe jaate hain.",
    awareness: "App detection",
    awarenessToggle: "Active application pehchano",
    awarenessHint: "Sirf app ka naam padhta hai, aur sirf jab tak yeh on hai.",
    titlesToggle: "Window titles dikhao",
    titlesHint: "Titles mein file ke naam ya email subject ho sakte hain. Ye sirf yahan dikhte hain, kabhi save nahi hote.",
    notifications: "Notifications",
    notificationsToggle: "Zaroori moments par batao",
    notificationsHint: "Jab Claude ko aapki zaroorat ho, error se ruke, atka lage, ya lamba kaam khatam kare.",
    filter: "Ek project tak seemit karo (optional)",
    filterHint: "Normally SENTIQX har Claude session follow karta hai. Sirf ek project follow karne ke liye folder ka path daalo.",
    filterPlaceholder: "C:\\Users\\aap\\mera-project",
    filterApply: "Lagu karo",
    filterClear: "Hatao",
    filterActive: (f) => `Sirf ye follow ho raha hai: ${f}`,
    filterAll: "Saare Claude sessions follow ho rahe hain.",
    filterError: (r) => `Wo folder use nahi ho paaya: ${r}`,
    on: "On",
    off: "Off",
    privacy: "Privacy",
    local: "Isi computer par rehta hai: activity, session history, settings.",
    external: "Bahar bheja jata hai: abhi kuch nahi.",
    noExternalYet: "AI summaries band hain. Summaries isi computer par sirf events se banti hain.",
    about: "About",
    aboutText: "SENTIQX 0.1.0. Phase 1: Windows par Claude Code.",
  },
  history: {
    title: "History",
    empty: "Abhi koi saved session nahi hai.",
    note: "Connect karne ke baad Claude Code sessions yahan dikhenge. Ye isi computer par rehte hain.",
    unavailable: "History khul nahi paayi. Monitoring phir bhi chalti hai.",
    loading: "History load ho rahi hai...",
    refresh: "Refresh",
    outcome: {
      finished: "Claude ne apna aakhri turn khatam kiya",
      error: "Error se ruk gaya",
      ended: "Session khatam",
      unknown: "Koi final event report nahi hua",
    },
    noTools: "Koi poora tool action record nahi hua.",
    toolsLabel: "Verified tool actions",
    errorsLabel: "Errors",
    deleteOne: "Ye session delete karo",
    deleteAll: "Sab delete karo",
    confirmAll: "Poori history delete karein? Ye wapas nahi aayegi.",
    cancel: "Cancel",
    storedNote: "Sirf tool ke naam, counts, error types, time aur folder ka naam save hota hai. Prompts, commands ya output kabhi nahi.",
  },
  notify: {
    waitingTitle: "Claude ko aapki zaroorat hai",
    errorTitle: "Claude ruk gaya",
    stuckTitle: "Claude shayad atka hua hai",
    stuckBody: "Kaafi der se koi activity nahi. Ye sirf shak hai, Claude window dekh lo.",
    doneTitle: "Claude ne kaam khatam kiya",
  },
  debug: {
    title: "Smart Debug",
    subtitle: "Editor mein code select karo aur dekho kya galat ho sakta hai, aur SENTIQX kitna sure hai.",
    setupTitle: "Shuru kaise karein",
    setupSteps: [
      "VS Code mein SENTIQX extension install karo.",
      "Jo code check karna hai, use select karo.",
      "Right-click karke SENTIQX: Analyse Selection chuno.",
    ],
    setupPrivacy: "Code sirf tab padha jata hai jab aap ye command chalate ho. Wo isi computer ki memory mein rehta hai aur kabhi save nahi hota.",
    source: { diagnostic: "Tool ne bataya", rule: "Pattern match", ai: "AI ko shak hai" },
    confidence: { reported: "reported", high: "high", medium: "medium", low: "low" },
    confidenceLabel: "Confidence",
    lines: (s, e) => (s === e ? `Line ${s}` : `Lines ${s}-${e}`),
    line: (n) => `Line ${n}`,
    trigger: { selection: "Aapka selection", auto: "Save ke baad" },
    noFindings: "Yahan koi tool error ya jaana-pehchana risky pattern nahi mila. Iska matlab ye nahi ki code pakka sahi hai.",
    noRulesFor: (l) => `${l} ke liye abhi pattern checks nahi hain. Tool errors aur AI review phir bhi chalte hain.`,
    forget: "Ye code bhool jao",
    actions: { explain: "Samjhao", hideExplain: "Chhupao", showFix: "Fix dikhao", hideFix: "Fix chhupao", copyFix: "Fix copy karo", copied: "Copy ho gaya", apply: "Fix lagao", ignore: "Ignore" },
    why: "Ye galat kyun ho sakta hai",
    how: "Kaise sudhaarein",
    sideEffects: "Iska kya asar ho sakta hai",
    noSideEffects: "Koi pata nahi, par aas-paas ka code dekh lena.",
    diagnosticWhy: "Aapke editor ke language tools ne is line ko report kiya hai. Upar unka hi message hai.",
    diagnosticHow: "Message padho aur wo line theek karo. AI review ise aur samjha sakta hai.",
    noFixAvailable: "Iska koi safe automatic fix nahi hai.",
    fixTitle: "Suggested badlav",
    fixUnverified: "Verified nahi: is badlav ko chalaya ya test nahi kiya gaya.",
    applyConfirm: "VS Code ye badlav dikhayega aur aapse dobara poochhega. Kuch apne aap save nahi hota, aur undo ho sakta hai.",
    applyGo: "VS Code ko bhejo",
    applyCancel: "Cancel",
    applyWaiting: "VS Code mein aapke jawab ka intezaar hai...",
    applyResult: {
      applied: "VS Code mein lag gaya, abhi save nahi hua. Undo ke liye wahan Ctrl+Z dabao.",
      declined: "Aapne VS Code mein mana kar diya. Kuch nahi badla.",
      stale: "File badal gayi thi, isliye kuch nahi laga. Code dobara analyse karo.",
      not_found: "Wo code theek ek jagah nahi mila, isliye kuch nahi laga.",
    },
    applyFailed: (r) => `Fix bhej nahi paaye: ${r}`,
    ignoredCount: (n) => `${n} ignored`,
    showIgnored: "Dikhao",
    ai: {
      title: "AI review",
      consent: "Ye selected code aapke Claude Code login se Anthropic ko jayega, aur aapki Claude usage lagegi. Claude ko koi tool nahi milta, wo sirf jawab de sakta hai.",
      hiddenNote: (n) => `${n} secret jaisi cheez pehle chhupayi jayegi. Ye perfect nahi hai.`,
      run: "Claude se review karao",
      running: "Claude ye code review kar raha hai...",
      none: "Claude ko is selection mein koi problem nahi mili. Phir bhi kuch chhoot sakta hai.",
      dropped: (n) => `${n} AI jawab hata diye gaye, kyunki unka quote code se match nahi hua.`,
      failed: (r) => `AI review nahi ho paaya: ${r}`,
      languageChanged: "Bhasha badal gayi. Is bhasha mein padhne ke liye review dobara chalao.",
    },
    rules: {
      "assign-in-condition": {
        title: "Condition ke andar assignment",
        why: "Ek = value ko compare nahi karta, badal deta hai. To ye condition shayad wo check nahi kar rahi jo dikhti hai.",
        how: "Compare karne ke liye === use karo. Agar assignment jaan-boojhkar hai, to use double brackets mein rakho.",
        sideEffects: "Agar assignment jaan-boojhkar tha, to variable ab yahan update nahi hoga.",
      },
      "nan-compare": {
        title: "NaN se compare karna kabhi kaam nahi karta",
        why: "NaN kisi ke barabar nahi hota, khud ke bhi nahi. Isliye ye check har baar ek hi jawab deta hai.",
        how: "NaN check karne ke liye Number.isNaN() use karo.",
        sideEffects: "Number.isNaN value ko convert nahi karta, to text par false dega.",
      },
      "self-compare": {
        title: "Value ka khud se comparison",
        why: "Kisi cheez ko khud se compare karne par lagbhag hamesha ek hi jawab aata hai, to shayad ek taraf galat variable hai.",
        how: "Dekho ki aap kin do values ko compare karna chahte the.",
      },
      "loop-off-by-one": {
        title: "Loop ek step zyada chalta hai",
        why: "Position 0 se shuru hoti hai, to aakhri sahi position length - 1 hai. <= se aakhri round aisi position padhta hai jo hai hi nahi.",
        how: "<= ki jagah < use karo.",
        sideEffects: "Loop ek baar kam chalega. Jo code us extra round par depend tha, use dekh lena.",
      },
      "index-at-length": {
        title: "List ke end ke baad padhna",
        why: "Position 0 se shuru hoti hai, to length wali position hoti hi nahi, aur ye hamesha undefined deta hai.",
        how: "Aakhri item ke liye length - 1 use karo.",
        sideEffects: "Ab asli item milega. Khaali list par abhi bhi undefined aayega.",
      },
      "async-foreach": {
        title: "forEach async kaam ka wait nahi karta",
        why: "forEach promises ko ignore karta hai, to aage ka code is kaam ke khatam hone se pehle chal sakta hai, aur errors chhup sakte hain.",
        how: "await ke saath for...of loop use karo, ya map ke saath await Promise.all.",
      },
      "empty-catch": {
        title: "Errors chupchap ignore ho rahe hain",
        why: "Ye khaali catch har error chhupa deta hai, to failure pakadna aur debug karna bahut mushkil ho jata hai.",
        how: "Error ko log ya handle karo. Agar ignore karna jaan-boojhkar hai, to comment mein wajah likho.",
      },
      eval: {
        title: "eval unsafe code chala sakta hai",
        why: "eval text ko code ki tarah chalata hai. Agar us text ka koi hissa user se aaye, to wo kuch bhi chala sakta hai.",
        how: "eval se bacho. Data ke liye JSON.parse, aur behaviour chunne ke liye lookup table use karo.",
      },
      "hardcoded-secret": {
        title: "Code mein shayad secret likha hai",
        why: "Code mein likha password ya key koi bhi padh sakta hai jiske paas code ho, aur wo git history mein reh jata hai.",
        how: "Ise environment variable ya secret store mein rakho, aur agar asli hai to purani value badal do.",
      },
      "py-mutable-default": {
        title: "Shared default list ya dict",
        why: "Python ye default sirf ek baar banata hai, to ek call mein kiya badlav agli call mein bhi rehta hai.",
        how: "Default None rakho, aur list ya dict function ke andar banao.",
      },
      "py-bare-except": {
        title: "Har error pakad leta hai",
        why: "Khaali except Ctrl+C jaisi cheezein bhi pakad leta hai aur asli bugs chhupa sakta hai.",
        how: "Jo error expect karte ho wahi pakdo, ya kam se kam Exception.",
        sideEffects: "Ctrl+C aur program exit ab yahan pakde nahi jayenge, program ruk jayega.",
      },
      "py-none-compare": {
        title: "None se compare ke liye is use karo",
        why: "== ko class badal sakti hai aur galat jawab mil sakta hai. None ko identity se check karna chahiye.",
        how: "is None ya is not None use karo.",
      },
      "py-eval": {
        title: "eval ya exec unsafe code chala sakte hain",
        why: "Ye text ko code ki tarah chalate hain. Agar us text ka koi hissa user se aaye, to wo kuch bhi chala sakta hai.",
        how: "Inse bacho. Data ke liye ast.literal_eval ya json.loads use karo.",
      },
    },
  },
};

export const dictionaries: Record<Language, Dict> = { en, hinglish };
