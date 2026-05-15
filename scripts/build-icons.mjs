#!/usr/bin/env node
// One-shot icon rasterizer. Reads app/icon.svg and emits app/icon.png (32x32),
// app/apple-icon.png (180x180), and app/favicon.ico (16+32 multi-res).
// Run with: node scripts/build-icons.mjs

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "app", "icon.svg");

const svg = fs.readFileSync(SRC);

async function pngBuffer(size) {
  return sharp(svg).resize(size, size).png().toBuffer();
}

// PNG icon (Next.js file-based metadata: app/icon.png).
const ICON_PNG = path.join(ROOT, "app", "icon.png");
await sharp(svg).resize(32, 32).png().toFile(ICON_PNG);
console.log("wrote", ICON_PNG);

// Apple touch icon.
const APPLE_PNG = path.join(ROOT, "app", "apple-icon.png");
await sharp(svg).resize(180, 180).png().toFile(APPLE_PNG);
console.log("wrote", APPLE_PNG);

// Multi-resolution favicon.ico (handle 16 + 32 + 48).
// sharp doesn't write .ico natively; pack the 32x32 PNG as a tiny ICO container.
// Format: https://en.wikipedia.org/wiki/ICO_(file_format)
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((s) => pngBuffer(s)));
const dir = Buffer.alloc(6);
dir.writeUInt16LE(0, 0); // reserved
dir.writeUInt16LE(1, 2); // type = ICO
dir.writeUInt16LE(sizes.length, 4); // count

const entries = [];
let offset = 6 + sizes.length * 16;
for (let i = 0; i < sizes.length; i++) {
  const s = sizes[i];
  const png = pngs[i];
  const e = Buffer.alloc(16);
  e.writeUInt8(s === 256 ? 0 : s, 0); // width
  e.writeUInt8(s === 256 ? 0 : s, 1); // height
  e.writeUInt8(0, 2); // colors
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // color planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(png.length, 8); // size
  e.writeUInt32LE(offset, 12); // offset
  entries.push(e);
  offset += png.length;
}
const ico = Buffer.concat([dir, ...entries, ...pngs]);
const ICO = path.join(ROOT, "app", "favicon.ico");
fs.writeFileSync(ICO, ico);
console.log("wrote", ICO);
