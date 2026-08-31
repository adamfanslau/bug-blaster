export class Input {
  private readonly keysDown = new Set<string>();
  private readonly keysPressed = new Set<string>();

  mouseX = 0;
  mouseY = 0;
  mouseDown = false;
  mouseClicked = false;
  private lastMouseMoveAt = Number.NEGATIVE_INFINITY;

  touchX = 0;
  touchY = 0;
  touchActive = false;
  touchStarted = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
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
      this.lastMouseMoveAt = performance.now();
    });
    canvas.addEventListener("mousedown", () => {
      this.mouseDown = true;
      this.mouseClicked = true;
    });
    window.addEventListener("mouseup", () => {
      this.mouseDown = false;
    });

    // preventDefault() stops page scroll/zoom and suppresses the synthetic
    // mouse events browsers fire after touches, keeping mouse state touch-free.
    canvas.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        if (e.touches.length > 0) {
          this.updateTouchPosition(e.touches[0]);
          this.touchActive = true;
          this.touchStarted = true;
        }
      },
      { passive: false },
    );
    canvas.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        if (e.touches.length > 0) this.updateTouchPosition(e.touches[0]);
      },
      { passive: false },
    );
    for (const type of ["touchend", "touchcancel"] as const) {
      canvas.addEventListener(
        type,
        (e) => {
          e.preventDefault();
          if (e.touches.length === 0) {
            this.touchActive = false;
          } else {
            this.updateTouchPosition(e.touches[0]);
          }
        },
        { passive: false },
      );
    }
  }

  private updateTouchPosition(touch: Touch): void {
    const rect = this.canvas.getBoundingClientRect();
    this.touchX = ((touch.clientX - rect.left) / rect.width) * this.canvas.width;
    this.touchY = ((touch.clientY - rect.top) / rect.height) * this.canvas.height;
  }

  /** True while the key is held. */
  isDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  /** True only on the frame the key was first pressed. */
  wasPressed(code: string): boolean {
    return this.keysPressed.has(code);
  }

  /** True if the mouse moved within the last `withinMs` milliseconds. */
  mouseRecentlyMoved(withinMs = 1500): boolean {
    return performance.now() - this.lastMouseMoveAt < withinMs;
  }

  /** Clears per-frame state; called by the game loop after update/render. */
  endFrame(): void {
    this.keysPressed.clear();
    this.mouseClicked = false;
    this.touchStarted = false;
  }
}
