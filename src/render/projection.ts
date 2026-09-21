import { clamp, smoothstep } from "./drawUtils";
import { onViewportResize, VP, type ViewportState } from "./viewport";

/**
 * Perspective parameters. These are live bindings re-derived from the viewport,
 * so `import { W, H }` sites always read the current values. Never copy them
 * into module-level constants.
 */

/** Logical canvas size. */
export let W = 960;
export let H = 540;
/** Screen y of the vanishing point / horizon. */
export let HORIZON_Y = 200;
/** Screen y of the ground plane where z = 1 (the player's row). */
export let FLOOR_Y = 468;
/** Depth ratio: the far plane (z = 0) is R times farther than the near plane (z = 1). */
export const R = 4;
/** Half the corridor width in px at z = 1 (lane = ±1). */
export let NEAR_HALF_W = 440;
/** Pixels per world altitude unit at z = 1. */
export let ALT_PX = 60;
/** Vanishing-point parallax per unit of player lane. */
export let PARALLAX_PX = 28;

export interface Projected {
  x: number;
  y: number;
  floorY: number;
  scale: number;
  fog: number;
}

export const makeProjected = (): Projected => ({ x: 0, y: 0, floorY: 0, scale: 0, fog: 0 });

let vpX = W / 2;

export const getVpX = (): number => vpX;

export function configureProjection(vp: ViewportState): void {
  W = vp.w;
  H = vp.h;
  HORIZON_Y = (vp.portrait ? 0.32 : 200 / 540) * H;
  FLOOR_Y = (vp.portrait ? 0.78 : 468 / 540) * H;
  NEAR_HALF_W = (440 / 960) * W;
  ALT_PX = 60 * vp.world;
  PARALLAX_PX = 28 * vp.world;
  vpX = W / 2;
}

configureProjection(VP);
onViewportResize(configureProjection);

/** Eases the vanishing point opposite the player's lane so the whole corridor parallaxes. */
export function updateCamera(playerLane: number, dt: number): void {
  const target = W / 2 - playerLane * PARALLAX_PX;
  vpX += (target - vpX) * Math.min(1, dt * 6);
}

export const scaleAt = (z: number): number => 1 / (R - z * (R - 1));

export function floorYAt(z: number): number {
  const s = scaleAt(z);
  const t = (s - 1 / R) / (1 - 1 / R);
  return HORIZON_Y + (FLOOR_Y - HORIZON_Y) * t;
}

export const fogAt = (z: number): number => smoothstep(0.02, 0.45, z);

export function project(lane: number, z: number, alt: number, out: Projected): Projected {
  const s = scaleAt(z);
  const floorY = floorYAt(z);
  out.scale = s;
  out.floorY = floorY;
  out.x = vpX + lane * NEAR_HALF_W * s;
  out.y = floorY - alt * ALT_PX * s;
  out.fog = fogAt(z);
  return out;
}

/** Screen point on the ground plane -> world (lane, z). */
export function unproject(sx: number, sy: number): { lane: number; z: number } {
  const t = clamp((sy - HORIZON_Y) / (FLOOR_Y - HORIZON_Y), 0.02, 1);
  const s = 1 / R + (1 - 1 / R) * t;
  const z = (R - 1 / s) / (R - 1);
  const lane = (sx - vpX) / (NEAR_HALF_W * s);
  return { lane, z };
}

export function unprojectLane(sx: number, z: number): number {
  return (sx - vpX) / (NEAR_HALF_W * scaleAt(z));
}
