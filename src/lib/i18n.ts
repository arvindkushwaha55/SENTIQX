import type { Language, Status, ToolKind } from "./types";

export interface ApiErrorText {
  what: string;
  meaning: string;
  action: string | null; // null = nothing for the user to do
}

/** One shape for both languages: TypeScript fails the build if either side misses a key. */
export interface Dict {
  tagline: string;
  status: Record<Status, string>;
  statusNone: string;
  monitorBadge: { off: string; on: string; paused: string };
  nav: { history: string; settings: string; back: string };
  controls: { start: string; pause: string; resume: string; stop: string };
  connectorNotReady: string;
  startFailed: (reason: string) => string;
  pickFolderTitle: string;
  projectLabel: string;
  noEventsHint: string;
  pausedNote: string;
  demoBanner: string;
  pin: { on: string; off: string; onHint: string; offHint: string };
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
  preview: { title: string; unavailable: string; hint: string };
  settings: {
    title: string;
    language: string;
    languageHint: string;
    english: string;
    hinglish: string;
    window: string;
    privacy: string;
    local: string;
    external: string;
    noExternalYet: string;
  };
  history: { title: string; empty: string; note: string };
}

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
  nav: { history: "History", settings: "Settings", back: "Back" },
  controls: { start: "Start monitoring", pause: "Pause", resume: "Resume", stop: "Stop" },
  connectorNotReady:
    "SENTIQX could not open its local receiver, so monitoring cannot start.",
  startFailed: (r) => `Could not start monitoring: ${r}`,
  pickFolderTitle: "Choose the project folder to monitor",
  projectLabel: "Project",
  noEventsHint:
    "No events received yet. Send a message to Claude in this project. Some Claude Code versions may not run hooks in the VS Code panel.",
  pausedNote: "Paused. Nothing is recorded until you resume.",
  demoBanner: "DEMO DATA - not real Claude activity",
  pin: {
    on: "Pinned on top",
    off: "Pin on top",
    onHint: "Click to stop staying on top of other windows",
    offHint: "Click to stay on top of other windows",
  },
  consent: {
    title: "Allow monitoring?",
    intro: "SENTIQX will watch only the Claude Code session you choose.",
    monitored: [
      "Which tool Claude is using (for example Write or PowerShell)",
      "Whether a tool succeeded or failed",
      "When Claude asks for permission or finishes",
    ],
    notMonitored: [
      "Other apps or windows",
      "Your screen (no screenshots or recordings)",
      "Your prompts and file contents are not saved",
    ],
    changes:
      "To listen, SENTIQX adds temporary hooks to .claude/settings.local.json in the project you pick, and removes them when you stop or close it.",
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
    hint: "No local development server has been detected. Monitoring does not depend on this.",
  },
  settings: {
    title: "Settings",
    language: "Language",
    languageHint: "Applies to all labels, summaries and error explanations.",
    english: "English",
    hinglish: "Hinglish",
    window: "Window",
    privacy: "Privacy",
    local: "Stays on this computer: activity, session history, settings.",
    external: "Sent outside: nothing, for now.",
    noExternalYet: "AI summaries are off. Summaries are built on this computer from the events only.",
  },
  history: {
    title: "History",
    empty: "No saved sessions yet.",
    note: "Session history will be stored on this computer only, and you will be able to delete it.",
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
  nav: { history: "History", settings: "Settings", back: "Wapas" },
  controls: {
    start: "Monitoring shuru karo",
    pause: "Pause",
    resume: "Resume",
    stop: "Stop",
  },
  connectorNotReady:
    "SENTIQX apna local receiver nahi khol paaya, isliye monitoring shuru nahi ho sakti.",
  startFailed: (r) => `Monitoring shuru nahi ho paayi: ${r}`,
  pickFolderTitle: "Jis project ko monitor karna hai, uska folder chuno",
  projectLabel: "Project",
  noEventsHint:
    "Abhi tak koi event nahi aaya. Is project mein Claude ko ek message bhejo. Kuch Claude Code versions VS Code panel mein hooks nahi chalate.",
  pausedNote: "Paused hai. Resume karne tak kuch record nahi hoga.",
  demoBanner: "DEMO DATA - asli Claude activity nahi hai",
  pin: {
    on: "Upar pinned",
    off: "Upar pin karo",
    onHint: "Dusri windows ke upar rehna band karne ke liye click karo",
    offHint: "Dusri windows ke upar rehne ke liye click karo",
  },
  consent: {
    title: "Monitoring allow karein?",
    intro: "SENTIQX sirf wahi Claude Code session dekhega jo aap chunoge.",
    monitored: [
      "Claude kaunsa tool use kar raha hai (jaise Write ya PowerShell)",
      "Tool safal hua ya fail",
      "Claude kab permission maangta hai ya kaam khatam karta hai",
    ],
    notMonitored: [
      "Dusre apps ya windows",
      "Aapki screen (koi screenshot ya recording nahi)",
      "Aapke prompts aur file ka content save nahi hota",
    ],
    changes:
      "Sunne ke liye SENTIQX aapke chune hue project ki .claude/settings.local.json mein temporary hooks jodta hai, aur Stop karne ya app band karne par unhe hata deta hai.",
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
    hint: "Koi local development server detect nahi hua. Monitoring is par depend nahi karti.",
  },
  settings: {
    title: "Settings",
    language: "Bhasha",
    languageHint: "Sabhi labels, summaries aur error explanations par lagu hota hai.",
    english: "English",
    hinglish: "Hinglish",
    window: "Window",
    privacy: "Privacy",
    local: "Isi computer par rehta hai: activity, session history, settings.",
    external: "Bahar bheja jata hai: abhi kuch nahi.",
    noExternalYet:
      "AI summaries band hain. Summaries isi computer par sirf events se banti hain.",
  },
  history: {
    title: "History",
    empty: "Abhi koi saved session nahi hai.",
    note: "Session history sirf isi computer par save hogi, aur aap use delete kar paoge.",
  },
};

export const dictionaries: Record<Language, Dict> = { en, hinglish };
