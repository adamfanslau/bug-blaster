import type { BugKindDef } from "../content/bugKinds";
import { clamp, rand } from "../render/drawUtils";
import { makeProjected, project, type Projected } from "../render/projection";
import { drawBug } from "../render/bugArt";
import { VP } from "../render/viewport";

export type HitResult = "killed" | "damaged" | "shrug";

const BASE_RADIUS = 30;
const HOP_INTERVAL = 0.45;
const HOP_DISTANCE = 0.06;
const SPAWN_Z = 0.04;
export const PASSED_Z = 1.03;

/** A code bug crawling down the corridor (z: 0 = horizon, 1 = the dev's desk). */
export class Bug {
  alive = true;
  hp: number;
  age = 0;
  shrugged = false;
  /** Seconds left in the ultimate's shrink-out; 0 when not dying that way. */
  dying = 0;
  /** Set by the Ctrl+Z ultimate: flies back to the horizon. */
  rewinding = false;
  /** Claimed by an ultimate: no longer collides, can't leak past the player. */
  doomed = false;

  lane: number;
  z: number;
  alt = 0.12;
  speedZ: number;
  readonly screen: Projected = makeProjected();

  // Animation / behavior state.
  readonly wobblePhase = Math.random() * Math.PI * 2;
  legPhase = 0;
  hitFlash = 0;
  spawnT = 0.25;
  /** offbyone: squash-stretch timer after a hop. */
  hopT = 0;
  private stepTimer = HOP_INTERVAL;
  /** race: lane-teleport timer and per-frame pixel jitter. */
  private teleportTimer = rand(0.3, 0.7);
  jitterX = 0;
  readonly afterImages: number[] = [];
  /** null/race: alternate-label flip. */
  labelAlt = false;
  private labelTimer = 1;
  /** memleak: drip timer and pending drip flag for the scene. */
  private dripTimer = 0.25;
  private dripPending = false;
  /** syntax: brief render-only jitter every second or so. */
  jitterT = 0;
  private jitterCooldown = rand(0.8, 1.6);
  /** womm: shield shatter animation after the shrug. */
  shieldBreakT = 0;

  constructor(
    lane: number,
    z: number | null,
    readonly def: BugKindDef,
    private readonly speedMult: number,
    readonly generation = 0,
  ) {
    this.lane = clamp(lane, -0.95, 0.95);
    this.z = z ?? SPAWN_Z;
    this.hp = def.hp;
    this.speedZ = rand(def.speedZ[0], def.speedZ[1]) * speedMult;
  }

  /** Memory leaks grow with age; everyone else stays 1. */
  get growMul(): number {
    return this.def.movement === "grow" ? 1 + Math.min(this.age / 12, 1) * 1.6 : 1;
  }

  /** Radius in px at z = 1 (before projection), scaled to the viewport's world size. */
  get radius(): number {
    const death = this.dying > 0 ? this.dying / 0.4 : 1;
    return BASE_RADIUS * VP.world * this.growMul * death;
  }

  get screenRadius(): number {
    return this.radius * this.screen.scale;
  }

  get label(): string {
    if (this.def.movement === "grow") {
      return `memory leak: ${Math.round(512 * this.growMul ** 2)}MB`;
    }
    return this.labelAlt && this.def.labelAlt ? this.def.labelAlt : this.def.label;
  }

  /** Points on kill; memory leaks pay more the longer they've been eating RAM. */
  get points(): number {
    return this.def.movement === "grow" ? this.def.points + Math.floor(this.age) * 2 : this.def.points;
  }

  hit(): HitResult {
    this.hitFlash = 0.08;
    if (this.def.shrugsFirstHit && !this.shrugged) {
      this.shrugged = true;
      this.hp -= 1;
      this.speedZ *= 1.35;
      this.shieldBreakT = 0.4;
      return "shrug";
    }
    this.hp -= 1;
    if (this.hp <= 0) {
      this.alive = false;
      return "killed";
    }
    return "damaged";
  }

