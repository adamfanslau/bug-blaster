import { audio } from "../engine/audio";
import type { Game } from "../engine/game";
import type { Scene } from "../engine/scene";
import { quip, verdictFor } from "../content/quips";
import { Background } from "../render/background";
import { formatDuration, roundRectPath } from "../render/drawUtils";
import { drawMuteButton, hitTest, MUTE_RECT, touchModeDefault } from "../render/hud";
import { H, updateCamera, W } from "../render/projection";
import { storyPoints, type RunStats } from "../systems/stats";
import { PlayScene } from "./playScene";
import { TitleScene } from "./titleScene";

const MONO = "ui-monospace, Menlo, Consolas, monospace";
const INPUT_LOCK = 0.6;

/** The "Production Incident Postmortem": stats plus snark. */
export class GameOverScene implements Scene {
  private readonly bg = new Background();
  private lock = INPUT_LOCK;
  private lines: string[] = [];

  constructor(
    private readonly game: Game,
    private readonly stats: RunStats,
  ) {}

  enter(): void {
    this.lock = INPUT_LOCK;
    audio.gameOver();
    audio.music.setTempo(96);
    const verdicts = verdictFor(this.stats);
    this.lines = [...verdicts.slice(0, 2), quip("postmortem"), quip("postmortem")].slice(0, 3);
  }

  exit(): void {}

  update(dt: number): void {
    const { input } = this.game;
    this.lock -= dt;
    updateCamera(0, dt);
    this.bg.update(dt * 0.3, 0);

    const clickedMute =
      (input.mouseClicked && hitTest(MUTE_RECT, input.mouseX, input.mouseY)) ||
      (input.touchStarted && hitTest(MUTE_RECT, input.touchX, input.touchY));
    if (input.wasPressed("KeyM") || clickedMute) {
      audio.toggleMute();
      audio.uiClick();
      return;
    }
    if (this.lock > 0) return;

    if (input.wasPressed("Escape")) {
      this.game.setScene(new TitleScene(this.game));
      return;
    }
    if (
      input.wasPressed("Space") ||
      input.wasPressed("Enter") ||
      input.wasPressed("KeyR") ||
      input.mouseClicked ||
      input.touchStarted
    ) {
      audio.uiClick();
      audio.music.setTempo(128);
      this.game.setScene(new PlayScene(this.game));
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const time = this.game.time;
    const s = this.stats;
    this.bg.render(ctx, time);

    ctx.save();
    ctx.fillStyle = "rgba(5,6,15,0.7)";
    ctx.fillRect(0, 0, W, H);

    const px = 70;
    const py = 44;
    const pw = W - 140;
    const ph = H - 88;
    ctx.fillStyle = "rgba(10,12,24,0.92)";
    roundRectPath(ctx, px, py, pw, ph, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,59,92,0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#ff3b5c";
    ctx.fillRect(px + 8, py, pw - 16, 3);

    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.font = `bold 20px ${MONO}`;
    ctx.fillStyle = "#ff6b6b";
    ctx.fillText("PRODUCTION INCIDENT POSTMORTEM", px + 28, py + 22);
    ctx.textAlign = "right";
    ctx.font = `bold 14px ${MONO}`;
    ctx.fillStyle = "#8b9bb4";
    ctx.fillText(`INC-${String(s.score).padStart(6, "0")}`, MUTE_RECT.x - 16, py + 26);

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(139,155,180,0.35)";
    ctx.fillRect(px + 28, py + 54, pw - 56, 1);

    const sprint = s.firstSprint === s.lastSprint ? `Sprint ${s.firstSprint}` : `Sprints ${s.firstSprint}–${s.lastSprint}`;
    const rows: [string, string, string, string][] = [
      [sprint, "", "duration:", formatDuration(s.time)],
      ["bugs squashed:", String(s.squashed), "bugs shipped to prod:", String(s.shipped)],
      ["longest streak:", String(s.longestStreak), "peak rage:", `${Math.round(s.peakRage * 100)}%`],
      ["ultimates fired:", String(s.ultimatesFired), "story points closed:", `${storyPoints(s)} (estimated: 3)`],
    ];
    ctx.font = `14px ${MONO}`;
    let y = py + 70;
    for (const [k1, v1, k2, v2] of rows) {
      ctx.fillStyle = "#8b9bb4";
      ctx.fillText(k1, px + 28, y);
      ctx.fillStyle = "#e6edf3";
      ctx.fillText(v1, px + 210, y);
      ctx.fillStyle = "#8b9bb4";
      ctx.fillText(k2, px + 400, y);
      ctx.fillStyle = "#e6edf3";
      ctx.fillText(v2, px + 620, y);
      y += 24;
    }

    ctx.fillStyle = "rgba(139,155,180,0.35)";
    ctx.fillRect(px + 28, y + 6, pw - 56, 1);
    y += 22;
    ctx.font = `bold 14px ${MONO}`;
    for (const line of this.lines) {
      ctx.fillStyle = "#ffb347";
      ctx.fillText(">", px + 28, y);
      ctx.fillStyle = "#e6edf3";
      ctx.fillText(line, px + 48, y);
      y += 24;
    }

    ctx.textAlign = "center";
    ctx.font = `bold 30px ${MONO}`;
    ctx.fillStyle = "#7ee7ff";
    ctx.fillText(`final score: ${s.score}`, W / 2, py + ph - 92);

    const blink = this.lock > 0 ? 0 : 0.55 + 0.45 * Math.sin(time * 4);
    ctx.globalAlpha = blink;
    ctx.font = `bold 14px ${MONO}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(
      touchModeDefault() ? "tap to reopen the ticket" : "press R / Space to reopen the ticket · Esc for the title",
      W / 2,
      py + ph - 44,
    );
    ctx.restore();

    drawMuteButton(ctx, audio.muted);
  }
}
