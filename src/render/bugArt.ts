import type { Bug } from "../entities/bug";
import { clamp, rgba } from "./drawUtils";
import { QUALITY } from "./quality";
import { bodySprite, glowSprite, shadowSprite } from "./sprites";
import { VP } from "./viewport";

const MONO = "ui-monospace, Menlo, Consolas, monospace";
const DASH: number[] = [4, 3];
const SHIELD_DASH: number[] = [6, 5];

/**
 * Draws one bug at its cached screen position. Everything is scaled by the
 * projection so far bugs are small and dim, near bugs large and bright.
 */
export function drawBug(ctx: CanvasRenderingContext2D, bug: Bug, time: number, playerScreenX: number): void {
  const { def } = bug;
  const { x: sx, y, floorY, scale, fog } = bug.screen;
  const pop = bug.spawnT > 0 ? 1 - (bug.spawnT / 0.25) ** 2 * 0.6 : 1;
  const r = bug.radius * scale * pop;
  if (r < 0.5) return;
  const ry = r * def.aspect;
  const alpha = 0.25 + 0.75 * fog;
  const lod = scale >= 0.3;

  // Render-only offsets: syntax jitter, race jitter, off-by-one body offset from its shadow.
  let x = sx;
  if (def.id === "syntax" && bug.jitterT > 0) x += (Math.random() - 0.5) * 6 * scale;
  if (def.id === "race") x += bug.jitterX * scale;
  const bodyOffset = def.id === "offbyone" ? 0.3 * r : 0;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Floor shadow.
  const shw = r * 2.3;
  const shh = r * 0.64;
  ctx.globalAlpha = alpha * 0.55;
  ctx.drawImage(shadowSprite(), sx - shw / 2, floorY - shh / 2, shw, shh);
  ctx.globalAlpha = alpha;

  // Glow.
  if (QUALITY.glow && lod) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha * 0.4;
    const gs = r * 2.6;
    ctx.drawImage(glowSprite(def.base), x - gs / 2, y - gs / 2, gs, gs);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = alpha;
  }

  // Race condition: chromatic after-images and a cyan/magenta split.
  if (def.id === "race" && lod) {
    ctx.globalAlpha = alpha * 0.25;
    for (let i = 0; i + 1 < bug.afterImages.length; i += 2) {
      ctx.fillStyle = i === 0 ? "#58a6ff" : "#ff3cc8";
      ctx.beginPath();
      ctx.ellipse(bug.afterImages[i], bug.afterImages[i + 1], r * 0.9, ry * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (QUALITY.doubleDrawRace) {
      const dx = Math.sin(time * 30) * 3 * scale;
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = "#00e5ff";
      ctx.beginPath();
      ctx.ellipse(x - dx, y, r, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff3cc8";
      ctx.beginPath();
      ctx.ellipse(x + dx, y, r, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
  }

  // Legs behind the body (only when big enough to matter).
  if (lod) drawLegs(ctx, bug, x + bodyOffset, y, r, ry);

  // Body.
  const bodyX = x + bodyOffset;
  let bodyScaleX = 1;
  let bodyScaleY = 1;
  if (def.id === "offbyone" && bug.hopT > 0) {
    bodyScaleX = 1.15;
    bodyScaleY = 0.85;
  }
  if (def.id === "memleak") {
    const pulse = 1 + 0.05 * Math.sin(bug.age * 6);
    bodyScaleX *= pulse;
    bodyScaleY *= pulse;
  }
  const body = bodySprite(def.id, def.hi, def.base, def.lo, def.aspect);
  const bw = r * 2 * bodyScaleX;
  const bh = ry * 2 * bodyScaleY;
  if (def.id === "null") {
    const blink = 0.35 + 0.6 * (0.5 + 0.5 * Math.sin(time * 4 + bug.wobblePhase));
    ctx.globalAlpha = alpha * blink * 0.45;
    ctx.drawImage(body, bodyX - bw / 2, y - bh / 2, bw, bh);
    ctx.globalAlpha = alpha * blink;
    ctx.setLineDash(DASH);
    ctx.lineWidth = Math.max(1, 2 * scale);
    ctx.strokeStyle = def.hi;
    ctx.beginPath();
    ctx.ellipse(bodyX, y, r, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (lod) glyph(ctx, "∅", bodyX, y, r * 0.9, def.hi);
    ctx.globalAlpha = alpha;
  } else {
    ctx.drawImage(body, bodyX - bw / 2, y - bh / 2, bw, bh);
    if (def.id === "memleak" && lod) {
      // Lower bulge so it reads as a sagging blob.
      ctx.fillStyle = def.lo;
      ctx.beginPath();
      ctx.ellipse(bodyX, y + ry * 0.55, r * 0.7, ry * 0.45, 0, 0, Math.PI);
      ctx.fill();
    }
  }

  if (lod) {
    drawExtras(ctx, bug, bodyX, y, r, ry, time);
    drawFace(ctx, bodyX, y, r, ry, playerScreenX, def.id === "womm");
    if (def.id !== "null") drawAntennae(ctx, bug, bodyX, y, r, ry, time);
  }

  // Hit flash.
  if (bug.hitFlash > 0) {
    ctx.globalAlpha = alpha * (bug.hitFlash / 0.08) * 0.85;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(bodyX, y, r, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
  }

  // Label.
  if (lod && bug.dying <= 0) {
    const px = Math.round((9 + 5 * Math.min(1, scale)) * Math.max(VP.world, VP.ui));
    ctx.font = `bold ${px}px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.fillStyle = def.hi;
    const ly = y + ry + 6 * scale + (def.id === "syntax" ? 6 * scale : 0);
    ctx.strokeText(bug.label, bodyX, ly);
    ctx.fillText(bug.label, bodyX, ly);
  }

  ctx.restore();
}

function drawLegs(ctx: CanvasRenderingContext2D, bug: Bug, x: number, y: number, r: number, ry: number): void {
  const { def } = bug;
  ctx.strokeStyle = def.lo;
  ctx.lineWidth = Math.max(1, 2.2 * bug.screen.scale);
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const side of [-1, 1]) {
    const count = def.id === "offbyone" ? (side < 0 ? 4 : 3) : 3;
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.28;
      const lift = Math.sin(bug.legPhase + i * 2.1 + (side < 0 ? Math.PI : 0));
      const hipX = x + side * r * 0.6;
      const hipY = y + spread * ry;
      const kneeX = x + side * r * 1.25;
      const kneeY = hipY - ry * 0.35 * (0.6 + 0.4 * lift);
      const footX = x + side * r * 1.6;
      const footY = y + spread * ry * 1.2 + ry * 0.5 - ry * 0.15 * lift;
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
    }
  }
  ctx.stroke();
}

function drawAntennae(ctx: CanvasRenderingContext2D, bug: Bug, x: number, y: number, r: number, ry: number, time: number): void {
  const { def } = bug;
  const long = def.id === "race" ? 1.5 : 1;
  const wig = Math.sin(time * 5 + bug.wobblePhase) * 0.2 * r;
  ctx.strokeStyle = def.lo;
  ctx.lineWidth = Math.max(1, 1.6 * bug.screen.scale);
  ctx.beginPath();
  for (const side of [-1, 1]) {
    const bx = x + side * r * 0.3;
    const by = y - ry * 0.8;
    const tx = x + side * r * 0.7 * long + wig;
    const ty = y - ry * (1.5 + 0.6 * long);
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + side * r * 0.2, by - ry * 0.7 * long, tx, ty);
  }
  ctx.stroke();
  ctx.fillStyle = def.hi;
  for (const side of [-1, 1]) {
    const tx = x + side * r * 0.7 * long + wig;
    const ty = y - ry * (1.5 + 0.6 * long);
    ctx.beginPath();
    ctx.arc(tx, ty, Math.max(1, r * 0.09), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  ry: number,
  playerScreenX: number,
  sunglasses: boolean,
): void {
  const ex = r * 0.35;
  const ey = y - ry * 0.3;
  const er = Math.max(1.2, r * 0.17);
  if (sunglasses) {
    ctx.fillStyle = "#0b0d14";
    ctx.fillRect(x - ex - er * 1.2, ey - er * 0.8, er * 2.4, er * 1.5);
    ctx.fillRect(x + ex - er * 1.2, ey - er * 0.8, er * 2.4, er * 1.5);
    ctx.fillRect(x - ex + er * 1.1, ey - er * 0.3, (ex - er * 1.1) * 2, Math.max(1, er * 0.3));
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(x - ex - er * 0.9, ey - er * 0.6, er * 0.6, er * 0.3);
    ctx.fillRect(x + ex - er * 0.9, ey - er * 0.6, er * 0.6, er * 0.3);
    return;
  }
  const look = clamp((playerScreenX - x) / (200 * VP.world), -1, 1) * er * 0.4;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(x - ex, ey, er, er * 1.15, 0, 0, Math.PI * 2);
  ctx.ellipse(x + ex, ey, er, er * 1.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0b0d14";
  ctx.beginPath();
  ctx.arc(x - ex + look, ey + er * 0.15, er * 0.5, 0, Math.PI * 2);
  ctx.arc(x + ex + look, ey + er * 0.15, er * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawExtras(ctx: CanvasRenderingContext2D, bug: Bug, x: number, y: number, r: number, ry: number, time: number): void {
  const { def } = bug;
  const scale = bug.screen.scale;
  switch (def.id) {
    case "syntax": {
      // IDE red squiggle under the body.
      ctx.strokeStyle = "#ff4d4d";
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.beginPath();
      const w = r * 1.6;
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const px = x - w / 2 + (w * i) / steps;
        const py = y + ry + 4 * scale + (i % 2 === 0 ? -2 : 2) * scale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      break;
    }
    case "offbyone":
      glyph(ctx, "+1", x, y + ry * 0.15, r * 0.7, "#3a2600");
      break;
    case "womm": {
      glyph(ctx, "✓", x, y + ry * 0.2, r * 0.8, "#3a2a00");
      if (!bug.shrugged) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time * 1.5);
        ctx.setLineDash(SHIELD_DASH);
        ctx.lineWidth = Math.max(1, 2 * scale);
        ctx.strokeStyle = rgba(def.hi, 0.8);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.5, ry * 1.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (bug.shieldBreakT > 0) {
        // Shield shattering into arc fragments flying outward.
        const t = 1 - bug.shieldBreakT / 0.4;
        ctx.save();
        ctx.globalAlpha *= 1 - t;
        ctx.lineWidth = Math.max(1, 2 * scale);
        ctx.strokeStyle = def.hi;
        for (let i = 0; i < 6; i++) {
          const a0 = (i / 6) * Math.PI * 2;
          const grow = 1.5 + t * 1.2;
          ctx.beginPath();
          ctx.ellipse(x, y, r * grow, ry * grow, 0, a0, a0 + 0.6);
          ctx.stroke();
        }
        ctx.restore();
      }
      break;
    }
    default:
      break;
  }
}

function glyph(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, px: number, color: string): void {
  ctx.font = `bold ${Math.max(6, Math.round(px))}px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(ch, x, y);
}
