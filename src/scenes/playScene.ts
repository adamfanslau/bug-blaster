import type { Game } from "../engine/game";
import type { Scene } from "../engine/scene";
import { Bug, type BugKind } from "../entities/bug";
import { Bullet } from "../entities/bullet";
import { Player } from "../entities/player";

const BUG_KINDS: BugKind[] = ["syntax", "logic", "memory-leak"];
const SPAWN_INTERVAL = 1.2;
const TOUCH_FIRE_INTERVAL = 0.25;

export class PlayScene implements Scene {
  private player!: Player;
  private bugs: Bug[] = [];
  private bullets: Bullet[] = [];
  private spawnTimer = 0;
  private touchFireTimer = 0;
  private score = 0;
  private gameOver = false;

  constructor(private readonly game: Game) {}

  enter(): void {
    this.player = new Player(this.game.width / 2, this.game.height - 40, this.game.width);
    this.bugs = [];
    this.bullets = [];
    this.spawnTimer = 0;
    this.touchFireTimer = 0;
    this.score = 0;
    this.gameOver = false;
  }

  exit(): void {}

  update(dt: number): void {
    const { input } = this.game;

    if (this.gameOver) {
      if (
        input.wasPressed("Space") ||
        input.wasPressed("Enter") ||
        input.wasPressed("KeyR") ||
        input.mouseClicked ||
        input.touchStarted
      ) {
        this.enter();
      }
      return;
    }

    this.player.update(dt, input);

    if (input.mouseClicked || input.wasPressed("Space")) {
      const angle = input.mouseRecentlyMoved()
        ? Math.atan2(input.mouseY - this.player.y, input.mouseX - this.player.x)
        : -Math.PI / 2; // straight up
      this.bullets.push(new Bullet(this.player.x, this.player.y, angle));
    }

    if (input.touchActive) {
      this.touchFireTimer -= dt;
      if (this.touchFireTimer <= 0) {
        this.touchFireTimer = TOUCH_FIRE_INTERVAL;
        this.bullets.push(new Bullet(this.player.x, this.player.y, -Math.PI / 2));
      }
    } else {
      this.touchFireTimer = 0; // first shot fires instantly on the next touch
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_INTERVAL;
      const kind = BUG_KINDS[Math.floor(Math.random() * BUG_KINDS.length)];
      const x = 40 + Math.random() * (this.game.width - 80);
      this.bugs.push(new Bug(x, -20, kind, 60 + Math.random() * 80));
    }

    for (const bullet of this.bullets) bullet.update(dt);
    for (const bug of this.bugs) bug.update(dt);

    for (const bug of this.bugs) {
      for (const bullet of this.bullets) {
        if (!bug.alive || !bullet.alive) continue;
        const dx = bug.x - bullet.x;
        const dy = bug.y - bullet.y;
        const hit = dx * dx + dy * dy < (bug.radius + bullet.radius) ** 2;
        if (hit) {
          bug.alive = false;
          bullet.alive = false;
          this.score += 10;
        }
      }
      if (bug.alive && bug.y > this.game.height + bug.radius) {
        bug.alive = false;
        this.player.lives = Math.max(0, this.player.lives - 1);
      }
    }

    if (this.player.lives <= 0) {
      this.gameOver = true;
    }

    this.bullets = this.bullets.filter(
      (b) => b.alive && b.x > -20 && b.x < this.game.width + 20 && b.y > -20,
    );
    this.bugs = this.bugs.filter((b) => b.alive);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, this.game.width, this.game.height);

    for (const bug of this.bugs) bug.render(ctx);
    for (const bullet of this.bullets) bullet.render(ctx);
    this.player.render(ctx);

    ctx.fillStyle = "#e6edf3";
    ctx.font = "16px monospace";
    ctx.fillText(`score: ${this.score}`, 12, 24);
    ctx.fillText(`lives: ${this.player.lives}`, 12, 44);

    if (this.gameOver) {
      ctx.fillStyle = "rgba(13, 17, 23, 0.75)";
      ctx.fillRect(0, 0, this.game.width, this.game.height);
      ctx.fillStyle = "#e6edf3";
      ctx.textAlign = "center";
      ctx.font = "32px monospace";
      ctx.fillText("GAME OVER", this.game.width / 2, this.game.height / 2 - 24);
      ctx.font = "16px monospace";
      ctx.fillText(`final score: ${this.score}`, this.game.width / 2, this.game.height / 2 + 8);
      ctx.fillText(
        "press Space / R — or tap — to restart",
        this.game.width / 2,
        this.game.height / 2 + 36,
      );
      ctx.textAlign = "left"; // ctx state persists across frames; the HUD assumes left
    }
  }
}
