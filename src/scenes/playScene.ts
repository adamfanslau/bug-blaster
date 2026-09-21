import { audio } from "../engine/audio";
import type { Game } from "../engine/game";
import type { Scene } from "../engine/scene";
import { difficultyFor, FIRST_SPRINT, pickKind, type BugKindDef, type BugKindId, type Difficulty } from "../content/bugKinds";
import { killQuip, missQuip, quip, streakQuip } from "../content/quips";
import { pickUltimate } from "../content/ultimates";
import { Bug, PASSED_Z } from "../entities/bug";
import { Bullet, BULLET_START_Z } from "../entities/bullet";
import { Player, STARTING_LIVES } from "../entities/player";
import { Effects } from "../fx/effects";
import { Background } from "../render/background";
import { clamp, rand } from "../render/drawUtils";
import { hitTest, Hud, HUD, touchModeDefault, type Rect } from "../render/hud";
import { FLOOR_Y, H, unproject, unprojectLane, updateCamera, W } from "../render/projection";
import { noteFrameTime } from "../render/quality";
import { VP } from "../render/viewport";
import { Rage } from "../systems/rage";
import { newRunStats, recordKill, recordMiss, type RunStats } from "../systems/stats";
import { GameOverScene } from "./gameOverScene";

const TOUCH_FIRE_INTERVAL = 0.25;
const BULLET_VZ = 1.1;
/** Depth at which a touch shot crosses the finger's screen column. */
const Z_AIM = 0.45;
const MOUSE_VLANE_MAX = 2.5;
const TOUCH_VLANE_MAX = 4;
const RAGE_NAG_INTERVAL = 15;
const DYING_SECONDS = 1.3;
const Z_HIT_TOLERANCE = 0.25;

const UNLOCK_HINTS: Partial<Record<BugKindId, string>> = {
  offbyone: "fixing it causes another one. obviously.",
  memleak: "grows the longer you ignore it. like tech debt.",
  race: "can't be reproduced. try anyway.",
  womm: "the first hit doesn't count. it never does.",
};

interface PendingBoom {
  bug: Bug;
  delay: number;
}

export class PlayScene implements Scene {
  private readonly player = new Player();
  private bugs: Bug[] = [];
  private bullets: Bullet[] = [];
  private readonly bg = new Background();
  private readonly effects = new Effects();
  private readonly rage = new Rage();
  private readonly hud = new Hud();
  private readonly stats: RunStats = newRunStats(FIRST_SPRINT);
  private difficulty: Difficulty = difficultyFor(0);
  private readonly seenKinds = new Set<BugKindId>(["syntax", "null"]);

  private score = 0;
  private spawnTimer = 0.8;
  private touchFireTimer = 0;
  private nagTimer = RAGE_NAG_INTERVAL;
  private dying = false;
  private dyingT = 0;
  private touchMode = touchModeDefault();
  private pendingBooms: PendingBoom[] = [];

  constructor(private readonly game: Game) {}

  enter(): void {}

  exit(): void {}

  // ---- update -----------------------------------------------------------------

