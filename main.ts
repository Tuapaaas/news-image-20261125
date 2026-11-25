// news-image-20261125 — "The world in one image", Wednesday 25 November 2026.
// A Node 22 program, standard library only, that draws a newspaper front page
// summarising the day's world news and writes it as a deterministic 1024x1024 PNG
// to /output/entry.png (or $MAKEFUN_OUTPUT_DIR when run outside the grader).
// No network, no clock, no randomness: two runs write identical bytes.
//
// Front page, top to bottom:
//   masthead — THE WORLD IN ONE IMAGE / WEDNESDAY, 25 NOVEMBER 2026
//   lead — Ukraine sinks a Russian warship off Benghazi, Libya
//   COP31 collapses with no fossil-fuel deal · NATO sends AWACS to Poland
//   Hormuz tankers burn · Nvidia surges as Huang returns · CIA/ODNI breached
//   ticker — Gaza toll, Russian war dead, England beat Australia, Giuliani honoured

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
type RGB = [number, number, number];
const PAPER: RGB = [244, 237, 220];
const INK: RGB = [25, 21, 18];
const NAVY: RGB = [22, 35, 61];
const NAVY_LT: RGB = [38, 56, 92];
const RED: RGB = [169, 44, 28];
const TEAL: RGB = [15, 95, 92];
const TEAL_DK: RGB = [9, 63, 61];
const GOLD: RGB = [185, 138, 29];
const GREEN: RGB = [30, 122, 52];
const ORANGE: RGB = [224, 123, 31];
const YELLOW: RGB = [240, 178, 44];
const GREY: RGB = [107, 101, 90];
const WHITE: RGB = [250, 248, 242];
const SKY: RGB = [168, 196, 214];
const SEA: RGB = [28, 84, 110];
const BROWN: RGB = [122, 84, 52];

