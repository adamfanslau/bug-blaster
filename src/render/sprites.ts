import { makeCanvas, rgba } from "./drawUtils";

/**
 * Offscreen sprite cache. Everything here is rendered once and then drawn with
 * drawImage, so the hot loop never allocates gradients or uses shadowBlur.
 */

const glowCache = new Map<string, HTMLCanvasElement>();

/** 64x64 soft radial glow in `color`; draw at 2-3x the entity radius with "lighter". */
export function glowSprite(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (!c) {
    const size = 64;
    const [canvas, ctx] = makeCanvas(size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, rgba(color, 0.9));
    g.addColorStop(0.35, rgba(color, 0.35));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    c = canvas;
    glowCache.set(color, c);
  }
  return c;
}

let shadow: HTMLCanvasElement | null = null;

/** Soft black disc for floor shadows; scale non-uniformly to squash onto the floor. */
export function shadowSprite(): HTMLCanvasElement {
  if (!shadow) {
    const size = 64;
    const [canvas, ctx] = makeCanvas(size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(0,0,0,0.85)");
    g.addColorStop(0.6, "rgba(0,0,0,0.5)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    shadow = canvas;
  }
  return shadow;
}

const bodyCache = new Map<string, HTMLCanvasElement>();
export const BODY_SPRITE_PX = 128;

/**
 * Shaded ellipsoid body: offset radial highlight, darker underside, rim light and a
 * specular dot. `aspect` is height/width. The sprite is BODY_SPRITE_PX wide.
 */
export function bodySprite(key: string, hi: string, base: string, lo: string, aspect: number): HTMLCanvasElement {
  let c = bodyCache.get(key);
  if (c) return c;
  const w = BODY_SPRITE_PX;
  const h = Math.ceil(w * aspect);
  const [canvas, ctx] = makeCanvas(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 2;
  const ry = h / 2 - 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(-rx * 0.3, -rx * 0.35, rx * 0.05, 0, 0, rx);
  g.addColorStop(0, hi);
  g.addColorStop(0.55, base);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Darker underside.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 0.55, rx * 1.1, ry * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Rim light top-left.
  ctx.strokeStyle = rgba(hi, 0.7);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 1.5, ry - 1.5, 0, Math.PI * 1.05, Math.PI * 1.6);
  ctx.stroke();

  // Specular.
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.35, cy - ry * 0.4, rx * 0.2, ry * 0.14, -0.4, 0, Math.PI * 2);
  ctx.fill();

  c = canvas;
  bodyCache.set(key, c);
  return c;
}

const glyphCache = new Map<string, HTMLCanvasElement>();

/** A single monospace glyph pre-rendered in `color` at `px` size (for particles and bits). */
export function glyphSprite(ch: string, color: string, px: number): HTMLCanvasElement {
  const key = `${ch}|${color}|${px}`;
  let c = glyphCache.get(key);
  if (!c) {
    const size = Math.ceil(px * 1.4);
    const [canvas, ctx] = makeCanvas(size, size);
    ctx.font = `bold ${px}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(ch, size / 2, size / 2);
    c = canvas;
    glyphCache.set(key, c);
  }
  return c;
}

let vignette: HTMLCanvasElement | null = null;
let vignetteKey = "";

/** Full-screen red vignette used on life loss; rebuilt when the canvas size changes. */
export function vignetteSprite(w: number, h: number): HTMLCanvasElement {
  const key = `${Math.round(w)}x${Math.round(h)}`;
  if (!vignette || vignetteKey !== key) {
    const [canvas, ctx] = makeCanvas(w, h);
    const r = Math.max(w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.3, w / 2, h / 2, r * 0.8);
    g.addColorStop(0, "rgba(255,40,40,0)");
    g.addColorStop(1, "rgba(255,40,40,0.85)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    vignette = canvas;
    vignetteKey = key;
  }
  return vignette;
}
