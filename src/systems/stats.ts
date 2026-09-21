import type { BugKindId } from "../content/bugKinds";

export interface RunStats {
  score: number;
  squashed: number;
  shipped: number;
  streak: number;
  longestStreak: number;
  peakRage: number;
  ultimatesFired: number;
  time: number;
  firstSprint: number;
  lastSprint: number;
  byKind: Record<BugKindId, number>;
}

export function newRunStats(firstSprint: number): RunStats {
  return {
    score: 0,
    squashed: 0,
    shipped: 0,
    streak: 0,
    longestStreak: 0,
    peakRage: 0,
    ultimatesFired: 0,
    time: 0,
    firstSprint,
    lastSprint: firstSprint,
    byKind: { syntax: 0, null: 0, offbyone: 0, race: 0, memleak: 0, womm: 0 },
  };
}

/** Bumps the kill streak; returns the new streak length. */
export function recordKill(stats: RunStats, kind: BugKindId): number {
  stats.squashed += 1;
  stats.byKind[kind] += 1;
  stats.streak += 1;
  stats.longestStreak = Math.max(stats.longestStreak, stats.streak);
  return stats.streak;
}

export function recordMiss(stats: RunStats): void {
  stats.shipped += 1;
  stats.streak = 0;
}

const FIB = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

/** Story points are always a Fibonacci number. It's the law. */
export function storyPoints(stats: RunStats): number {
  const raw = Math.round(stats.squashed * 0.8 + stats.longestStreak);
  let best = FIB[0];
  for (const f of FIB) if (Math.abs(f - raw) <= Math.abs(best - raw)) best = f;
  return best;
}
