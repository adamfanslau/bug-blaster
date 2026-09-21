export type RageState = "charging" | "ready" | "firing";

const DECAY_PER_S = 0.015;
export const FIRE_DURATION = 0.8;

/** Frustration meter: fills on misses, holds when full, empties when the ultimate fires. */
export class Rage {
  value = 0;
  state: RageState = "charging";
  peak = 0;
  /** Seconds spent in `ready` without firing (drives nag quips). */
  readySince = 0;
  fireTimer = 0;

  /** Adds to the meter. Returns true on the single frame it becomes ready. */
  add(amount: number): boolean {
    if (this.state !== "charging") return false;
    this.value = Math.min(1, this.value + amount);
    this.peak = Math.max(this.peak, this.value);
    if (this.value >= 1) {
      this.state = "ready";
      this.readySince = 0;
      return true;
    }
    return false;
  }

  update(dt: number): void {
    switch (this.state) {
      case "charging":
        this.value = Math.max(0, this.value - DECAY_PER_S * dt);
        break;
      case "ready":
        this.readySince += dt;
        break;
      case "firing":
        this.fireTimer -= dt;
        if (this.fireTimer <= 0) {
          this.state = "charging";
          this.value = 0;
        }
        break;
    }
  }

  canFire(): boolean {
    return this.state === "ready";
  }

  fire(): void {
    this.state = "firing";
    this.fireTimer = FIRE_DURATION;
  }

  /** 0..1 fraction of the firing window remaining. */
  get firingProgress(): number {
    return this.state === "firing" ? this.fireTimer / FIRE_DURATION : 0;
  }
}
