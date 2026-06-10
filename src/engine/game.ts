import { Input } from "./input";
import type { Scene } from "./scene";

export class Game {
  readonly ctx: CanvasRenderingContext2D;
  readonly input: Input;
  readonly width: number;
  readonly height: number;

  private scene: Scene | null = null;
  private lastTime = 0;
  private running = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D rendering context not available");
    }
    this.ctx = ctx;
    this.width = canvas.width;
    this.height = canvas.height;
    this.input = new Input(canvas);
  }

  setScene(scene: Scene): void {
    this.scene?.exit();
    this.scene = scene;
    scene.enter();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
  }

  private loop = (time: number): void => {
    if (!this.running) return;
    // Clamp dt so a backgrounded tab doesn't produce a huge simulation step.
    const dt = Math.min((time - this.lastTime) / 1000, 1 / 30);
    this.lastTime = time;

    this.scene?.update(dt);
    this.scene?.render(this.ctx);
    this.input.endFrame();

    requestAnimationFrame(this.loop);
  };
}
