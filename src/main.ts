import { Game } from "./engine/game";
import { PlayScene } from "./scenes/playScene";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) {
  throw new Error("Canvas element #game not found");
}

const game = new Game(canvas);
game.setScene(new PlayScene(game));
game.start();
