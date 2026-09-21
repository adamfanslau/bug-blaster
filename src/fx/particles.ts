import { QUALITY } from "../render/quality";
import { glyphSprite } from "../render/sprites";
import { rand, pick } from "../render/drawUtils";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  sprite: HTMLCanvasElement | null;
  rot: number;
  vrot: number;
  gravity: number;
  drag: number;
}

const GLYPHS = ["0", "1", ";", "{", "}", "/", "<", ">", "=", "!"];

/** Fixed-size pool with swap-remove; never allocates in the hot loop. */
export class ParticleSystem {
  private readonly pool: Particle[] = [];
  count = 0;

  constructor(private readonly capacity: number) {
    for (let i = 0; i < capacity; i++) {
      this.pool.push({
        x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1,
        color: "#fff", sprite: null, rot: 0, vrot: 0, gravity: 0, drag: 0,
      });
    }
  }

  private spawn(): Particle | null {
    const limit = Math.min(this.capacity, QUALITY.maxParticles);
    if (this.count >= limit) return null;
    return this.pool[this.count++];
  }

  /** Colored chunks flying out from a point. */
  burst(x: number, y: number, color: string, n: number, speed: number, size: number, life = 0.7): void {
    for (let i = 0; i < n; i++) {
      const p = this.spawn();
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const v = speed * rand(0.35, 1);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v - speed * 0.25;
      p.life = p.max = life * rand(0.6, 1.1);
      p.size = size * rand(0.5, 1.2);
      p.color = color;
      p.sprite = null;
      p.rot = Math.random() * Math.PI;
      p.vrot = rand(-8, 8);
      p.gravity = 420;
      p.drag = 1.5;
    }
  }

  /** Code-glyph shards ("0", "1", ";" ...) using the pre-rendered atlas. */
  glyphs(x: number, y: number, n: number, px: number, color: string, speed = 220): void {
    for (let i = 0; i < n; i++) {
      const p = this.spawn();
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const v = speed * rand(0.4, 1);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v - speed * 0.4;
      p.life = p.max = rand(0.5, 0.9);
      p.size = px;
      p.color = color;
      p.sprite = glyphSprite(pick(GLYPHS), color, Math.max(8, Math.round(px)));
      p.rot = rand(-0.5, 0.5);
      p.vrot = rand(-6, 6);
      p.gravity = 380;
      p.drag = 1;
    }
  }

  /** Single slow drip (memory leak) that falls to `floorY` and dies. */
  drip(x: number, y: number, color: string, size: number): void {
    const p = this.spawn();
    if (!p) return;
    p.x = x;
    p.y = y;
    p.vx = rand(-8, 8);
    p.vy = 20;
    p.life = p.max = 0.55;
    p.size = size;
    p.color = color;
    p.sprite = null;
    p.rot = 0;
    p.vrot = 0;
    p.gravity = 300;
    p.drag = 0;
  }

  /** Short-lived sparks (muzzle flash). */
  sparks(x: number, y: number, n: number, color: string, scale = 1): void {
    for (let i = 0; i < n; i++) {
      const p = this.spawn();
      if (!p) return;
      const a = -Math.PI / 2 + rand(-0.9, 0.9);
      const v = rand(180, 320) * scale;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.life = p.max = rand(0.12, 0.22);
      p.size = rand(1.5, 3) * scale;
      p.color = color;
      p.sprite = null;
      p.rot = 0;
      p.vrot = 0;
      p.gravity = 200;
      p.drag = 3;
    }
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.count) {
      const p = this.pool[i];
      p.life -= dt;
      if (p.life <= 0) {
        // swap-remove
        this.count--;
        const last = this.pool[this.count];
        this.pool[this.count] = p;
        this.pool[i] = last;
        continue;
      }
      p.vy += p.gravity * dt;
      const k = 1 - Math.min(1, p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      i++;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.count === 0) return;
    ctx.save();
    // Compose on top of whatever transform is active (camera shake) instead of replacing it.
    const base = ctx.getTransform();
    for (let i = 0; i < this.count; i++) {
      const p = this.pool[i];
      const t = p.life / p.max;
      ctx.globalAlpha = t < 0.4 ? t / 0.4 : 1;
      if (p.sprite) {
        const s = p.sprite.width * (0.6 + 0.4 * t);
        ctx.setTransform(base);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.drawImage(p.sprite, -s / 2, -s / 2, s, s);
      } else if (p.size > 3.5) {
        ctx.setTransform(base);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        const s = p.size * (0.5 + 0.5 * t);
        ctx.fillRect(-s / 2, -s / 2, s, s * 0.7);
      } else {
        ctx.setTransform(base);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.restore();
  }
}