// ---------------------------------------------------------------- pixels
const px = new Uint8Array(W * H * 3);
function paint(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}
function dot(x: number, y: number, c: RGB): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
  const o = (iy * W + ix) * 3;
  px[o] = c[0];
  px[o + 1] = c[1];
  px[o + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const o = (yy * W + xx) * 3;
      px[o] = c[0];
      px[o + 1] = c[1];
      px[o + 2] = c[2];
    }
  }
}
function hline(x0: number, x1: number, y: number, c: RGB): void {
  rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, c);
}
function vline(x: number, y0: number, y1: number, c: RGB): void {
  rect(x, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= n; i++) {
    dot(x0 + (dx * i) / n, y0 + (dy * i) / n, c);
  }
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  const r2 = r * r;
  for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) {
    for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy <= r2) dot(xx, yy, c);
    }
  }
}
function ring(cx: number, cy: number, r: number, c: RGB): void {
  const steps = Math.max(24, Math.floor(r * 6));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, c);
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.floor(Math.min(x0, x1, x2));
  const maxX = Math.ceil(Math.max(x0, x1, x2));
  const minY = Math.floor(Math.min(y0, y1, y2));
  const maxY = Math.ceil(Math.max(y0, y1, y2));
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (d === 0) return;
  for (let yy = minY; yy <= maxY; yy++) {
    for (let xx = minX; xx <= maxX; xx++) {
      const a = ((x1 - xx) * (y2 - yy) - (y1 - yy) * (x2 - xx)) / d;
      const b = ((x2 - xx) * (y0 - yy) - (y2 - yy) * (x0 - xx)) / d;
      const g = 1 - a - b;
      if (a >= 0 && b >= 0 && g >= 0) dot(xx, yy, c);
    }
  }
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph is 7 rows of 5 bits; bit 4 is the leftmost pixel.
const GLYPHS: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ',': [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ':': [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ';': [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '-': [0, 0, 0, 0x1f, 0, 0, 0],
  '/': [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  '%': [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  '+': [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  '&': [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  '·': [0, 0, 0, 0x04, 0, 0, 0],
  '—': [0, 0, 0, 0x1f, 0, 0, 0],
  '~': [0, 0, 0x0a, 0x15, 0, 0, 0],
};
function glyph(ch: string): number[] {
  const up = ch.toUpperCase();
  return GLYPHS[up] ?? GLYPHS['?'];
}
function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawGlyph(ch: string, x: number, y: number, scale: number, c: RGB): void {
  const rows = glyph(ch);
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (rows[r] & (1 << (4 - col))) {
        rect(x + col * scale, y + r * scale, scale, scale, c);
      }
    }
  }
}
function drawText(s: string, x: number, y: number, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    drawGlyph(ch, cx, y, scale, c);
    cx += 6 * scale;
  }
}
function drawTextCentered(s: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}
// Word-wrap a paragraph into lines no wider than maxW pixels. Returns lines.
function wrap(s: string, scale: number, maxW: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (textWidth(trial, scale) <= maxW || !cur) {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function paragraph(s: string, x: number, y: number, scale: number, maxW: number, c: RGB): number {
  const lines = wrap(s, scale, maxW);
  const lh = 10 * scale;
  lines.forEach((ln, i) => drawText(ln, x, y + i * lh, scale, c));
  return y + lines.length * lh;
}

// ---------------------------------------------------------------- scenes
function starburst(cx: number, cy: number, rOuter: number, rInner: number, spikes: number, c: RGB): void {
  for (let i = 0; i < spikes; i++) {
    const a0 = (i / spikes) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 0.5) / spikes) * Math.PI * 2 - Math.PI / 2;
    const a2 = ((i + 1) / spikes) * Math.PI * 2 - Math.PI / 2;
    tri(
      cx, cy,
      cx + Math.cos(a0) * rOuter, cy + Math.sin(a0) * rOuter,
      cx + Math.cos(a1) * rInner, cy + Math.sin(a1) * rInner,
      c,
    );
    tri(
      cx, cy,
      cx + Math.cos(a1) * rInner, cy + Math.sin(a1) * rInner,
      cx + Math.cos(a2) * rOuter, cy + Math.sin(a2) * rOuter,
      c,
    );
  }
}
// Lead illustration: a warship on a dark sea, a drone above it, an explosion
// bursting from its deck — Ukraine's strike off Benghazi, Libya.
function drawSeaStrike(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, SKY);
  // sun glare
  disc(x + w - 90, y + 42, 26, YELLOW);
  disc(x + w - 90, y + 42, 18, [250, 214, 110]);
  // sea
  rect(x, y + h - 64, w, 64, SEA);
  rect(x, y + h - 64, w, 4, TEAL_DK);
  // wave lines
  for (let i = 0; i < 5; i++) {
    const wy = y + h - 52 + i * 11;
    for (let wx = x + 14 + (i % 2) * 46; wx < x + w - 30; wx += 92) {
      hline(wx, wx + 52, wy, [120, 178, 198]);
    }
  }
  // warship hull, left of centre
  const hx = x + 70;
  const hy = y + h - 84;
  tri(hx, hy + 26, hx + 30, hy, hx + 300, hy, INK);
  rect(hx + 30, hy, 270, 26, INK);
  rect(hx + 300, hy + 8, 60, 18, INK);
  // deck: mast, bridge, funnel
  rect(hx + 90, hy - 34, 8, 34, INK);
  rect(hx + 78, hy - 44, 32, 10, INK);
  rect(hx + 150, hy - 30, 46, 30, INK);
  rect(hx + 210, hy - 22, 10, 22, RED);
  rect(hx + 232, hy - 22, 10, 22, RED);
  // portholes
  for (let i = 0; i < 6; i++) disc(hx + 60 + i * 38, hy + 13, 4, GOLD);
  // drone above the ship
  const dx = hx + 250;
  const dy = y + 34;
  rect(dx - 16, dy - 6, 32, 12, INK);
  rect(dx - 34, dy - 10, 12, 4, INK);
  rect(dx + 22, dy - 10, 12, 4, INK);
  vline(dx - 28, dy - 10, dy + 8, INK);
  vline(dx + 28, dy - 10, dy + 8, INK);
  line(dx - 34, dy + 22, dx - 6, dy + 52, INK);
  line(dx + 34, dy + 22, dx + 6, dy + 52, INK);
  // explosion bursting from the deck
  const ex = hx + 320;
  const ey = hy + 2;
  starburst(ex, ey, 38, 16, 9, ORANGE);
  starburst(ex, ey, 24, 10, 9, YELLOW);
  disc(ex, ey, 10, WHITE);
  // smoke
  disc(ex - 50, ey - 20, 12, GREY);
  disc(ex - 26, ey - 30, 14, [140, 134, 124]);
  // caption bar
  rect(x, y + h - 22, w, 22, NAVY);
  drawText('UKRAINE DRONE STRIKE · BENGHAZI HARBOUR, LIBYA', x + 14, y + h - 17, 2, WHITE);
}

// COP31 panel: a cracked, dry earth under a pale sun — the summit that ended
// in Antalya with no fossil-fuel deal.
function drawCop31(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [232, 214, 178]);
  disc(x + w - 52, y + 44, 30, YELLOW);
  disc(x + w - 52, y + 44, 22, [246, 205, 92]);
  // cracked ground
  const gy = y + h - 52;
  rect(x, gy, w, 52, BROWN);
  line(x + 30, gy, x + 90, gy + 52, INK);
  line(x + 90, gy + 52, x + 150, gy + 20, INK);
  line(x + 150, gy + 20, x + 120, gy + 52, INK);
  line(x + 210, gy, x + 250, gy + 40, INK);
  line(x + 250, gy + 40, x + 300, gy + 12, INK);
  line(x + 300, gy + 12, x + 330, gy + 52, INK);
  line(x + 360, gy, x + 380, gy + 30, INK);
  drawText('NO DEAL', x + 40, y + 60, 4, RED);
  drawText('ANTALYA · FOSSIL FUELS', x + 40, y + 100, 2, INK);
  drawText('LEFT OUT OF THE TEXT', x + 40, y + 120, 2, INK);
}

// NATO panel: radar rings sweeping over a map pin — AWACS to Poland after
// Russian missiles crossed into Polish airspace.
function drawNato(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, NAVY);
  drawText('AWACS TO POLAND', x + 24, y + 16, 3, WHITE);
  drawText('AFTER MISSILES CROSSED', x + 24, y + 48, 2, [190, 205, 225]);
  drawText('INTO POLISH AIRSPACE', x + 24, y + 68, 2, [190, 205, 225]);
  const cx = x + w / 2;
  const cy = y + 132;
  ring(cx, cy, 44, [110, 140, 180]);
  ring(cx, cy, 30, [110, 140, 180]);
  ring(cx, cy, 16, [110, 140, 180]);
  line(cx, cy, cx + 38, cy - 22, [120, 220, 160]);
  disc(cx + 38, cy - 22, 5, [120, 220, 160]);
  disc(cx - 20, cy + 10, 3, [120, 220, 160]);
  disc(cx + 24, cy + 14, 3, [120, 220, 160]);
  disc(cx, cy, 5, YELLOW);
}

