import type { BugKindId } from "./bugKinds";
import type { RunStats } from "../systems/stats";

export type QuipCategory =
  | "kill"
  | "miss"
  | "shrug"
  | "rageReady"
  | "rageNag"
  | "sprint"
  | "title"
  | "postmortem"
  | `kill:${BugKindId}`;

const QUIPS: Record<QuipCategory, readonly string[]> = {
  kill: [
    "FIXED. Ship it.",
    "It was a semicolon.",
    "Closed: works as intended.",
    "Have you tried turning it off and on again?",
    "git blame says it was you.",
    "Marked as duplicate.",
    "Tests pass. Suspicious.",
    "Fixed in 1 line. Took 6 hours.",
    "Deleted the code. Bug gone.",
    "Stack Overflow, I owe you one.",
    "Squashed. The commits too.",
    "LGTM. Merging without reading.",
    "Rubber duck approves.",
    "Closed as 'cannot reproduce'. Because it's dead.",
    "Works now. Nobody touch it.",
    "Refactored. Into the void.",
  ],
  "kill:syntax": [
    "Prettier would've caught that.",
    "One character. One hour.",
    "The compiler was right. Again.",
    "Unexpected token: your face.",
  ],
  "kill:null": [
    "Cannot read property 'life' of undefined.",
    "?. saved the day.",
    "Null. Undefined. Both. Neither.",
    "Billion-dollar mistake, ten-point kill.",
  ],
  "kill:offbyone": [
    "Fixed one, caused another.",
    "Arrays start at 0. Mostly.",
    "<= you monster.",
    "Fencepost, meet fence.",
  ],
  "kill:race": [
    "Finally reproduced it.",
    "Mutex acquired. Bug released.",
    "Just add a sleep(100). Fixed.",
    "Heisenbug observed. Collapsed.",
  ],
  "kill:memleak": [
    "Garbage collected.",
    "free() at last.",
    "Restarted the pod. Root cause: unknown.",
    "OOMKilled. By you.",
  ],
  "kill:womm": [
    "It works on MY machine now.",
    "Dockerized. No more excuses.",
    "Your machine is a liar.",
    "Reproduced. In production. Fixed anyway.",
  ],
  shrug: ["¯\\_(ツ)_/¯", "can't repro", "did you clear your cache?", "works for me"],
  miss: [
    "It's in production now.",
    "Hotfix Friday, 5pm.",
    "PagerDuty intensifies.",
    "Customer found it first.",
    "Sev-1. Enjoy your weekend.",
    "The intern demoed it to the CEO.",
    "It's not a bug, it's a feature. Now.",
    "Rollback? What rollback?",
    "#incidents is on fire.",
    "QA: \"we told you.\"",
    "Status page: \"investigating\".",
    "Dashboards green. Dashboards lying.",
    "Merged without review. Obviously.",
    "Feature flag was ON. In prod. For everyone.",
    "Cache invalidated. Also: your weekend.",
  ],
  rageReady: [
    "RAGE READY. Caps lock engaged.",
    "Keyboard warranty: voided.",
    "Stand-up is cancelled.",
    "Deep breath. ...Nope.",
    "Compiling... anger.",
    "Ticket escalated to: ME.",
    "Coffee: 7. Patience: 0.",
    "Root access. Root problem.",
    "The linter can't stop you now.",
    "Reading the docs was optional. So is mercy.",
  ],
  rageNag: [
    "RAGE READY. Use it. Please.",
    "Still ready. Still angry.",
    "The meter is full. Like your inbox.",
    "Shift. E. Anything. Do it.",
  ],
  sprint: [
    "scope creep detected",
    "the retro changed nothing",
    "velocity is a lie",
    "QA quit",
    "everything is on fire",
    "the PM added \"just one thing\"",
    "stakeholders joined the call",
    "estimates were doubled. Twice.",
  ],
  title: [
    "Sprint 47, the one where everything is on fire",
    "The build is red. You are the CI.",
    "No tests were harmed in the making of this game.",
    "Deadline: yesterday. Coffee: now.",
    "It compiled. That's the release process.",
    "Now with 100% more undefined.",
    "Works on my machine. Let's see about yours.",
  ],
  postmortem: [
    "Root cause: you.",
    "Blameless postmortem. (We're blaming you anyway.)",
    "Severity: yes.",
    "Detection method: customers, on Twitter.",
    "Time to resolution: pending.",
    "Lessons learned: none, historically.",
    "Incident commander: the intern.",
    "Impact: all of it.",
    "Runbook consulted: no. Runbook exists: also no.",
    "Remediation: \"try again\".",
    "Contributing factors: Friday.",
    "Follow-up: schedule a meeting to schedule a meeting.",
    "Status: Monday's problem.",
  ],
};

const lastIndex = new Map<QuipCategory, number>();

/** Random quip from a category, never the same one twice in a row. */
export function quip(category: QuipCategory): string {
  const list = QUIPS[category];
  if (list.length === 1) return list[0];
  let i: number;
  do {
    i = Math.floor(Math.random() * list.length);
  } while (i === lastIndex.get(category));
  lastIndex.set(category, i);
  return list[i];
}

/** 60% kind-specific, 40% generic so flavor lands without repeating too fast. */
export function killQuip(kind: BugKindId): string {
  return Math.random() < 0.6 ? quip(`kill:${kind}`) : quip("kill");
}

export function missQuip(livesLeft: number): string {
  return livesLeft === 1 ? "One life left. Like the on-call engineer." : quip("miss");
}

const STREAK_QUIPS: Record<number, string> = {
  5: "5 in a row. Pairing with yourself.",
  10: "10x developer.",
  20: "Promoted to Staff. No raise.",
  30: "Tech lead. Now you attend meetings.",
  50: "Legend. HR would like a word.",
};

export function streakQuip(streak: number): string | null {
  return STREAK_QUIPS[streak] ?? null;
}

/** Conditional postmortem verdicts based on how the run went. */
export function verdictFor(stats: RunStats): string[] {
  const out: string[] = [];
  if (stats.shipped > stats.squashed) out.push("More bugs shipped than fixed. Promoted to management.");
  if (stats.peakRage >= 1 && stats.ultimatesFired === 0)
    out.push("Rage meter full, never used. Passive-aggressive, classic.");
  if (stats.longestStreak >= 20) out.push("Longest streak: impressive. Please also sleep.");
  if (stats.time < 30) out.push("Incident duration: shorter than the stand-up.");
  if (stats.ultimatesFired >= 3) out.push("Force-pushed 3 times. Your teammates have opinions.");
  return out;
}
