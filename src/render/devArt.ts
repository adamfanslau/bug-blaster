import type { Player } from "../entities/player";
import { clamp, roundRectPath } from "./drawUtils";
import { QUALITY } from "./quality";
import { glowSprite, shadowSprite } from "./sprites";
import { VP } from "./viewport";

const MONO = "ui-monospace, Menlo, Consolas, monospace";

/**
 * The developer seen from behind: hoodie, laptop lid glowing cyan and lighting the
 * rim of the hood, a desk, and a coffee mug. Anchored at the player's floor point.
 */
export function drawDev(ctx: CanvasRenderingContext2D, p: Player, time: number): void {
  const { x, floorY } = p.screen;
  const lean = clamp(p.vLane * 0.12, -0.09, 0.09);
  const mash = p.mashT > 0 ? p.mashT / 0.12 : 0;
  const hurt = p.hurtT > 0 ? p.hurtT / 0.45 : 0;

  const k = VP.world;
  ctx.save();
  // Ground shadow under the whole desk.
  ctx.globalAlpha = 0.6;
  ctx.drawImage(shadowSprite(), x - 80 * k, floorY - 14 * k, 160 * k, 28 * k);
  ctx.globalAlpha = 1;

  // Everything below is authored at desktop size around the anchor; scale once here.
  ctx.translate(x, floorY + p.recoil);
  ctx.scale(k, k);
  ctx.rotate(lean);

  // Screen light spilling around the laptop onto the dev.
  if (QUALITY.glow) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.35 + 0.35 * mash + 0.05 * Math.sin(time * 9);
    ctx.drawImage(glowSprite("#7ee7ff"), -70, -120, 140, 140);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  // Chair back.
  ctx.fillStyle = "#151821";
  roundRectPath(ctx, -24, -80, 48, 52, 8);
  ctx.fill();

  // Body (hoodie) as a shoulder trapezoid.
  ctx.fillStyle = "#262c3a";
  ctx.beginPath();
  ctx.moveTo(-26, -46);
  ctx.quadraticCurveTo(0, -56, 26, -46);
  ctx.lineTo(30, -20);
  ctx.lineTo(-30, -20);
  ctx.closePath();
  ctx.fill();
  // Rim light on the shoulders from the screen.
  ctx.strokeStyle = "rgba(126,231,255,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-26, -46);
  ctx.quadraticCurveTo(0, -56, 26, -46);
  ctx.stroke();

  // Hood + head.
  ctx.fillStyle = "#1f2430";
  ctx.beginPath();
  ctx.ellipse(0, -66, 17, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(126,231,255,0.7)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, -66, 16, 19, 0, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  // Headphones band.
  ctx.strokeStyle = "#3a4152";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, -66, 19, 21, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.fillStyle = "#3a4152";
  ctx.beginPath();
  ctx.ellipse(-18, -64, 4, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(18, -64, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (hurt > 0) {
    ctx.globalAlpha = hurt * 0.55;
    ctx.fillStyle = "#ff3b5c";
    ctx.beginPath();
    ctx.ellipse(0, -66, 17, 20, 0, 0, Math.PI * 2);
    ctx.moveTo(-26, -46);
    ctx.lineTo(26, -46);
    ctx.lineTo(30, -20);
    ctx.lineTo(-30, -20);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Desk: top face, then front face.
  ctx.fillStyle = "#3b4252";
  ctx.beginPath();
  ctx.moveTo(-52, -32);
  ctx.lineTo(52, -32);
  ctx.lineTo(60, -24);
  ctx.lineTo(-60, -24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#262b36";
  ctx.beginPath();
  ctx.moveTo(-60, -24);
  ctx.lineTo(60, -24);
  ctx.lineTo(64, 0);
  ctx.lineTo(-64, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(126,231,255,0.45)";
  ctx.fillRect(-52, -33, 104, 1.5);

  // Hands on the desk edge, slamming the keys alternately while firing.
  const slam = mash * 3;
  ctx.fillStyle = "#e0b89a";
  roundRectPath(ctx, -22, -31 + (p.mashSide === 0 ? slam : 0), 10, 6, 2);
  ctx.fill();
  roundRectPath(ctx, 12, -31 + (p.mashSide === 1 ? slam : 0), 10, 6, 2);
  ctx.fill();

  // Laptop base with key rows.
  ctx.fillStyle = "#3a3f4c";
  roundRectPath(ctx, -20, -36, 40, 5, 1.5);
  ctx.fill();
  ctx.fillStyle = "#585f70";
  for (let i = 0; i < 6; i++) ctx.fillRect(-17 + i * 5.6, -35, 3.5, 1.2);

  // Laptop lid (its back faces us) with a glowing logo and light leaking around it.
  ctx.fillStyle = "#444a58";
  ctx.beginPath();
  ctx.moveTo(-20, -36);
  ctx.lineTo(20, -36);
  ctx.lineTo(18, -68);
  ctx.lineTo(-18, -68);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgba(126,231,255,${0.6 + 0.4 * mash})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = `rgba(126,231,255,${0.7 + 0.3 * mash})`;
  ctx.font = `bold 11px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("</>", 0, -52);

  // Coffee mug with steam.
  ctx.save();
  ctx.translate(40, -33);
  ctx.rotate(-0.35 * hurt);
  ctx.fillStyle = "#e6edf3";
  roundRectPath(ctx, -7, -14, 14, 14, 2);
  ctx.fill();
  ctx.strokeStyle = "#e6edf3";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(8, -7, 4, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.fillStyle = "#3b2416";
  ctx.beginPath();
  ctx.ellipse(0, -13, 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const s of [-2.5, 2.5]) {
    const ph = time * 2 + s;
    ctx.moveTo(s, -16);
    ctx.quadraticCurveTo(s + Math.sin(ph) * 3, -22, s + Math.sin(ph + 1) * 2, -28);
  }
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}
