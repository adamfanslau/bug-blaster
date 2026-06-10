export type BugKind = "syntax" | "logic" | "memory-leak";

const BUG_COLORS: Record<BugKind, string> = {
  syntax: "#3fb950",
  logic: "#d29922",
  "memory-leak": "#f85149",
};

/** A computer bug crawling down the screen toward the player. */
export class Bug {
  alive = true;
  readonly radius = 12;

  constructor(
    public x: number,
    public y: number,
    readonly kind: BugKind,
    private readonly speed: number,
  ) {}

  update(dt: number): void {
    this.y += this.speed * dt;
    this.x += Math.sin(this.y / 40) * 60 * dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = BUG_COLORS[this.kind];
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.radius, this.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs
    ctx.strokeStyle = BUG_COLORS[this.kind];
    ctx.beginPath();
    for (const side of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        ctx.moveTo(this.x, this.y + i * 4);
        ctx.lineTo(this.x + side * (this.radius + 5), this.y + i * 6);
      }
    }
    ctx.stroke();
  }
}
