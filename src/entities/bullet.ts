import { lerp, smoothstep } from "../render/drawUtils";
import { makeProjected, project, type Projected, W } from "../render/projection";
import { QUALITY } from "../render/quality";
import { glowSprite, shadowSprite } from "../render/sprites";
import { VP } from "../render/viewport";

const VZ = -1.1; // depth units per second, toward the horizon
export const BULLET_START_Z = 0.97;
const START_ALT = 1.1; // laptop-lid height
const BODY_ALT = 0.12; // bug body height

/** A code fix fired down the corridor; shrinks into the vanishing point. */
export class Bullet {
  alive = true;
  z = BULLET_START_Z;
  alt = START_ALT;
  readonly screen: Projected = makeProjected();

  private readonly trail: Float32Array;
  private head = 0;
  private trailCount = 0;

  constructor(
    public lane: number,
    private readonly vLane: number,
  ) {
    this.trail = new Float32Array(QUALITY.trailLen * 2);
  }

  get baseRadius(): number {
    return 5 * VP.world;
  }

  get screenRadius(): number {
    return this.baseRadius * this.screen.scale;
  }

  update(dt: number): void {
    this.z += VZ * dt;
    this.lane += this.vLane * dt;
    // Fly down from the laptop screen to bug height as it travels.
    this.alt = lerp(BODY_ALT, START_ALT, smoothstep(0.3, 1, this.z));
    if (this.z <= 0) this.alive = false;
  }

  project(): void {
    // Remember the previous screen position (skip the never-projected initial zeros).
    if (this.screen.scale > 0) {
      const len = this.trail.length / 2;
      this.trail[this.head * 2] = this.screen.x;
      this.trail[this.head * 2 + 1] = this.screen.y;
      this.head = (this.head + 1) % len;
      this.trailCount = Math.min(this.trailCount + 1, len);
    }
    project(this.lane, this.z, this.alt, this.screen);
    // Off the sides of the screen: gone. (Screen-space, so column shots toward an edge survive.)
    const margin = this.screenRadius * 4 + 8;
    if (this.screen.x < -margin || this.screen.x > W + margin) this.alive = false;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { x, y, floorY, scale } = this.screen;
    const r = Math.max(1.2, this.screenRadius);
    ctx.save();

    // Faint floor shadow sells the altitude.
    ctx.globalAlpha = 0.35 * scale;
    ctx.drawImage(shadowSprite(), x - r * 1.5, floorY - r * 0.4, r * 3, r * 0.8);

    // Comet trail: shrinking circles from oldest to newest.
    const len = this.trail.length / 2;
    ctx.fillStyle = "#7ee7ff";
    for (let i = 0; i < this.trailCount; i++) {
      const idx = (this.head - this.trailCount + i + len) % len;
      const k = (i + 1) / (this.trailCount + 1);
      ctx.globalAlpha = 0.45 * k;
      ctx.beginPath();
      ctx.arc(this.trail[idx * 2], this.trail[idx * 2 + 1], r * k, 0, Math.PI * 2);
      ctx.fill();
    }

    if (QUALITY.glow) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.8;
      const gs = r * 6;
      ctx.drawImage(glowSprite("#7ee7ff"), x - gs / 2, y - gs / 2, gs, gs);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
