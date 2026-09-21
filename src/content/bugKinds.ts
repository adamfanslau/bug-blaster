export type BugKindId = "syntax" | "null" | "offbyone" | "race" | "memleak" | "womm";
export type Movement = "wobble" | "steps" | "jitter" | "grow";

export interface BugKindDef {
  id: BugKindId;
  label: string;
  /** Alternate label the bug flips to periodically. */
  labelAlt?: string;
  hi: string;
  base: string;
  lo: string;
  /** Body height / width. */
  aspect: number;
  hp: number;
  /** World depth units per second at difficulty 1. */
  speedZ: [min: number, max: number];
  points: number;
  weight: number;
  unlockScore: number;
  movement: Movement;
  wobbleAmp: number;
  wobbleFreq: number;
  shrugsFirstHit?: boolean;
  splitsOnDeath?: boolean;
  /** Hz of the thud in audio.squish(). */
  squishPitch: number;
}

export const BUG_KINDS: readonly BugKindDef[] = [
  {
    id: "syntax",
    label: "missing ;",
    hi: "#9dff9d",
    base: "#3fb950",
    lo: "#1d6b2e",
    aspect: 0.72,
    hp: 1,
    speedZ: [0.16, 0.22],
    points: 10,
    weight: 4,
    unlockScore: 0,
    movement: "wobble",
    wobbleAmp: 0.25,
    wobbleFreq: 1.6,
    squishPitch: 180,
  },
  {
    id: "null",
    label: "undefined is not a function",
    labelAlt: "null",
    hi: "#e6e6ff",
    base: "#a371f7",
    lo: "#4b2a8a",
    aspect: 0.8,
    hp: 1,
    speedZ: [0.1, 0.14],
    points: 15,
    weight: 3,
    unlockScore: 0,
    movement: "wobble",
    wobbleAmp: 0.6,
    wobbleFreq: 0.7,
    squishPitch: 140,
  },
  {
    id: "offbyone",
    label: "off-by-one",
    hi: "#ffe08a",
    base: "#d29922",
    lo: "#7a5200",
    aspect: 0.7,
    hp: 1,
    speedZ: [0.13, 0.13],
    points: 20,
    weight: 2,
    unlockScore: 60,
    movement: "steps",
    wobbleAmp: 0,
    wobbleFreq: 0,
    splitsOnDeath: true,
    squishPitch: 160,
  },
  {
    id: "memleak",
    label: "memory leak",
    hi: "#ff9d95",
    base: "#f85149",
    lo: "#7a1c17",
    aspect: 0.85,
    hp: 3,
    speedZ: [0.11, 0.11],
    points: 40,
    weight: 2,
    unlockScore: 130,
    movement: "grow",
    wobbleAmp: 0.15,
    wobbleFreq: 0.8,
    squishPitch: 70,
  },
  {
    id: "race",
    label: "race condition",
    labelAlt: "condition race",
    hi: "#9ee8ff",
    base: "#58a6ff",
    lo: "#1b4d8a",
    aspect: 0.5,
    hp: 1,
    speedZ: [0.13, 0.21],
    points: 30,
    weight: 2,
    unlockScore: 230,
    movement: "jitter",
    wobbleAmp: 0.4,
    wobbleFreq: 4.5,
    squishPitch: 220,
  },
  {
    id: "womm",
    label: "works on my machine",
    hi: "#fff4c2",
    base: "#e3b341",
    lo: "#8a6a10",
    aspect: 0.8,
    hp: 2,
    speedZ: [0.08, 0.12],
    points: 35,
    weight: 1,
    unlockScore: 350,
    movement: "wobble",
    wobbleAmp: 0.2,
    wobbleFreq: 1.1,
    shrugsFirstHit: true,
    squishPitch: 100,
  },
];

export const KIND_BY_ID: Record<BugKindId, BugKindDef> = Object.fromEntries(
  BUG_KINDS.map((k) => [k.id, k]),
) as Record<BugKindId, BugKindDef>;

export interface Difficulty {
  level: number;
  sprint: number;
  spawnInterval: number;
  speedMult: number;
  kinds: BugKindDef[];
}

export const FIRST_SPRINT = 47;

export function difficultyFor(score: number): Difficulty {
  const level = Math.floor(score / 100);
  return {
    level,
    sprint: FIRST_SPRINT + level,
    spawnInterval: Math.max(0.35, 1.2 * 0.9 ** level),
    speedMult: Math.min(2.2, 1 + level * 0.07),
    kinds: BUG_KINDS.filter((k) => k.unlockScore <= score),
  };
}

export function pickKind(kinds: readonly BugKindDef[]): BugKindDef {
  const total = kinds.reduce((sum, k) => sum + k.weight, 0);
  let r = Math.random() * total;
  for (const k of kinds) {
    r -= k.weight;
    if (r <= 0) return k;
  }
  return kinds[kinds.length - 1];
}
