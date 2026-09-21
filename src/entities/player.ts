import type { Input } from "../engine/input";
import { clamp } from "../render/drawUtils";
import { drawDev } from "../render/devArt";
import { makeProjected, NEAR_HALF_W, project, type Projected, unprojectLane, W } from "../render/projection";

const SPEED_PX = 320; // px per second at z = 1
const LANE_SPEED = SPEED_PX / NEAR_HALF_W;
const MAX_LANE = (W / 2 - 70) / NEAR_HALF_W;
export const STARTING_LIVES = 5;

/** The developer at their desk: moves along the near edge of the corridor. */
export class Player {
  lane = 0;
  readonly z = 1;
  lives = STARTING_LIVES;
  readonly screen: Projected = makeProjected();

  /** Smoothed lane velocity (lanes/s) for the lean animation. */
  vLane = 0;
  /** Keyboard-mash timer after firing. */
  mashT = 0;
  mashSide = 0;
  recoil = 0;
  hurtT = 0;

  update(dt: number, input: Input, allowTouch = true): void {
    const before = this.lane;
    if (input.touchActive && allowTouch) {
      const target = clamp(unprojectLane(input.touchX, 1), -MAX_LANE, MAX_LANE);
      const dx = target - this.lane;
      const step = LANE_SPEED * 1.4 * dt;
      this.lane += Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
    } else if (!input.touchActive) {
      let dir = 0;
      if (input.isDown("ArrowLeft") || input.isDown("KeyA")) dir -= 1;
      if (input.isDown("ArrowRight") || input.isDown("KeyD")) dir += 1;
      this.lane += dir * LANE_SPEED * dt;
    }
    this.lane = clamp(this.lane, -MAX_LANE, MAX_LANE);

    const v = dt > 0 ? (this.lane - before) / dt : 0;
    this.vLane += (v - this.vLane) * Math.min(1, dt * 10);

    this.mashT = Math.max(0, this.mashT - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.recoil *= Math.exp(-18 * dt);
  }

  onFire(): void {
    this.mashT = 0.12;
    this.mashSide = 1 - this.mashSide;
    this.recoil = 5;
  }

  onHurt(): void {
    this.hurtT = 0.45;
  }

  project(): void {
    project(this.lane, this.z, 0, this.screen);
  }

  render(ctx: CanvasRenderingContext2D, time: number): void {
    drawDev(ctx, this, time);
  }
}