// Hormuz panel: a tanker with flames — three tankers hit by mines in the strait.
function drawHormuz(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [214, 226, 232]);
  drawText('TANKERS BURN', x + 24, y + 18, 3, INK);
  drawText('IN HORMUZ', x + 24, y + 48, 3, RED);
  const gy = y + h - 34;
  rect(x, gy, w, 34, SEA);
  // tanker
  const tx = x + 26;
  const ty = gy - 34;
  rect(tx, ty, 220, 34, RED);
  rect(tx + 180, ty - 26, 34, 26, INK);
  rect(tx + 20, ty - 16, 60, 16, WHITE);
  // flames
  tri(tx + 60, ty, tx + 80, ty - 24, tx + 100, ty, ORANGE);
  tri(tx + 96, ty, tx + 112, ty - 18, tx + 128, ty, YELLOW);
  tri(tx + 130, ty, tx + 146, ty - 22, tx + 164, ty, ORANGE);
  disc(tx + 80, ty - 30, 10, GREY);
  disc(tx + 120, ty - 26, 12, GREY);
  drawText('THREE HIT BY MINES', x + 24, gy + 10, 2, WHITE);
}

// Nvidia panel: a rising chart — Huang returns as CEO, shares jump 31.5%.
function drawNvidia(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [226, 240, 226]);
  drawText('NVIDIA +31.5%', x + 24, y + 16, 3, GREEN);
  drawText('HUANG BACK', x + 24, y + 46, 3, INK);
  drawText('AS CEO', x + 24, y + 74, 3, INK);
  // chart grid
  for (let i = 0; i < 3; i++) hline(x + 24, x + w - 24, y + 108 + i * 18, [190, 205, 190]);
  const pts: [number, number][] = [
    [x + 30, y + 150],
    [x + 80, y + 140],
    [x + 120, y + 146],
    [x + 160, y + 126],
    [x + 200, y + 132],
    [x + 240, y + 116],
    [x + 268, y + 106],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], GREEN);
    line(pts[i][0], pts[i][1] + 2, pts[i + 1][0], pts[i + 1][1] + 2, GREEN);
  }
  for (const [px0, py0] of pts) disc(px0, py0, 4, GREEN);
  // arrowhead
  tri(pts[6][0] - 4, pts[6][1] + 14, pts[6][0] + 16, pts[6][1] - 2, pts[6][0] - 2, pts[6][1] - 12, GREEN);
  drawText('~$1T BACK IN A DAY', x + 24, y + 164, 2, INK);
}

