import { audio } from "../engine/audio";
import type { Game } from "../engine/game";
import type { Scene } from "../engine/scene";
import { quip, verdictFor } from "../content/quips";
import { Background } from "../render/background";
import { fitFontPx, formatDuration, measureTextWidth, MONO, roundRectPath, wrapText } from "../render/drawUtils";
import { drawMuteButton, hitTest, HUD, touchModeDefault } from "../render/hud";
import { H, updateCamera, W } from "../render/projection";
import { VP } from "../render/viewport";
import { storyPoints, type RunStats } from "../systems/stats";
import { PlayScene } from "./playScene";
import { TitleScene } from "./titleScene";

const INPUT_LOCK = 0.6;

/** The "Production Incident Postmortem": stats plus snark. Lays out in one or two columns. */
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
      (input.mouseClicked && hitTest(HUD.mute, input.mouseX, input.mouseY)) ||
      (input.touchStarted && hitTest(HUD.mute, input.touchX, input.touchY));
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
    const stacked = HUD.stacked;
    const fluid = VP.mode === "fluid";
    const t = stacked ? VP.ui : 1;
    const row = stacked ? 20 * t : fluid ? 20 : 24;
    this.bg.render(ctx, time);

    ctx.save();
    ctx.fillStyle = "rgba(5,6,15,0.7)";
    ctx.fillRect(0, 0, W, H);

    const padX = fluid ? 12 + Math.max(VP.safe.left, VP.safe.right) : 70;
    const padY = fluid ? 12 + VP.safe.top : 44;
    const px = padX;
    const py = padY;
    const pw = W - padX * 2;
    const ph = H - padY - (fluid ? 12 + VP.safe.bottom : 44);
    ctx.fillStyle = "rgba(10,12,24,0.92)";
    roundRectPath(ctx, px, py, pw, ph, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,59,92,0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#ff3b5c";
    ctx.fillRect(px + 8, py, pw - 16, 3);

    const inset = 28 * (stacked ? 0.6 : 1);
    const left = px + inset;
    const right = px + pw - inset;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const titlePx = Math.round(20 * t);
    ctx.font = `bold ${titlePx}px ${MONO}`;
    ctx.fillStyle = "#ff6b6b";
    let y = py + 22 * t;
    const incText = `INC-${String(s.score).padStart(6, "0")}`;
    if (stacked) {
      ctx.fillText("PRODUCTION INCIDENT", left, y);
      y += titlePx * 1.2;
      ctx.fillText("POSTMORTEM", left, y);
      y += titlePx * 1.2 + 8 * t;
    } else {
      ctx.fillText("PRODUCTION INCIDENT POSTMORTEM", left, y);
      ctx.textAlign = "right";
      ctx.font = `bold 14px ${MONO}`;
      ctx.fillStyle = "#8b9bb4";
      ctx.fillText(incText, Math.min(right, HUD.mute.x - 16), y + 4);
      y += 32 * (fluid ? 0.8 : 1);
    }

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(139,155,180,0.35)";
    ctx.fillRect(left, y, right - left, 1);
    y += 14 * (stacked ? t : fluid ? 0.7 : 1);
    // Portrait: the sound button shares the panel's top-right; start the table below it.
    if (stacked) y = Math.max(y, HUD.mute.y + HUD.mute.h + 8);

    const sprint = s.firstSprint === s.lastSprint ? `Sprint ${s.firstSprint}` : `Sprints ${s.firstSprint}–${s.lastSprint}`;
    const pairs: [string, string][] = [
      [sprint, stacked ? incText : ""],
      ["duration:", formatDuration(s.time)],
      ["bugs squashed:", String(s.squashed)],
      ["bugs shipped to prod:", String(s.shipped)],
      ["longest streak:", String(s.longestStreak)],
      ["peak rage:", `${Math.round(s.peakRage * 100)}%`],
      ["ultimates fired:", String(s.ultimatesFired)],
      stacked
        ? ["story points:", `${storyPoints(s)} (est. 3)`]
        : ["story points closed:", `${storyPoints(s)} (estimated: 3)`],
    ];
    const bodyPx = Math.round((stacked ? 13 : 14) * t);
    ctx.font = `${bodyPx}px ${MONO}`;
    if (stacked) {
      for (const [k, v] of pairs) {
        ctx.textAlign = "left";
        ctx.fillStyle = "#8b9bb4";
        ctx.fillText(k, left, y);
        ctx.textAlign = "right";
        ctx.fillStyle = "#e6edf3";
        ctx.fillText(v, right, y);
        y += row;
      }
    } else {
      // Two columns. Desktop keeps its original offsets; in fluid mode the sound button
      // shares the panel's top-right, so columns are packed from measured key widths.
      const bodyFont = `${bodyPx}px ${MONO}`;
      let xs: [number, number, number, number];
      if (!fluid) {
        xs = [px + 28, px + 210, px + 400, px + 620];
      } else {
        const usableRight = Math.min(px + pw, HUD.mute.x - 16);
        const keyW = (idx: number): number =>
          Math.max(...pairs.filter((_, i) => i % 2 === idx).map(([k]) => measureTextWidth(ctx, k, bodyFont)));
        const gapX = 12;
        const c1 = left;
        const v1 = c1 + keyW(0) + gapX;
        const v1W = Math.max(...pairs.filter((_, i) => i % 2 === 0).map(([, v]) => measureTextWidth(ctx, v, bodyFont)));
        const c2 = Math.max(v1 + v1W + 24, (left + usableRight) / 2 - 40);
        const v2 = c2 + keyW(1) + gapX;
        xs = [c1, v1, c2, v2];
      }
      for (let i = 0; i < pairs.length; i += 2) {
        const [k1, v1] = pairs[i];
        const [k2, v2] = pairs[i + 1];
        ctx.textAlign = "left";
        ctx.fillStyle = "#8b9bb4";
        ctx.fillText(k1, xs[0], y);
        ctx.fillStyle = "#e6edf3";
        ctx.fillText(v1, xs[1], y);
        ctx.fillStyle = "#8b9bb4";
        ctx.fillText(k2, xs[2], y);
        ctx.fillStyle = "#e6edf3";
        ctx.fillText(v2, xs[3], y);
        y += row;
      }
    }

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(139,155,180,0.35)";
    ctx.fillRect(left, y + 6, right - left, 1);
    y += 22 * (stacked ? t * 0.8 : fluid ? 0.7 : 1);
    const verdictFont = `bold ${Math.round((stacked ? 12 : 14) * t)}px ${MONO}`;
    ctx.font = verdictFont;
    for (const line of this.lines) {
      const wrapped = wrapText(ctx, line, verdictFont, right - left - 20 * t);
      ctx.fillStyle = "#ffb347";
      ctx.fillText(">", left, y);
      ctx.fillStyle = "#e6edf3";
      for (const w of wrapped) {
        ctx.fillText(w, left + 20 * t, y);
        y += row;
      }
    }

    ctx.textAlign = "center";
    const finalText = `final score: ${s.score}`;
    const promptPx = Math.round(14 * t);
    const promptY = py + ph - 44 * (stacked ? t * 0.8 : fluid ? 0.7 : 1);
    // Shrink the final score if the content above pushed it toward the prompt.
    const room = promptY - (y + 10);
    const finalPx = Math.max(14, Math.min(fitFontPx(ctx, finalText, "bold", Math.round(30 * t), pw - 40, 14), Math.floor(room / 1.6)));
    ctx.font = `bold ${finalPx}px ${MONO}`;
    ctx.fillStyle = "#7ee7ff";
    ctx.fillText(finalText, W / 2, Math.max(y + 10, promptY - finalPx * 1.6));

    const blink = this.lock > 0 ? 0 : 0.55 + 0.45 * Math.sin(time * 4);
    ctx.globalAlpha = blink;
    const prompt = touchModeDefault() ? "tap to reopen the ticket" : "press R / Space to reopen the ticket · Esc for the title";
    ctx.font = `bold ${fitFontPx(ctx, prompt, "bold", promptPx, pw - 40, 10)}px ${MONO}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(prompt, W / 2, promptY);
    ctx.restore();

    drawMuteButton(ctx, audio.muted);
  }
}
