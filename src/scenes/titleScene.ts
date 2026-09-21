import { audio } from "../engine/audio";
import type { Game } from "../engine/game";
import type { Scene } from "../engine/scene";
import { BUG_KINDS } from "../content/bugKinds";
import { quip } from "../content/quips";
import { Bug } from "../entities/bug";
import { Background } from "../render/background";
import { pick, rand } from "../render/drawUtils";
import { drawGlitchTitle, drawMuteButton, hitTest, MUTE_RECT, touchModeDefault } from "../render/hud";
import { H, updateCamera, W } from "../render/projection";
import { PlayScene } from "./playScene";

const MONO = "ui-monospace, Menlo, Consolas, monospace";

/** Start card with a snarky subtitle and a few bugs crawling the corridor. */
export class TitleScene implements Scene {
  private readonly bg = new Background();
  private bugs: Bug[] = [];
  private subtitle = "";

  constructor(private readonly game: Game) {}

  enter(): void {
    this.subtitle = quip("title");
    this.bugs = [];
    for (let i = 0; i < 6; i++) {
      const bug = new Bug(rand(-0.8, 0.8), rand(0.05, 0.9), pick(BUG_KINDS), 0.7);
      bug.spawnT = 0;
      this.bugs.push(bug);
    }
  }

  exit(): void {}

  update(dt: number): void {
    const { input } = this.game;
    updateCamera(0, dt);
    this.bg.update(dt, 0);
    for (const bug of this.bugs) {
      bug.update(dt);
      if (bug.z > 1.05) {
        bug.z = 0.04;
        bug.lane = rand(-0.8, 0.8);
        bug.spawnT = 0.25;
      }
      bug.project();
    }

    const clickedMute =
      (input.mouseClicked && hitTest(MUTE_RECT, input.mouseX, input.mouseY)) ||
      (input.touchStarted && hitTest(MUTE_RECT, input.touchX, input.touchY));
    if (input.wasPressed("KeyM") || clickedMute) {
      audio.unlock();
      audio.toggleMute();
      audio.uiClick();
      return;
    }

    if (input.wasPressed("Space") || input.wasPressed("Enter") || input.mouseClicked || input.touchStarted) {
      audio.unlock();
      audio.music.start();
      audio.uiClick();
      this.game.setScene(new PlayScene(this.game));
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const time = this.game.time;
    this.bg.render(ctx, time);
    this.bugs.sort((a, b) => a.z - b.z);
    for (const bug of this.bugs) bug.render(ctx, time, W / 2);

    ctx.save();
    ctx.fillStyle = "rgba(5,6,15,0.78)";
    ctx.fillRect(0, H * 0.28, W, 150);
    ctx.fillStyle = "rgba(0,229,255,0.6)";
    ctx.fillRect(0, H * 0.28, W, 2);
    ctx.fillStyle = "rgba(255,60,200,0.6)";
    ctx.fillRect(0, H * 0.28 + 148, W, 2);

    drawGlitchTitle(ctx, "BUG BLASTER", W / 2, H * 0.28 + 58, 64, time);

    ctx.font = `14px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#b8c4d0";
    ctx.fillText(this.subtitle, W / 2, H * 0.28 + 112);

    const blink = 0.55 + 0.45 * Math.sin(time * 4);
    ctx.globalAlpha = blink;
    ctx.font = `bold 16px ${MONO}`;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    const prompt = touchModeDefault() ? "tap to start the sprint" : "press Space / click to start the sprint";
    ctx.strokeText(prompt, W / 2, H * 0.28 + 190);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(prompt, W / 2, H * 0.28 + 190);
    ctx.globalAlpha = 1;

    ctx.font = `12px ${MONO}`;
    ctx.fillStyle = "#8b9bb4";
    ctx.fillText(
      touchModeDefault()
        ? "drag to move · auto-fires while touching · tap RAGE when the meter is full"
        : "←/→ or A/D move · click / Space shoot · Shift / E unleash RAGE when full · M mute",
      W / 2,
      H - 24,
    );
    ctx.restore();

    drawMuteButton(ctx, audio.muted);
  }
}
