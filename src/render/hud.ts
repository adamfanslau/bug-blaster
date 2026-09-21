import type { Rage } from "../systems/rage";
import { rand, roundRectPath } from "./drawUtils";
import { H, W } from "./projection";
import { QUALITY } from "./quality";

const MONO = "ui-monospace, Menlo, Consolas, monospace";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const hitTest = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const MUTE_RECT: Rect = { x: W - 122, y: 70, w: 108, h: 24 };
export const RAGE_BUTTON_RECT: Rect = { x: W - 150, y: H - 76, w: 132, h: 56 };

const SCORE_RECT: Rect = { x: 14, y: 12, w: 220, h: 52 };
const LIVES_RECT: Rect = { x: W - 14 - 190, y: 12, w: 190, h: 52 };
const RAGE_RECT: Rect = { x: W / 2 - 170, y: 12, w: 340, h: 36 };

const strokeCache = new Map<string, CanvasGradient>();

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
  ctx.fillStyle = "rgba(10,12,24,0.74)";
  roundRectPath(ctx, r.x, r.y, r.w, r.h, 6);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = panelStroke(ctx, r);
  ctx.stroke();
  ctx.fillStyle = accent ?? "rgba(126,231,255,0.8)";
  ctx.fillRect(r.x + 6, r.y, r.w - 12, 2);
}

export function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.font = `bold 10px ${MONO}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#8b9bb4";
  ctx.fillText(text.split("").join(" "), x, y);
}

export function drawMuteButton(ctx: CanvasRenderingContext2D, muted: boolean): void {
  const r = MUTE_RECT;
  ctx.save();
  ctx.fillStyle = "rgba(10,12,24,0.74)";
  roundRectPath(ctx, r.x, r.y, r.w, r.h, 5);
  ctx.fill();
  ctx.strokeStyle = muted ? "rgba(255,107,107,0.6)" : "rgba(126,231,255,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `bold 11px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = muted ? "#ff6b6b" : "#b8c4d0";
  ctx.fillText(muted ? "[M] sound: off" : "[M] sound: on", r.x + r.w / 2, r.y + r.h / 2 + 1);
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
  ctx.fillStyle = "#ff3b5c";
  ctx.fillText(text, x - 3 - wob, y + 1);
  ctx.fillStyle = "#00e5ff";
  ctx.fillText(text, x + 3 + wob, y - 1);
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
    ctx.save();

    // Score.
    drawPanel(ctx, SCORE_RECT);
    drawLabel(ctx, "SCORE", SCORE_RECT.x + 12, SCORE_RECT.y + 9);
    const scale = 1 + 0.3 * this.bumpT * this.bumpT;
    ctx.save();
    ctx.translate(SCORE_RECT.x + 12, SCORE_RECT.y + 40);
    ctx.scale(scale, scale);
    ctx.font = `bold 26px ${MONO}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = this.bumpT > 0 ? "#7ee7ff" : "#e6edf3";
    ctx.fillText(String(Math.round(this.displayScore)), 0, 0);
    ctx.restore();
    ctx.font = `bold 11px ${MONO}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffb347";
    ctx.fillText(`SPRINT ${s.sprint}`, SCORE_RECT.x + SCORE_RECT.w - 12, SCORE_RECT.y + 40);

    // Lives.
    drawPanel(ctx, LIVES_RECT, "rgba(255,179,71,0.8)");
    drawLabel(ctx, "COFFEE LEFT", LIVES_RECT.x + 12, LIVES_RECT.y + 9);
    for (let i = 0; i < s.maxLives; i++) {
      const full = i < s.lives;
      const mx = LIVES_RECT.x + 24 + i * 32;
      const my = LIVES_RECT.y + 36;
      ctx.save();
      if (i === s.lives && this.mugWobbleT > 0) {
        ctx.translate(mx, my);
        ctx.rotate(Math.sin(s.time * 30) * 0.25 * (this.mugWobbleT / 0.3));
        ctx.translate(-mx, -my);
      }
      drawMug(ctx, mx, my, 13, full, s.time);
      ctx.restore();
    }

    // Rage meter.
    const ready = s.rage.state === "ready";
    const pulse = 0.5 + 0.5 * Math.sin(s.time * 8);
    drawPanel(ctx, RAGE_RECT, ready ? `rgba(255,46,136,${0.5 + 0.5 * pulse})` : "rgba(255,46,136,0.8)");
    drawLabel(ctx, "RAGE", RAGE_RECT.x + 12, RAGE_RECT.y + 8);
    const barX = RAGE_RECT.x + 56;
    const barW = RAGE_RECT.w - 68;
    const barY = RAGE_RECT.y + 12;
    const barH = 12;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRectPath(ctx, barX, barY, barW, barH, 4);
    ctx.fill();
    const fill = s.rage.state === "firing" ? s.rage.firingProgress : s.rage.value;
    if (fill > 0) {
      const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      g.addColorStop(0, "#ffb347");
      g.addColorStop(1, "#ff2e88");
      ctx.fillStyle = g;
      roundRectPath(ctx, barX, barY, Math.max(barH, barW * fill), barH, 4);
      ctx.fill();
    }
    if (ready) {
      ctx.strokeStyle = `rgba(255,255,255,${0.4 + 0.6 * pulse})`;
      ctx.lineWidth = 1.5 + pulse;
      roundRectPath(ctx, barX - 1, barY - 1, barW + 2, barH + 2, 5);
      ctx.stroke();
      ctx.font = `bold 11px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(s.touchMode ? "RAGE READY: tap the button" : "RAGE READY: Shift / E", RAGE_RECT.x + RAGE_RECT.w / 2, RAGE_RECT.y + RAGE_RECT.h + 4);
    }

    drawMuteButton(ctx, s.muted);

    if (s.touchMode) {
      const r = RAGE_BUTTON_RECT;
      ctx.globalAlpha = ready ? 1 : 0.45;
      ctx.fillStyle = ready ? `rgba(255,46,136,${0.55 + 0.4 * pulse})` : "rgba(10,12,24,0.74)";
      roundRectPath(ctx, r.x, r.y, r.w, r.h, 10);
      ctx.fill();
      ctx.strokeStyle = ready ? "#ffffff" : "rgba(255,46,136,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = `bold 20px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("RAGE", r.x + r.w / 2, r.y + r.h / 2 + 1);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}

export const touchModeDefault = (): boolean => QUALITY.mobile;
