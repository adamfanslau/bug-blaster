const coarse =
  typeof matchMedia === "function" && matchMedia("(hover: none) and (pointer: coarse)").matches;

/** Render budget knobs; mutable so the auto-degrader can lower them at runtime. */
export const QUALITY = {
  mobile: coarse,
  maxParticles: coarse ? 140 : 300,
  trailLen: coarse ? 5 : 8,
  bits: coarse ? 40 : 65,
  glow: true,
  doubleDrawRace: !coarse,
  level: 2, // 2 = full, 1 = no glow, 0 = no glow + fewer particles
};

let slowAccum = 0;

/** Call once per frame. Two seconds of frames slower than 45fps drops a quality level. */
export function noteFrameTime(dt: number): void {
  if (QUALITY.level === 0) return;
  if (dt > 1 / 45) {
    slowAccum += dt;
    if (slowAccum > 2) {
      slowAccum = 0;
      QUALITY.level -= 1;
      if (QUALITY.level === 1) {
        QUALITY.glow = false;
        QUALITY.doubleDrawRace = false;
      } else {
        QUALITY.maxParticles = Math.floor(QUALITY.maxParticles / 2);
        QUALITY.trailLen = 4;
      }
    }
  } else {
    slowAccum = Math.max(0, slowAccum - dt * 0.5);
  }
}