// CIA panel: a padlock with a crack — the CIA and ODNI breached.
function drawCia(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [238, 232, 220]);
  drawText('CIA + ODNI', x + 24, y + 18, 3, INK);
  drawText('BREACHED', x + 24, y + 48, 3, RED);
  // padlock, right side
  const cx = x + w - 70;
  const cy = y + 118;
  // shackle
  ring(cx, cy - 14, 20, INK);
  rect(cx - 20, cy - 14, 40, 8, [238, 232, 220]);
  // body
  rect(cx - 42, cy - 4, 84, 56, NAVY);
  rect(cx - 42, cy - 4, 84, 8, NAVY_LT);
  // keyhole
  disc(cx, cy + 16, 8, GOLD);
  rect(cx - 4, cy + 20, 8, 16, GOLD);
  // crack across the body
  line(cx + 42, cy - 4, cx + 22, cy + 18, RED);
  line(cx + 22, cy + 18, cx + 42, cy + 38, RED);
  // sub-lines, left column
  drawText('UNCLASSIFIED', x + 24, y + 92, 2, INK);
  drawText('DATA TAKEN', x + 24, y + 112, 2, INK);
  drawText('SOURCES SAY', x + 24, y + 132, 2, INK);
}

// ---------------------------------------------------------------- PNG writer
function crc32(buf: Buffer): number {
  let table = (crc32 as unknown as { t?: Int32Array }).t;
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    (crc32 as unknown as { t: Int32Array }).t = table;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function toPng(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- the page
function drawPage(): void {
  paint(PAPER);
  // frame
  rect(0, 0, W, 8, INK);
  rect(0, H - 8, W, 8, INK);
  rect(0, 0, 8, H, INK);
  rect(W - 8, 0, 8, H, INK);

  // masthead
  rect(8, 8, W - 16, 118, NAVY);
  drawTextCentered('THE WORLD IN ONE IMAGE', W / 2, 26, 5, WHITE);
  drawTextCentered('WEDNESDAY, 25 NOVEMBER 2026', W / 2, 82, 3, GOLD);
  hline(8, W - 8, 126, INK);

  // kicker strip
  rect(8, 128, W - 16, 34, RED);
  drawTextCentered('UKRAINE STRIKES AT SEA · COP31 COLLAPSES · NATO TO POLAND', W / 2, 137, 2, WHITE);

  // lead headline + standfirst
  drawText('UKRAINE SINKS RUSSIAN', 40, 180, 4, INK);
  drawText('WARSHIP OFF LIBYA', 40, 216, 4, RED);
  paragraph(
    "Zelenskyy confirms a drone strike in Benghazi harbour; Moscow calls it 'terrorism' as the war spills into the Baltic.",
    40, 256, 2, 620, INK,
  );
  drawText('KYIV · BENGHAZI · MOSCOW', 40, 316, 2, GREY);

  // lead illustration
  drawSeaStrike(40, 338, 944, 124);

  // middle row: COP31 | NATO
  rect(40, 486, 452, 236, PAPER);
  rect(40, 486, 452, 3, INK);
  drawText('COP31 COLLAPSES', 40, 498, 3, INK);
  drawCop31(40, 530, 452, 192);
  rect(532, 486, 452, 236, PAPER);
  rect(532, 486, 452, 3, INK);
  drawText('NATO WATCHES', 532, 498, 3, INK);
  drawNato(532, 530, 452, 192);

  // bottom row: Hormuz | Nvidia | CIA
  const bw = 304;
  const gap = 16;
  const bx = [40, 40 + bw + gap, 40 + 2 * (bw + gap)];
  rect(bx[0], 746, bw, 190, PAPER);
  rect(bx[0], 746, bw, 3, INK);
  drawHormuz(bx[0], 756, bw, 180);
  rect(bx[1], 746, bw, 190, PAPER);
  rect(bx[1], 746, bw, 3, INK);
  drawNvidia(bx[1], 756, bw, 180);
  rect(bx[2], 746, bw, 190, PAPER);
  rect(bx[2], 746, bw, 3, INK);
  drawCia(bx[2], 756, bw, 180);

  // footer ticker
  rect(8, 952, W - 16, 64, INK);
  drawTextCentered('GAZA TOLL 74,746 · 700,000 RUSSIAN TROOPS KILLED', W / 2, 964, 2, WHITE);
  drawTextCentered('ENGLAND BEAT AUSTRALIA · TRUMP HONOURS GIULIANI · HUAWEI CONVICTED', W / 2, 990, 2, GOLD);
}

function main(): void {
  drawPage();
  const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'entry.png'), toPng());
}

main();
