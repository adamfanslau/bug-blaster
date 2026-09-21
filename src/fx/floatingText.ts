import { clamp, fitFontPx, measureTextWidth, MONO } from "../render/drawUtils";
import { W } from "../render/projection";
import { VP } from "../render/viewport";

export type TextStyle = "score" | "quip" | "miss" | "shrug" | "rage" | "streak";

interface StyleDef {
  px: number;
  color: string;
  stroke?: string;
  vy: number;
  life: number;
  scaleIn: boolean;
}

const STYLES: Record<TextStyle, StyleDef> = {
  score: { px: 18, color: "#7ee7ff", vy: -55, life: 0.8, scaleIn: true },
  quip: { px: 15, color: "#e6edf3", stroke: "rgba(0,0,0,0.8)", vy: -32, life: 1.7, scaleIn: false },
  miss: { px: 17, color: "#ff6b6b", stroke: "rgba(0,0,0,0.85)", vy: -26, life: 2.1, scaleIn: false },
  shrug: { px: 20, color: "#ffe08a", stroke: "rgba(0,0,0,0.85)", vy: -40, life: 1.2, scaleIn: true },
  rage: { px: 22, color: "#ff2e88", stroke: "rgba(0,0,0,0.85)", vy: -18, life: 2.4, scaleIn: true },
  streak: { px: 20, color: "#ffb347", stroke: "rgba(0,0,0,0.85)", vy: -22, life: 2.2, scaleIn: true },
};

interface Floater {
  x: number;
  y: number;
  text: string;
  style: StyleDef;
  life: number;
  max: number;
  /** Resolved on first render: font size fitted to the screen and x clamped to keep it on screen. */
  font: string | null;
}

const MAX_LIVE = 12;

/** Rising, fading text anchored in world space (drawn inside the camera shake). */
export class FloatingTexts {
  private items: Floater[] = [];

  add(x: number, y: number, text: string, style: TextStyle): void {
    if (this.items.length >= MAX_LIVE) this.items.shift();
    const def = STYLES[style];
    this.items.push({ x, y, text, style: def, life: def.life, max: def.life, font: null });
  }

  clear(): void {
    this.items = [];
  }

  update(dt: number): void {
    const u = VP.ui;
    for (const f of this.items) {
      f.life -= dt;
      f.y += f.style.vy * u * dt;
    }
    this.items = this.items.filter((f) => f.life > 0);
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.items.length === 0) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    const base = ctx.getTransform();
    for (const f of this.items) {
      if (!f.font) {
        const px = fitFontPx(ctx, f.text, "bold", Math.round(f.style.px * VP.ui), W - 24);
        f.font = `bold ${px}px ${MONO}`;
        const half = measureTextWidth(ctx, f.text, f.font) / 2;
        f.x = clamp(f.x, half + 8, W - half - 8);
      }
      const age = f.max - f.life;
      const t = f.life / f.max;
      ctx.globalAlpha = t < 0.35 ? t / 0.35 : 1;
      let scale = 1;
      if (f.style.scaleIn && age < 0.18) {
        const k = age / 0.18;
        scale = 1.6 - 0.6 * k * (2 - k); // pop in from big
      }
      ctx.setTransform(base);
      ctx.translate(f.x, f.y);
      ctx.scale(scale, scale);
      ctx.font = f.font;
      if (f.style.stroke) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = f.style.stroke;
        ctx.strokeText(f.text, 0, 0);
      }
      ctx.fillStyle = f.style.color;
      ctx.fillText(f.text, 0, 0);
    }
    ctx.restore();
  }
}
