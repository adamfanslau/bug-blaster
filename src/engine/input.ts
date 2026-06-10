export class Input {
  private readonly keysDown = new Set<string>();
  private readonly keysPressed = new Set<string>();

  mouseX = 0;
  mouseY = 0;
  mouseDown = false;
  mouseClicked = false;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      if (!this.keysDown.has(e.code)) {
        this.keysPressed.add(e.code);
      }
      this.keysDown.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.keysDown.delete(e.code);
    });

    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
      this.mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;
    });
    canvas.addEventListener("mousedown", () => {
      this.mouseDown = true;
      this.mouseClicked = true;
    });
    window.addEventListener("mouseup", () => {
      this.mouseDown = false;
    });
  }

  /** True while the key is held. */
  isDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  /** True only on the frame the key was first pressed. */
  wasPressed(code: string): boolean {
    return this.keysPressed.has(code);
  }

  /** Clears per-frame state; called by the game loop after update/render. */
  endFrame(): void {
    this.keysPressed.clear();
    this.mouseClicked = false;
  }
}
