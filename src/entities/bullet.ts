const SPEED = 600;

/** A code fix fired by the player toward a bug. */
export class Bullet {
  alive = true;
  readonly radius = 4;
  private readonly vx: number;
  private readonly vy: number;

  constructor(
    public x: number,
    public y: number,
    angle: number,
  ) {
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#e6edf3";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
