import { Camera } from "../render/camera";
import { rgba } from "../render/drawUtils";
import { H, W } from "../render/projection";
import { QUALITY } from "../render/quality";
import { glowSprite } from "../render/sprites";
import { FloatingTexts, type TextStyle } from "./floatingText";
import { ParticleSystem } from "./particles";

interface Ring {
  x: number;
  y: number;
  color: string;
  maxR: number;
  life: number;
  max: number;
}

interface Muzzle {
  x: number;
  y: number;
  life: number;
}

interface Banner {
  text: string;
  sub: string | null;
  color: string;
  life: number;
  max: number;
  big: boolean;
}

const MONO = "ui-monospace, Menlo, Consolas, monospace";

/**
 * Facade over particles, floating text, rings, banners and the camera so the
 * scene can say what happened ("bug exploded here") instead of how to draw it.
 */
export class Effects {
  readonly camera = new Camera();
  private readonly particles = new ParticleSystem(300);
  private readonly texts = new FloatingTexts();
  private rings: Ring[] = [];
  private muzzles: Muzzle[] = [];
  private banners: Banner[] = [];

  explode(x: number, y: number, color: string, hi: string, scale: number): void {
    const n = Math.round(12 + 6 * scale);
    this.particles.burst(x, y, color, n, 260 * scale + 60, 7 * scale + 2);
    this.particles.burst(x, y, hi, Math.round(n / 3), 180 * scale + 40, 4 * scale + 1, 0.45);
    this.particles.glyphs(x, y, 4 + Math.round(2 * scale), 8 + 8 * scale, "#e6edf3");
    this.rings.push({ x, y, color: hi, maxR: 40 * scale + 8, life: 0.25, max: 0.25 });
    this.camera.addTrauma(0.15 * scale);
  }

  /** Smaller pop for a non-lethal hit. */
  puff(x: number, y: number, color: string, scale: number): void {
    this.particles.burst(x, y, color, 5, 140 * scale + 30, 4 * scale + 1, 0.4);
    this.rings.push({ x, y, color, maxR: 22 * scale + 6, life: 0.18, max: 0.18 });
  }

  drip(x: number, y: number, color: string, size: number): void {
    this.particles.drip(x, y, color, size);
  }

  muzzleFlash(x: number, y: number): void {
    this.muzzles.push({ x, y, life: 0.09 });
    this.particles.sparks(x, y, 3, "#bfffff");
  }

  floatText(x: number, y: number, text: string, style: TextStyle): void {
    this.texts.add(x, y, text, style);
  }

  /** Centered screen-space message (sprint banners, unlocks). */
  banner(text: string, sub: string | null = null, color = "#7ee7ff", seconds = 2.2): void {
    this.banners = this.banners.filter((b) => b.big);
    this.banners.push({ text, sub, color, life: seconds, max: seconds, big: false });
  }

  /** Huge screen-space message (ultimates, SEGFAULT). */
  bigText(text: string, sub: string | null, color: string, seconds = 1.6): void {
    this.banners = this.banners.filter((b) => !b.big);
    this.banners.push({ text, sub, color, life: seconds, max: seconds, big: true });
  }

  shake(amount: number): void {
    this.camera.addTrauma(amount);
  }

  flash(color: string, alpha: number, seconds: number): void {
    this.camera.flash(color, alpha, seconds);
  }

  vignette(): void {
    this.camera.vignette();
  }

  update(dt: number, time: number): void {
    this.particles.update(dt);
    this.texts.update(dt);
    this.camera.update(dt, time);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const m of this.muzzles) m.life -= dt;
    this.muzzles = this.muzzles.filter((m) => m.life > 0);
    for (const b of this.banners) b.life -= dt;
    this.banners = this.banners.filter((b) => b.life > 0);
  }

  /** World-space effects; call inside camera.begin/end. */
  renderWorld(ctx: CanvasRenderingContext2D): void {
    this.particles.render(ctx);

    if (this.rings.length > 0 || this.muzzles.length > 0) {
      ctx.save();
      ctx.lineCap = "round";
      for (const r of this.rings) {
        const t = 1 - r.life / r.max;
        ctx.globalAlpha = 1 - t;
        ctx.lineWidth = 3 * (1 - t) + 1;
        ctx.strokeStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.maxR * Math.sqrt(t), 0, Math.PI * 2);
        ctx.stroke();
        if (QUALITY.glow && t < 0.5) {
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.6 * (1 - t * 2);
          const s = r.maxR * 2.2;
          ctx.drawImage(glowSprite(r.color), r.x - s / 2, r.y - s / 2, s, s);
          ctx.globalCompositeOperation = "source-over";
        }
      }
      for (const m of this.muzzles) {
        const t = m.life / 0.09;
        ctx.globalAlpha = t;
        ctx.strokeStyle = "#bfffff";
        ctx.lineWidth = 3 * t;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.45;
          const len = 10 + 12 * t;
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x + Math.cos(a) * len, m.y + Math.sin(a) * len);
        }
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(m.x, m.y, 14 * t, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    this.texts.render(ctx);
  }

  /** Screen-space effects; call after the HUD, outside the shake. */
  renderScreen(ctx: CanvasRenderingContext2D): void {
    if (this.banners.length > 0) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const base = ctx.getTransform();
      for (const b of this.banners) {
        const age = b.max - b.life;
        const fadeIn = Math.min(1, age / 0.15);
        const fadeOut = Math.min(1, b.life / 0.4);
        const alpha = Math.min(fadeIn, fadeOut);
        if (b.big) {
          const pop = 1 + 0.35 * Math.max(0, 1 - age / 0.25) ** 2;
          const y = H * 0.47;
          ctx.globalAlpha = alpha * 0.55;
          ctx.fillStyle = "#05060f";
          ctx.fillRect(0, y - 46 * pop, W, 92 * pop);
          ctx.globalAlpha = alpha;
          ctx.setTransform(base);
          ctx.translate(W / 2, y);
          ctx.scale(pop, pop);
          ctx.font = `bold 46px ${MONO}`;
          ctx.fillStyle = b.color;
          ctx.fillText(b.text, -3, -6);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(b.text, 0, -8);
          ctx.setTransform(base);
          if (b.sub && age > 0.3) {
            ctx.globalAlpha = alpha * Math.min(1, (age - 0.3) / 0.2);
            ctx.font = `bold 16px ${MONO}`;
            ctx.fillStyle = "#e6edf3";
            ctx.fillText(b.sub, W / 2, y + 30);
          }
        } else {
          const y = H * 0.3;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = rgba("#05060f", 0.7);
          ctx.fillRect(W / 2 - 300, y - 24, 600, b.sub ? 60 : 44);
          ctx.fillStyle = b.color;
          ctx.fillRect(W / 2 - 300, y - 24, 600, 2);
          ctx.font = `bold 20px ${MONO}`;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(b.text, W / 2, y - 2);
          if (b.sub) {
            ctx.font = `13px ${MONO}`;
            ctx.fillStyle = "#b8c4d0";
            ctx.fillText(b.sub, W / 2, y + 20);
          }
        }
      }
      ctx.restore();
    }
    this.camera.renderScreen(ctx);
  }
}
