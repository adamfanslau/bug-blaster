import { H, W } from "./projection";
import { vignetteSprite } from "./sprites";
import { VP } from "./viewport";

interface Flash {
  color: string;
  alpha: number;
  life: number;
  max: number;
}

/** Trauma-based screen shake plus full-screen flashes drawn on the HUD layer. */
export class Camera {
  trauma = 0;
  ox = 0;
  oy = 0;
  private flashes: Flash[] = [];
  private vignetteT = 0;

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  flash(color: string, alpha: number, seconds: number): void {
    this.flashes.push({ color, alpha, life: seconds, max: seconds });
  }

  vignette(seconds = 0.6): void {
    this.vignetteT = Math.max(this.vignetteT, seconds);
  }

  update(dt: number, time: number): void {
    this.trauma = Math.max(0, this.trauma - 1.8 * dt);
    const shake = this.trauma * this.trauma * 14 * VP.world;
    // Two incommensurate sines read as noise and cost nothing.
    this.ox = shake * (Math.sin(time * 41) * 0.6 + Math.sin(time * 67.3) * 0.4);
    this.oy = shake * (Math.sin(time * 37.7 + 2) * 0.6 + Math.sin(time * 59.1) * 0.4);
    for (const f of this.flashes) f.life -= dt;
    this.flashes = this.flashes.filter((f) => f.life > 0);
    this.vignetteT = Math.max(0, this.vignetteT - dt);
  }

  begin(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(Math.round(this.ox), Math.round(this.oy));
  }

  end(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }

  /** Flashes and vignette; call after the HUD, outside the shake. */
  renderScreen(ctx: CanvasRenderingContext2D): void {
    if (this.flashes.length === 0 && this.vignetteT <= 0) return;
    ctx.save();
    for (const f of this.flashes) {
      ctx.globalAlpha = f.alpha * (f.life / f.max);
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.vignetteT > 0) {
      ctx.globalAlpha = Math.min(1, this.vignetteT / 0.4);
      ctx.drawImage(vignetteSprite(W, H), 0, 0);
    }
    ctx.restore();
  }
}