  /** Off-by-one bugs fix one, cause another. Children never split again. */
  spawnChildren(): Bug[] {
    if (!this.def.splitsOnDeath || this.generation > 0) return [];
    const child = new Bug(this.lane + (this.lane > 0 ? -0.12 : 0.12), this.z, this.def, this.speedMult, 1);
    child.spawnT = 0.3;
    return [child];
  }

  /** True once per drip; the scene turns it into a particle. */
  takeDrip(): boolean {
    const d = this.dripPending;
    this.dripPending = false;
    return d;
  }

  update(dt: number): void {
    this.age += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.spawnT = Math.max(0, this.spawnT - dt);
    this.legPhase += this.speedZ * 45 * dt;

    if (this.rewinding) {
      this.z -= 2.5 * dt;
      if (this.z < -0.05) this.alive = false;
      return;
    }
    if (this.dying > 0) {
      this.dying -= dt;
      if (this.dying <= 0) this.alive = false;
      return;
    }

    const { def } = this;
    switch (def.movement) {
      case "wobble":
        this.z += this.speedZ * dt;
        this.lane += Math.sin(this.age * def.wobbleFreq + this.wobblePhase) * def.wobbleAmp * dt;
        break;
      case "steps":
        this.stepTimer -= dt;
        this.hopT = Math.max(0, this.hopT - dt);
        if (this.stepTimer <= 0) {
          this.stepTimer = HOP_INTERVAL / this.speedMult;
          this.z += HOP_DISTANCE + (Math.random() < 0.3 ? 0.004 : 0); // occasionally one off
          this.lane += (Math.floor(Math.random() * 3) - 1) * 0.12;
          this.hopT = 0.08;
        }
        break;
      case "jitter":
        this.z += this.speedZ * dt;
        this.lane += Math.sin(this.age * def.wobbleFreq + this.wobblePhase) * def.wobbleAmp * dt;
        this.jitterX = rand(-2, 2) * VP.world;
        this.teleportTimer -= dt;
        if (this.teleportTimer <= 0) {
          this.teleportTimer = rand(0.3, 0.7);
          this.afterImages.unshift(this.screen.x, this.screen.y);
          this.afterImages.length = Math.min(this.afterImages.length, 4);
          this.lane += (Math.random() < 0.5 ? -1 : 1) * rand(0.15, 0.3);
          this.speedZ = rand(def.speedZ[0], def.speedZ[1]) * this.speedMult;
          this.labelAlt = !this.labelAlt;
        }
        break;
      case "grow":
        this.z += (this.speedZ / this.growMul) * dt;
        this.lane += Math.sin(this.age * def.wobbleFreq + this.wobblePhase) * def.wobbleAmp * dt;
        this.dripTimer -= dt;
        if (this.dripTimer <= 0) {
          this.dripTimer = 0.25;
          this.dripPending = true;
        }
        break;
    }
    this.lane = clamp(this.lane, -0.95, 0.95);

    if (def.labelAlt && def.movement !== "jitter") {
      this.labelTimer -= dt;
      if (this.labelTimer <= 0) {
        this.labelTimer = 1;
        this.labelAlt = !this.labelAlt;
      }
    }
    if (def.id === "syntax") {
      this.jitterT = Math.max(0, this.jitterT - dt);
      this.jitterCooldown -= dt;
      if (this.jitterCooldown <= 0) {
        this.jitterCooldown = rand(0.8, 1.6);
        this.jitterT = 0.1;
      }
    }
    if (def.id === "womm") {
      this.alt = 0.12 + 0.03 * Math.sin(this.age * 3);
      this.shieldBreakT = Math.max(0, this.shieldBreakT - dt);
    }
  }

  project(): void {
    project(this.lane, this.z, this.alt, this.screen);
  }

  render(ctx: CanvasRenderingContext2D, time: number, playerScreenX: number): void {
    drawBug(ctx, this, time, playerScreenX);
  }
}
