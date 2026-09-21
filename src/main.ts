import { Game } from "./engine/game";
import { HUD } from "./render/hud";
import { initViewport, VP } from "./render/viewport";
import { TitleScene } from "./scenes/titleScene";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) {
  throw new Error("Canvas element #game not found");
}

initViewport(canvas);

const game = new Game(canvas);
game.setScene(new TitleScene(game));
game.start();

if (import.meta.env.DEV) {
  // Inspection hook for the headless verification scripts; dev builds only.
  (window as unknown as { __bb: unknown }).__bb = {
    VP,
    get HUD() {
      return HUD;
    },
    game,
  };
}
