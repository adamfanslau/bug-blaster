import { Game } from "./engine/game";
import { TitleScene } from "./scenes/titleScene";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) {
  throw new Error("Canvas element #game not found");
}

const game = new Game(canvas);
game.setScene(new TitleScene(game));
game.start();
