import type { Input } from "../engine/input";

const SPEED = 320;
const STARTING_LIVES = 5;

/** The developer: moves along the bottom of the screen and aims at the cursor. */
export class Player {
  x: number;
  y: number;
  readonly radius = 16;
  lives = STARTING_LIVES;

  constructor(
    x: number,
    y: number,
    private readonly worldWidth: number,
  ) {
    this.x = x;
    this.y = y;
  }

  update(dt: number, input: Input): void {
    if (input.touchActive) {
      const dx = input.touchX - this.x;
      const step = SPEED * dt;
      this.x += Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
    } else {
      let dir = 0;
      if (input.isDown("ArrowLeft") || input.isDown("KeyA")) dir -= 1;
      if (input.isDown("ArrowRight") || input.isDown("KeyD")) dir += 1;
      this.x += dir * SPEED * dt;
    }
    this.x = Math.max(this.radius, Math.min(this.worldWidth - this.radius, this.x));
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Placeholder art: a dev with a laptop, drawn as simple shapes.
    ctx.fillStyle = "#58a6ff";
    ctx.beginPath();
    ctx.arc(this.x, this.y - 10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8b949e";
    ctx.fillRect(this.x - 14, this.y + 2, 28, 10);
  }
}
