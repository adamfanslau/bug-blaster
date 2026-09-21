import type { Rage } from "../systems/rage";
import { clamp, clearTextMeasureCache, fitFontPx, measureTextWidth, MONO, rand, roundRectPath } from "./drawUtils";
import { H, W } from "./projection";
import { onViewportResize, VP, type ViewportState } from "./viewport";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const hitTest = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export interface HudFonts {
  label: number;
  small: number;
  score: number;
  mute: number;
  button: number;
}

export interface HudLayout {
  score: Rect;
  lives: Rect;
  rage: Rect;
  mute: Rect;
  rageButton: Rect;
  /** Portrait: HUD rows stacked, mute at the end of the rage row. */
  stacked: boolean;
  /** HUD scale (VP.ui). */
  u: number;
  f: HudFonts;
  muteLabel: (muted: boolean) => string;
}

/**
 * Computes every HUD rectangle for the current viewport. In fixed desktop mode this
 * evaluates to the original constants exactly (score 14,12,220,52 and so on).
 */
export function layoutHud(vp: ViewportState): HudLayout {
  const u = vp.ui;
  const fluid = vp.mode === "fluid";
  const L = vp.safe.left + 14;
  const T = vp.safe.top + 12;
  const Rt = vp.w - vp.safe.right - 14;
  const B = vp.h - vp.safe.bottom - 12;
  const f: HudFonts = { label: 10 * u, small: 11 * u, score: 26 * u, mute: 11 * u, button: 20 * u };
  const muteLabel =
    vp.touch && fluid
      ? (m: boolean): string => (m ? "SOUND OFF" : "SOUND ON")
      : (m: boolean): string => (m ? "[M] sound: off" : "[M] sound: on");

  if (!vp.portrait) {
    const score: Rect = { x: L, y: T, w: 220 * u, h: 52 * u };
    const lives: Rect = { x: Rt - 190 * u, y: T, w: 190 * u, h: 52 * u };
    const scoreRight = score.x + score.w;
    const gap = lives.x - scoreRight;
    const rw = Math.min(340 * u, gap - 16);
    // Screen-centered (desktop stays put), clamped into the gap so a wide score panel can't overlap it.
    const rx = clamp((vp.w - rw) / 2, scoreRight + 8, lives.x - 8 - rw);
    const rage: Rect = { x: rx, y: T, w: rw, h: 36 * u };
    const mute: Rect = { x: Rt - 108 * u, y: T + 58 * u, w: 108 * u, h: vp.touch ? Math.max(24 * u, 36) : 24 * u };
    let rageButton: Rect;
    if (!fluid) {
      rageButton = { x: vp.w - 150, y: vp.h - 76, w: 132, h: 56 };
    } else {
      const s = Math.max(72, 56 * u);
      rageButton = { x: Rt - s, y: vp.h * 0.55 - s / 2, w: s, h: s };
    }
    return { score, lives, rage, mute, rageButton, stacked: false, u, f, muteLabel };
  }

  const inner = Rt - L;
  const score: Rect = { x: L, y: T, w: 0.52 * inner - 4, h: 52 * u };
  const livesX = score.x + score.w + 8;
  const lives: Rect = { x: livesX, y: T, w: Rt - livesX, h: 52 * u };
  const row2 = T + 52 * u + 8;
  const mute: Rect = { x: Rt - 84 * u, y: row2, w: 84 * u, h: 36 * u };
  const rage: Rect = { x: L, y: row2, w: inner - mute.w - 8, h: 36 * u };
  const s = Math.max(72, 60 * u);
  const rageButton: Rect = { x: Rt - s, y: B - s, w: s, h: s };
  return { score, lives, rage, mute, rageButton, stacked: true, u, f, muteLabel };
}

export let HUD: HudLayout = layoutHud(VP);

const strokeCache = new Map<string, CanvasGradient>();
let barGradient: CanvasGradient | null = null;
let barGradientKey = "";

onViewportResize((vp) => {
  HUD = layoutHud(vp);
  strokeCache.clear();
  barGradient = null;
  barGradientKey = "";
  clearTextMeasureCache();
});

function panelStroke(ctx: CanvasRenderingContext2D, r: Rect): CanvasGradient {
  const key = `${r.x},${r.y},${r.w}`;
  let g = strokeCache.get(key);
  if (!g) {
    g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y);
    g.addColorStop(0, "rgba(0,229,255,0.7)");
    g.addColorStop(1, "rgba(255,60,200,0.7)");
    strokeCache.set(key, g);
  }
  return g;
}