  update(dt: number): void {
    const { input } = this.game;
    const time = this.game.time;
    noteFrameTime(dt);
    if (input.touchStarted) this.touchMode = true;

    if (this.dying) {
      this.dyingT -= dt;
      this.simulate(dt, time);
      if (this.dyingT <= 0) {
        this.stats.score = this.score;
        this.game.setScene(new GameOverScene(this.game, this.stats));
      }
      return;
    }

    // HUD input first so a tap on a button is never also a shot or a move.
    let allowTouch = true;
    let consumeClick = false;
    const tapOn = (r: Rect): boolean =>
      (input.mouseClicked && hitTest(r, input.mouseX, input.mouseY)) ||
      (input.touchStarted && hitTest(r, input.touchX, input.touchY));
    if (input.wasPressed("KeyM") || tapOn(HUD.mute)) {
      audio.toggleMute();
      audio.uiClick();
      consumeClick = true;
      allowTouch = false;
    }
    const rageTap = this.touchMode && tapOn(HUD.rageButton);
    if (rageTap) {
      consumeClick = true;
      allowTouch = false;
    }
    // A touch that BEGAN on a button never drives the dev, but a drag that merely passes over one does.
    if (
      input.touchActive &&
      (hitTest(HUD.rageButton, input.touchStartX, input.touchStartY) ||
        hitTest(HUD.mute, input.touchStartX, input.touchStartY))
    ) {
      allowTouch = false;
    }
    const rageKey = input.wasPressed("ShiftLeft") || input.wasPressed("ShiftRight") || input.wasPressed("KeyE");
    if ((rageKey || rageTap || input.multiTouchStarted) && this.rage.canFire()) {
      this.fireUltimate();
    }

    this.player.update(dt, input, allowTouch);

    // Shooting.
    if ((input.mouseClicked && !consumeClick) || input.wasPressed("Space")) {
      this.fire(input.mouseRecentlyMoved() && !input.touchActive ? this.mouseAimVLane() : 0);
    }
    if (input.touchActive && allowTouch) {
      this.touchFireTimer -= dt;
      if (this.touchFireTimer <= 0) {
        this.touchFireTimer = TOUCH_FIRE_INTERVAL;
        this.fire(this.touchAimVLane());
      }
    } else {
      this.touchFireTimer = 0;
    }

    // Spawning (paused while an ultimate is going off).
    if (this.rage.state !== "firing") {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.difficulty.spawnInterval;
        this.spawn(pickKind(this.difficulty.kinds));
      }
    }

    this.simulate(dt, time);
    this.resolveCollisions();
    this.resolveLeaks();

    // Rage bookkeeping.
    this.rage.update(dt);
    this.stats.peakRage = Math.max(this.stats.peakRage, this.rage.peak);
    if (this.rage.state === "ready") {
      this.nagTimer -= dt;
      if (this.nagTimer <= 0) {
        this.nagTimer = RAGE_NAG_INTERVAL;
        this.effects.floatText(W / 2, H * 0.3, quip("rageNag"), "rage");
      }
    }

    if (this.player.lives <= 0) this.beginDying();

