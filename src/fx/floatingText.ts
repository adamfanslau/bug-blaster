export type TextStyle = "score" | "quip" | "miss" | "shrug" | "rage" | "streak";

interface StyleDef {
  font: string;
  color: string;
  stroke?: string;
  vy: number;
  life: number;
  scaleIn: boolean;
}

const MONO = "ui-monospace, Menlo, Consolas, monospace";

const STYLES: Record<TextStyle, StyleDef> = {
  score: { font: `bold 18px ${MONO}`, color: "#7ee7ff", vy: -55, life: 0.8, scaleIn: true },
  quip: { font: `bold 15px ${MONO}`, color: "#e6edf3", stroke: "rgba(0,0,0,0.8)", vy: -32, life: 1.7, scaleIn: false },
  miss: { font: `bold 17px ${MONO}`, color: "#ff6b6b", stroke: "rgba(0,0,0,0.85)", vy: -26, life: 2.1, scaleIn: false },
  shrug: { font: `bold 20px ${MONO}`, color: "#ffe08a", stroke: "rgba(0,0,0,0.85)", vy: -40, life: 1.2, scaleIn: true },
  rage: { font: `bold 22px ${MONO}`, color: "#ff2e88", stroke: "rgba(0,0,0,0.85)", vy: -18, life: 2.4, scaleIn: true },
  streak: { font: `bold 20px ${MONO}`, color: "#ffb347", stroke: "rgba(0,0,0,0.85)", vy: -22, life: 2.2, scaleIn: true },
};

interface Floater {
  x: number;
  y: number;
  text: string;
  style: StyleDef;
  life: number;
  max: number;
}

const MAX_LIVE = 12;

/** Rising, fading text anchored in world space (drawn inside the camera shake). */
export class FloatingTexts {
  private items: Floater[] = [];

  add(x: number, y: number, text: string, style: TextStyle): void {
    if (this.items.length >= MAX_LIVE) this.items.shift();
    const def = STYLES[style];
    this.items.push({ x, y, text, style: def, life: def.life, max: def.life });
  }

  clear(): void {
    this.items = [];
  }

  update(dt: number): void {
    for (const f of this.items) {
      f.life -= dt;
      f.y += f.style.vy * dt;
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
      ctx.font = f.style.font;
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
