import { QUALITY } from "./quality";

/**
 * Owns canvas sizing. Two modes:
 *  - "fixed": desktop. Logical 960x540, CSS-scaled to fit (today's letterboxing).
 *  - "fluid": phones/tablets/small windows. Canvas fills the visual viewport and
 *    logical units equal CSS px, so a 12px font is 12 readable pixels.
 * Nothing here imports game modules, so anything may subscribe without cycles.
 */

export type ViewMode = "fixed" | "fluid";

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewportState {
  mode: ViewMode;
  /** Logical size used by all drawing code. */
  w: number;
  h: number;
  /** Canvas element size in CSS px. */
  cssW: number;
  cssH: number;
  /** Backing-store ratio actually applied. */
  dpr: number;
  portrait: boolean;
  /** HUD / text / button scale. */
  ui: number;
  /** Entity size multiplier at z = 1. */
  world: number;
  /** Coarse pointer device (touch-first UI). */
  touch: boolean;
  safe: Insets;
  /** Bumps whenever w/h/ui/world/portrait/safe change. */
  version: number;
}

const FIXED_W = 960;
const FIXED_H = 540;
const FLUID_MAX_SIDE = 700;
const MAX_BACKING_PX = 3.2e6;

export const VP: ViewportState = {
  mode: "fixed",
  w: FIXED_W,
  h: FIXED_H,
  cssW: FIXED_W,
  cssH: FIXED_H,
  dpr: 1,
  portrait: false,
  ui: 1,
  world: 1,
  touch: false,
  safe: { top: 0, right: 0, bottom: 0, left: 0 },
  version: 0,
};

type Listener = (vp: ViewportState) => void;
const listeners = new Set<Listener>();
let canvasEl: HTMLCanvasElement | null = null;
let probe: HTMLElement | null = null;
let lastQualityLevel = QUALITY.level;
const coarseQuery =
  typeof matchMedia === "function" ? matchMedia("(hover: none) and (pointer: coarse)") : null;

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function onViewportResize(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function initViewport(canvas: HTMLCanvasElement): void {
  canvasEl = canvas;
  probe = document.getElementById("safe-probe");
  const onChange = (): void => resizeViewport();
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", () => {
    resizeViewport();
    // iOS reports stale dimensions inside the synchronous handler.
    requestAnimationFrame(onChange);
  });
  window.visualViewport?.addEventListener("resize", onChange);
  coarseQuery?.addEventListener?.("change", onChange);
  resizeViewport(true);
}

function readSafe(w: number, h: number): Insets {
  if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 };
  const cs = getComputedStyle(probe);
  const px = (v: string): number => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    top: clamp(px(cs.paddingTop), 0, h * 0.15),
    right: clamp(px(cs.paddingRight), 0, w * 0.15),
    bottom: clamp(px(cs.paddingBottom), 0, h * 0.15),
    left: clamp(px(cs.paddingLeft), 0, w * 0.15),
  };
}

function qualityDprCap(): number {
  return QUALITY.level >= 2 ? 2 : QUALITY.level === 1 ? 1.5 : 1.25;
}

/** Recomputes mode, logical size, scales, DPR and the canvas element size. */
export function resizeViewport(force = false): void {
  if (!canvasEl) return;
  const vv = window.visualViewport;
  const vw = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
  const vh = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
  const coarse = coarseQuery?.matches ?? false;
  const fluid = coarse || Math.min(vw, vh) < FLUID_MAX_SIDE;

  let w: number, h: number, cssW: number, cssH: number, ui: number, world: number, portrait: boolean;
  let safe: Insets;
  if (!fluid) {
    w = FIXED_W;
    h = FIXED_H;
    const scale = Math.min(1, (vw - 18) / FIXED_W, (vh - 70) / FIXED_H);
    cssW = Math.max(160, FIXED_W * scale);
    cssH = Math.max(90, FIXED_H * scale);
    ui = 1;
    world = 1;
    portrait = false;
    safe = { top: 0, right: 0, bottom: 0, left: 0 };
  } else {
    cssW = vw;
    cssH = vh;
    w = vw;
    h = vh;
    portrait = h > w;
    const short = Math.min(w, h);
    ui = coarse ? clamp(short / 300, 1.2, 1.6) : clamp(short / 540, 1, 1.3);
    world = portrait ? clamp(w / 420, 0.8, 1.5) : clamp(Math.min(h / 540, w / 960), 0.8, 1.6);
    safe = readSafe(w, h);
  }

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  dpr = Math.min(dpr, Math.sqrt(MAX_BACKING_PX / (cssW * cssH)));
  dpr = Math.min(dpr, qualityDprCap());
  dpr = Math.max(1, dpr);

  document.body.classList.toggle("fluid", fluid);
  canvasEl.style.width = `${cssW}px`;
  canvasEl.style.height = `${cssH}px`;
  const bw = Math.round(cssW * dpr);
  const bh = Math.round(cssH * dpr);
  if (canvasEl.width !== bw) canvasEl.width = bw;
  if (canvasEl.height !== bh) canvasEl.height = bh;

  const changed =
    force ||
    VP.w !== w ||
    VP.h !== h ||
    VP.ui !== ui ||
    VP.world !== world ||
    VP.portrait !== portrait ||
    VP.mode !== (fluid ? "fluid" : "fixed") ||
    VP.touch !== coarse ||
    VP.safe.top !== safe.top ||
    VP.safe.right !== safe.right ||
    VP.safe.bottom !== safe.bottom ||
    VP.safe.left !== safe.left;

  VP.mode = fluid ? "fluid" : "fixed";
  VP.w = w;
  VP.h = h;
  VP.cssW = cssW;
  VP.cssH = cssH;
  VP.dpr = dpr;
  VP.portrait = portrait;
  VP.ui = ui;
  VP.world = world;
  VP.touch = coarse;
  VP.safe = safe;

  if (changed) {
    VP.version += 1;
    for (const fn of listeners) fn(VP);
  }
}

/** Call at the top of each frame: applies the DPR transform and reacts to quality drops. */
export function beginFrame(ctx: CanvasRenderingContext2D): void {
  if (QUALITY.level !== lastQualityLevel) {
    lastQualityLevel = QUALITY.level;
    resizeViewport();
  }
  ctx.setTransform(VP.dpr, 0, 0, VP.dpr, 0, 0);
}