    this.bugs = this.bugs.filter((b) => b.alive);
    this.bullets = this.bullets.filter((b) => b.alive);
    this.hud.update(dt, this.score);
    this.stats.time += dt;
  }

  /** Moves everything and runs effects; used both while playing and while dying. */
  private simulate(dt: number, time: number): void {
    this.player.project();
    updateCamera(this.player.lane, dt);
    this.bg.update(dt, this.player.lane);

    for (const bullet of this.bullets) {
      bullet.update(dt);
      bullet.project();
    }
    for (const bug of this.bugs) {
      bug.update(dt);
      bug.project();
      if (bug.takeDrip()) {
        this.effects.drip(bug.screen.x + rand(-6, 6) * bug.screen.scale, bug.screen.y + bug.screenRadius * 0.6, bug.def.base, 3 * bug.screen.scale + 1);
      }
    }

    // Staggered ultimate explosions.
    if (this.pendingBooms.length > 0) {
      for (const boom of this.pendingBooms) {
        boom.delay -= dt;
        if (boom.delay <= 0 && boom.bug.alive) {
          this.effects.explode(boom.bug.screen.x, boom.bug.screen.y, boom.bug.def.base, boom.bug.def.hi, boom.bug.screen.scale);
          audio.squish(boom.bug.def.squishPitch);
          boom.bug.alive = false;
        }
      }
      this.pendingBooms = this.pendingBooms.filter((b) => b.delay > 0);
    }

    this.effects.update(dt, time);
    if (this.dying) {
      this.bugs = this.bugs.filter((b) => b.alive);
      this.bullets = this.bullets.filter((b) => b.alive);
    }
  }

  /** Lane velocity so the bullet passes through the point under the mouse. */
  private mouseAimVLane(): number {
    const { input } = this.game;
    const target = unproject(input.mouseX, input.mouseY);
    if (target.z >= 0.95) return 0;
    const travel = (BULLET_START_Z - target.z) / BULLET_VZ;
    return clamp((target.lane - this.player.lane) / travel, -MOUSE_VLANE_MAX, MOUSE_VLANE_MAX);
  }

  /**
   * Lane velocity so the bullet flies up the finger's screen column. A fixed screen x
   * is a constant-vLane path in this projection, so aiming at one depth covers the column.
   */
  private touchAimVLane(): number {
    const targetLane = unprojectLane(this.game.input.touchX, Z_AIM);
    const travel = (BULLET_START_Z - Z_AIM) / BULLET_VZ;
    return clamp((targetLane - this.player.lane) / travel, -TOUCH_VLANE_MAX, TOUCH_VLANE_MAX);
  }

  private fire(vLane: number): void {
    this.bullets.push(new Bullet(this.player.lane, vLane));
    this.player.onFire();
    audio.shoot();
    this.effects.muzzleFlash(this.player.screen.x, this.player.screen.floorY - 70 * VP.world);
  }

  private spawn(kind: BugKindDef): void {
    const lane = rand(-0.85, 0.85);
    this.bugs.push(new Bug(lane, null, kind, this.difficulty.speedMult));
    if (!this.seenKinds.has(kind.id)) {
      this.seenKinds.add(kind.id);
      this.effects.banner(`NEW BUG UNLOCKED: ${kind.label}`, UNLOCK_HINTS[kind.id] ?? null, kind.base, 2.8);
    }
  }

  private resolveCollisions(): void {
    const children: Bug[] = [];
    for (const bug of this.bugs) {
      if (!bug.alive || bug.doomed || bug.spawnT > 0.15) continue;
      for (const bullet of this.bullets) {
        if (!bullet.alive) continue;
        if (Math.abs(bug.z - bullet.z) > Z_HIT_TOLERANCE) continue;
        const dx = bug.screen.x - bullet.screen.x;
        const dy = bug.screen.y - bullet.screen.y;
        const reach = bug.screenRadius + bullet.screenRadius + 2;
        if (dx * dx + dy * dy >= reach * reach) continue;

        bullet.alive = false;
        const result = bug.hit();
        const { x, y, scale } = bug.screen;
        const r = bug.screenRadius;
        if (result === "shrug") {
          this.effects.puff(x, y, bug.def.hi, scale);
          this.effects.floatText(x, y - r - 14, quip("shrug"), "shrug");
          audio.shrug();
          this.rage.add(0.05) && this.onRageReady();
        } else if (result === "damaged") {
          this.effects.puff(x, y, bug.def.base, scale);
          this.effects.floatText(x, y - r - 10, `${bug.hp} hp`, "score");
          audio.damage();
          this.rage.add(0.01) && this.onRageReady();
        } else {
          this.onKill(bug);
          children.push(...bug.spawnChildren());
          break;
        }
      }
    }
    if (children.length > 0) {
      for (const child of children) child.project();
      this.bugs.push(...children);
    }
  }

  private onKill(bug: Bug): void {
    const { x, y, scale } = bug.screen;
    const r = bug.screenRadius;
    const pts = bug.points;
    this.score += pts;
    const streak = recordKill(this.stats, bug.def.id);

    this.effects.explode(x, y, bug.def.base, bug.def.hi, scale);
    this.effects.floatText(x, y - r - 8, `+${pts}`, "score");
    if (Math.random() < 0.6) {
      this.effects.floatText(x, Math.max(30, y - r - 42 * VP.ui), killQuip(bug.def.id), "quip");
    }
    audio.squish(bug.def.squishPitch);
    this.rage.add(0.03 + Math.min(streak, 8) * 0.006) && this.onRageReady();

    const sq = streakQuip(streak);
    if (sq) {
      this.effects.floatText(W / 2, H * 0.5, sq, "streak");
      audio.streak();
    }
    this.checkLevel();
  }

  private resolveLeaks(): void {
    for (const bug of this.bugs) {
      if (!bug.alive || bug.doomed || bug.z < PASSED_Z) continue;
      bug.alive = false;
      this.player.lives = Math.max(0, this.player.lives - 1);
      this.player.onHurt();
      recordMiss(this.stats);
      this.hud.onLifeLost();
      this.effects.shake(0.5);
      this.effects.vignette();
      this.effects.floatText(bug.screen.x, FLOOR_Y - 90 * VP.world, missQuip(this.player.lives), "miss");
      audio.miss();
      this.rage.add(0.34) && this.onRageReady();
    }
  }

  private onRageReady(): void {
    audio.rageReady();
    this.nagTimer = RAGE_NAG_INTERVAL;
    this.effects.floatText(W / 2, H * 0.3, quip("rageReady"), "rage");
  }

  private checkLevel(): void {
    const d = difficultyFor(this.score);
    if (d.level > this.difficulty.level) {
      this.effects.banner(`SPRINT ${d.sprint}: ${quip("sprint")}`, null, "#ffb347");
      audio.levelUp();
      audio.music.setTempo(128 + 6 * d.level);
      this.stats.lastSprint = d.sprint;
    }
    this.difficulty = d;
  }

  private fireUltimate(): void {
    this.rage.fire();
    const ult = pickUltimate();
    this.stats.ultimatesFired += 1;

    audio.ultimate();
    this.effects.shake(1);
    this.effects.flash(ult.color, 0.35, 0.8);
    this.effects.bigText(ult.name, ult.tagline, ult.color, 1.8);

    const targets = this.bugs.filter((b) => b.alive && !b.doomed);
    targets.forEach((bug, i) => {
      bug.doomed = true;
      this.score += bug.points;
      recordKill(this.stats, bug.def.id);
      switch (ult.flavor) {
        case "wipe":
          this.pendingBooms.push({ bug, delay: 0.05 + (i / Math.max(1, targets.length)) * 0.4 });
          break;
        case "shrink":
          bug.dying = 0.4;
          break;
        case "rewind":
          bug.rewinding = true;
          break;
      }
    });
    if (targets.length > 0) {
      this.score += 5 * targets.length;
      this.effects.floatText(W / 2, H * 0.58, `${targets.length} bugs closed · +${5 * targets.length} combo`, "streak");
    }
    this.bullets = [];
    this.checkLevel();
  }

  private beginDying(): void {
    if (this.dying) return;
    this.dying = true;
    this.dyingT = DYING_SECONDS;
    this.effects.shake(1);
    this.effects.flash("#ff3b5c", 0.4, 0.5);
    this.effects.bigText("SEGFAULT", "(core dumped)", "#ff3b5c", DYING_SECONDS);
  }

  // ---- render -----------------------------------------------------------------

  render(ctx: CanvasRenderingContext2D): void {
    const time = this.game.time;
    this.bg.render(ctx, time);

    this.effects.camera.begin(ctx);
    this.bugs.sort((a, b) => a.z - b.z);
    const px = this.player.screen.x;
    for (const bug of this.bugs) bug.render(ctx, time, px);
    for (const bullet of this.bullets) bullet.render(ctx);
    this.player.render(ctx, time);
    this.effects.renderWorld(ctx);
    this.effects.camera.end(ctx);

    this.hud.render(ctx, {
      score: this.score,
      lives: this.player.lives,
      maxLives: STARTING_LIVES,
      sprint: this.difficulty.sprint,
      rage: this.rage,
      muted: audio.muted,
      touchMode: this.touchMode,
      time,
    });
    this.effects.renderScreen(ctx);
  }
}