export function drawPanel(ctx: CanvasRenderingContext2D, r: Rect, accent?: string): void {
  const u = HUD.u;
  ctx.fillStyle = "rgba(10,12,24,0.74)";
  roundRectPath(ctx, r.x, r.y, r.w, r.h, 6 * u);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = panelStroke(ctx, r);
  ctx.stroke();
  ctx.fillStyle = accent ?? "rgba(126,231,255,0.8)";
  ctx.fillRect(r.x + 6 * u, r.y, r.w - 12 * u, 2);
}

export function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px = HUD.f.label): void {
  ctx.font = `bold ${px}px ${MONO}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#8b9bb4";
  ctx.fillText(text.split("").join(" "), x, y);
}

export function drawMuteButton(ctx: CanvasRenderingContext2D, muted: boolean): void {
  const r = HUD.mute;
  ctx.save();
  ctx.fillStyle = "rgba(10,12,24,0.74)";
  roundRectPath(ctx, r.x, r.y, r.w, r.h, 5 * HUD.u);
  ctx.fill();
  ctx.strokeStyle = muted ? "rgba(255,107,107,0.6)" : "rgba(126,231,255,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `bold ${HUD.f.mute}px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = muted ? "#ff6b6b" : "#b8c4d0";
  ctx.fillText(HUD.muteLabel(muted), r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.restore();
}

/** Coffee mug icon; `full` mugs steam, lost mugs are dim and cracked. */
export function drawMug(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, full: boolean, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = full ? 1 : 0.3;
  ctx.fillStyle = full ? "#e6edf3" : "#6b7280";
  roundRectPath(ctx, -s * 0.5, -s * 0.5, s, s, s * 0.15);
  ctx.fill();
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = s * 0.18;
  ctx.beginPath();
  ctx.arc(s * 0.6, 0, s * 0.3, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.fillStyle = "#3b2416";
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.42, s * 0.42, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  if (full) {
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const o of [-s * 0.18, s * 0.18]) {
      const ph = time * 2.5 + o;
      ctx.moveTo(o, -s * 0.6);
      ctx.quadraticCurveTo(o + Math.sin(ph) * s * 0.2, -s * 0.9, o + Math.sin(ph + 1) * s * 0.15, -s * 1.15);
    }
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#0b0d14";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.4);
    ctx.lineTo(s * 0.1, -s * 0.05);
    ctx.lineTo(-s * 0.05, s * 0.15);
    ctx.lineTo(s * 0.15, s * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

/** Title text drawn thrice (red/cyan/white) with an occasional horizontal glitch slice. */
export function drawGlitchTitle(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, time: number): void {
  ctx.save();
  ctx.font = `bold ${px}px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const wob = Math.sin(time * 7) * 0.6;
  const off = Math.max(2, px * 0.047);
  ctx.fillStyle = "#ff3b5c";
  ctx.fillText(text, x - off - wob, y + 1);
  ctx.fillStyle = "#00e5ff";
  ctx.fillText(text, x + off + wob, y - 1);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x, y);
  if (time % 1.3 < 0.08) {
    const bandY = y - px / 2 + rand(0, px);
    ctx.beginPath();
    ctx.rect(0, bandY, W, px * 0.14);
    ctx.clip();
    ctx.fillStyle = "#0b0d14";
    ctx.fillRect(0, bandY, W, px * 0.14);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x + rand(-10, 10), y);
  }
  ctx.restore();
}

export interface HudState {
  score: number;
  lives: number;
  maxLives: number;
  sprint: number;
  rage: Rage;
  muted: boolean;
  touchMode: boolean;
  time: number;
}

/** In-game overlay: score, lives as coffee mugs, the RAGE meter, and touch buttons. */
export class Hud {
  private displayScore = 0;
  private bumpT = 0;
  private lastScore = 0;
  private mugWobbleT = 0;

  update(dt: number, score: number): void {
    if (score !== this.lastScore) {
      this.bumpT = 1;
      this.lastScore = score;
    }
    this.displayScore += (score - this.displayScore) * Math.min(1, dt * 10);
    if (Math.abs(score - this.displayScore) < 0.6) this.displayScore = score;
    this.bumpT = Math.max(0, this.bumpT - 4 * dt);
    this.mugWobbleT = Math.max(0, this.mugWobbleT - dt);
  }

  onLifeLost(): void {
    this.mugWobbleT = 0.3;
  }

  render(ctx: CanvasRenderingContext2D, s: HudState): void {
    const L = HUD;
    const u = L.u;
    ctx.save();

    // Score.
    drawPanel(ctx, L.score);
    drawLabel(ctx, "SCORE", L.score.x + 12 * u, L.score.y + 9 * u);
    const scoreText = String(Math.round(this.displayScore));
    const sprintText = `SPRINT ${s.sprint}`;
    const sprintFont = `bold ${L.f.small}px ${MONO}`;
    const sprintW = measureTextWidth(ctx, sprintText, sprintFont);
    const scorePx = fitFontPx(ctx, scoreText, "bold", L.f.score, L.score.w - 24 * u - sprintW - 8 * u);
    const scale = 1 + 0.3 * this.bumpT * this.bumpT;
    ctx.save();
    ctx.translate(L.score.x + 12 * u, L.score.y + 40 * u);
    ctx.scale(scale, scale);
    ctx.font = `bold ${scorePx}px ${MONO}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = this.bumpT > 0 ? "#7ee7ff" : "#e6edf3";
    ctx.fillText(scoreText, 0, 0);
    ctx.restore();
    ctx.font = sprintFont;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffb347";
    ctx.fillText(sprintText, L.score.x + L.score.w - 12 * u, L.score.y + 40 * u);

    // Lives.
    drawPanel(ctx, L.lives, "rgba(255,179,71,0.8)");
    drawLabel(ctx, L.stacked ? "COFFEE" : "COFFEE LEFT", L.lives.x + 12 * u, L.lives.y + 9 * u);
    const mugStep = L.stacked ? (L.lives.w - 24 * u) / s.maxLives : 32 * u;
    const mugSize = L.stacked ? Math.min(13 * u, mugStep * 0.4) : 13 * u;
    const mugFirst = L.stacked ? 12 * u + mugStep / 2 : 24 * u;
    for (let i = 0; i < s.maxLives; i++) {
      const full = i < s.lives;
      const mx = L.lives.x + mugFirst + i * mugStep;
      const my = L.lives.y + 36 * u;
      ctx.save();
      if (i === s.lives && this.mugWobbleT > 0) {
        ctx.translate(mx, my);
        ctx.rotate(Math.sin(s.time * 30) * 0.25 * (this.mugWobbleT / 0.3));
        ctx.translate(-mx, -my);
      }
      drawMug(ctx, mx, my, mugSize, full, s.time);
      ctx.restore();
    }

    // Rage meter.
    const ready = s.rage.state === "ready";
    const pulse = 0.5 + 0.5 * Math.sin(s.time * 8);
    drawPanel(ctx, L.rage, ready ? `rgba(255,46,136,${0.5 + 0.5 * pulse})` : "rgba(255,46,136,0.8)");
    drawLabel(ctx, "RAGE", L.rage.x + 12 * u, L.rage.y + 8 * u);
    const barX = L.rage.x + 56 * u;
    const barW = L.rage.w - 68 * u;
    const barH = 12 * u;
    const barY = L.rage.y + (L.rage.h - barH) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRectPath(ctx, barX, barY, barW, barH, 4 * u);
    ctx.fill();
    const fill = s.rage.state === "firing" ? s.rage.firingProgress : s.rage.value;
    if (fill > 0) {
      const key = `${barX},${barW}`;
      if (!barGradient || barGradientKey !== key) {
        barGradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        barGradient.addColorStop(0, "#ffb347");
        barGradient.addColorStop(1, "#ff2e88");
        barGradientKey = key;
      }
      ctx.fillStyle = barGradient;
      roundRectPath(ctx, barX, barY, Math.max(barH, barW * fill), barH, 4 * u);
      ctx.fill();
    }
    if (ready) {
      ctx.strokeStyle = `rgba(255,255,255,${0.4 + 0.6 * pulse})`;
      ctx.lineWidth = 1.5 + pulse;
      roundRectPath(ctx, barX - 1, barY - 1, barW + 2, barH + 2, 5 * u);
      ctx.stroke();
      ctx.font = `bold ${L.f.small}px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#ffffff";
      const msg = s.touchMode ? "RAGE READY: tap the button" : "RAGE READY: Shift / E";
      const cx = L.stacked ? L.rage.x + L.rage.w / 2 : W / 2;
      ctx.fillText(msg, cx, L.rage.y + L.rage.h + 4);
    }

    drawMuteButton(ctx, s.muted);

    if (s.touchMode) {
      const r = L.rageButton;
      ctx.globalAlpha = ready ? 1 : 0.45;
      ctx.fillStyle = ready ? `rgba(255,46,136,${0.55 + 0.4 * pulse})` : "rgba(10,12,24,0.74)";
      roundRectPath(ctx, r.x, r.y, r.w, r.h, 10 * u);
      ctx.fill();
      ctx.strokeStyle = ready ? "#ffffff" : "rgba(255,46,136,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = `bold ${fitFontPx(ctx, "RAGE", "bold", L.f.button, r.w - 12)}px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("RAGE", r.x + r.w / 2, r.y + r.h / 2 + 1);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}

export const touchModeDefault = (): boolean => VP.touch;

// Keep H referenced for consumers that import it alongside W (fixed layout uses vp.h directly).
void H;
