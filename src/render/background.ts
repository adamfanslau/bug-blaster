import { makeCanvas, pick, rand } from "./drawUtils";
import { FLOOR_Y, floorYAt, getVpX, H, HORIZON_Y, NEAR_HALF_W, R, W } from "./projection";
import { QUALITY } from "./quality";
import { glyphSprite } from "./sprites";

interface Bit {
  x: number;
  y: number;
  speed: number;
  sprite: HTMLCanvasElement;
  bucket: number;
  parallax: number;
}

const GRID_SPACING = (R - 1) / 12; // world depth between horizontal lines
const GRID_SPEED = 1.4; // spacings per second, toward the camera
const BIT_GLYPHS = ["0", "1", ";", "{", "}", "/", "<", ">", "=", "λ"];

/** Synthwave corridor: cached sky, scrolling perspective grid, fog and parallax code bits. */
export class Background {
  private readonly sky: HTMLCanvasElement;
  private readonly fogStrip: HTMLCanvasElement;
  private phase = 0;
  private bits: Bit[] = [];
  private playerLane = 0;

  constructor() {
    this.sky = Background.renderSky();
    this.fogStrip = Background.renderFog();
    for (let i = 0; i < QUALITY.bits; i++) {
      const far = i % 3 !== 0;
      this.bits.push({
        x: Math.random() * W,
        y: rand(10, HORIZON_Y - 12),
        speed: far ? rand(4, 9) : rand(10, 18),
        sprite: glyphSprite(pick(BIT_GLYPHS), far ? "#3a4a6a" : "#5c7ea8", far ? 10 : 13),
        bucket: i % 3,
        parallax: far ? 12 : 30,
      });
    }
  }

  private static renderSky(): HTMLCanvasElement {
    const [c, ctx] = makeCanvas(W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    sky.addColorStop(0, "#05060f");
    sky.addColorStop(0.6, "#120a2a");
    sky.addColorStop(1, "#3a1650");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, HORIZON_Y);

    // Retro sun with dark scanline stripes, clipped to the sky.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, HORIZON_Y);
    ctx.clip();
    const sunR = 78;
    const sun = ctx.createLinearGradient(0, HORIZON_Y - sunR, 0, HORIZON_Y + 10);
    sun.addColorStop(0, "#ffb347");
    sun.addColorStop(1, "#ff2e88");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(W / 2, HORIZON_Y + 6, sunR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a0b2e";
    for (let i = 0; i < 6; i++) {
      const y = HORIZON_Y - 8 - i * 11;
      ctx.fillRect(W / 2 - sunR, y, sunR * 2, 3 + i * 0.6);
    }
    ctx.restore();

    // Horizon glow band.
    const glow = ctx.createLinearGradient(0, HORIZON_Y - 50, 0, HORIZON_Y + 50);
    glow.addColorStop(0, "rgba(255,80,220,0)");
    glow.addColorStop(0.5, "rgba(255,80,220,0.5)");
    glow.addColorStop(1, "rgba(255,80,220,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, HORIZON_Y - 50, W, 100);

    // Floor base.
    const floor = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
    floor.addColorStop(0, "#1a0b2e");
    floor.addColorStop(0.25, "#0a0616");
    floor.addColorStop(1, "#05030c");
    ctx.fillStyle = floor;
    ctx.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);

    ctx.fillStyle = "#ff7ae0";
    ctx.fillRect(0, HORIZON_Y, W, 1);
    return c;
  }

  private static renderFog(): HTMLCanvasElement {
    const height = 120;
    const [c, ctx] = makeCanvas(W, height);
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, "rgba(26,11,46,0.95)");
    g.addColorStop(0.4, "rgba(26,11,46,0.5)");
    g.addColorStop(1, "rgba(26,11,46,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, height);
    return c;
  }

  update(dt: number, playerLane: number): void {
    this.phase = (this.phase + dt * GRID_SPEED) % 1;
    this.playerLane = playerLane;
    for (const b of this.bits) {
      b.x += b.speed * dt;
      if (b.x > W + 10) b.x -= W + 20;
    }
  }

  render(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.drawImage(this.sky, 0, 0);

    // Parallax code bits above the horizon, alpha bucketed to limit state changes.
    ctx.save();
    for (let bucket = 0; bucket < 3; bucket++) {
      ctx.globalAlpha = 0.45 + 0.3 * Math.sin(time * 1.7 + bucket * 2.1);
      for (const b of this.bits) {
        if (b.bucket !== bucket) continue;
        let x = b.x - this.playerLane * b.parallax;
        if (x < -10) x += W + 20;
        else if (x > W + 10) x -= W + 20;
        ctx.drawImage(b.sprite, x, b.y);
      }
    }
    ctx.restore();

    const vpX = getVpX();

    // Horizontal grid lines at evenly spaced world depths, sliding toward the camera.
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(0,229,255,0.35)";
    ctx.beginPath();
    for (let k = -3; k <= 14; k++) {
      const depth = 1 + (k - this.phase) * GRID_SPACING;
      const z = (R - depth) / (R - 1);
      const y = floorYAt(z);
      if (y <= HORIZON_Y + 1 || y > H + 2) continue;
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();

    // Lines of constant lane, radiating from the vanishing point.
    const tBottom = (H - HORIZON_Y) / (FLOOR_Y - HORIZON_Y);
    const sBottom = 1 / R + (1 - 1 / R) * tBottom;
    const sTop = 1 / R;
    ctx.strokeStyle = "rgba(255,60,200,0.28)";
    ctx.beginPath();
    for (let i = -8; i <= 8; i++) {
      const lane = i * 0.25;
      ctx.moveTo(vpX + lane * NEAR_HALF_W * sTop, HORIZON_Y);
      ctx.lineTo(vpX + lane * NEAR_HALF_W * sBottom, H);
    }
    ctx.stroke();
    ctx.restore();

    ctx.drawImage(this.fogStrip, 0, HORIZON_Y);
  }
}
