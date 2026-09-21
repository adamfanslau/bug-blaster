import { audio } from "../engine/audio";
import type { Game } from "../engine/game";
import type { Scene } from "../engine/scene";
import { BUG_KINDS } from "../content/bugKinds";
import { quip } from "../content/quips";
import { Bug } from "../entities/bug";
import { Background } from "../render/background";
import { fitFontPx, MONO, pick, rand, wrapText } from "../render/drawUtils";
import { drawGlitchTitle, drawMuteButton, hitTest, HUD, touchModeDefault } from "../render/hud";
import { H, updateCamera, W } from "../render/projection";
import { VP } from "../render/viewport";
import { PlayScene } from "./playScene";

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
      (input.mouseClicked && hitTest(HUD.mute, input.mouseX, input.mouseY)) ||
      (input.touchStarted && hitTest(HUD.mute, input.touchX, input.touchY));
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
    const u = VP.ui;
    const touch = touchModeDefault();
    this.bg.render(ctx, time);
    this.bugs.sort((a, b) => a.z - b.z);
    for (const bug of this.bugs) bug.render(ctx, time, W / 2);

    ctx.save();
    const bandY = H * 0.28;
    const bandH = 150 * u;
    ctx.fillStyle = "rgba(5,6,15,0.78)";
    ctx.fillRect(0, bandY, W, bandH);
    ctx.fillStyle = "rgba(0,229,255,0.6)";
    ctx.fillRect(0, bandY, W, 2);
    ctx.fillStyle = "rgba(255,60,200,0.6)";
    ctx.fillRect(0, bandY + bandH - 2, W, 2);

    const titlePx = fitFontPx(ctx, "BUG BLASTER", "bold", Math.round(64 * u), W * 0.9, 28);
    drawGlitchTitle(ctx, "BUG BLASTER", W / 2, bandY + 58 * u, titlePx, time);

    const subPx = Math.round(14 * u);
    const subFont = `${subPx}px ${MONO}`;
    ctx.font = subFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#b8c4d0";
    const subLines = wrapText(ctx, this.subtitle, subFont, W - 32);
    let sy = bandY + 112 * u - ((subLines.length - 1) * subPx * 1.3) / 2;
    for (const line of subLines) {
      ctx.fillText(line, W / 2, sy);
      sy += subPx * 1.3;
    }

    const blink = 0.55 + 0.45 * Math.sin(time * 4);
    ctx.globalAlpha = blink;
    const prompt = touch ? "tap to start the sprint" : "press Space / click to start the sprint";
    const promptPx = fitFontPx(ctx, prompt, "bold", Math.round(16 * u), W - 32, 12);
    ctx.font = `bold ${promptPx}px ${MONO}`;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    const promptY = bandY + bandH + 40 * u;
    ctx.strokeText(prompt, W / 2, promptY);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(prompt, W / 2, promptY);
    ctx.globalAlpha = 1;

    const hintPx = Math.round(12 * u);
    const hintFont = `${hintPx}px ${MONO}`;
    ctx.font = hintFont;
    ctx.fillStyle = "#8b9bb4";
    const hint = touch
      ? "drag to move and aim · auto-fires while touching · tap RAGE when the meter is full"
      : "←/→ or A/D move · click / Space shoot · Shift / E unleash RAGE when full · M mute";
    const hintLines = wrapText(ctx, hint, hintFont, W - 32);
    let hy = H - VP.safe.bottom - 24 * u - (hintLines.length - 1) * hintPx * 1.4;
    for (const line of hintLines) {
      ctx.fillText(line, W / 2, hy);
      hy += hintPx * 1.4;
    }
    ctx.restore();

    drawMuteButton(ctx, audio.muted);
  }
}
