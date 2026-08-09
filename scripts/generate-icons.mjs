// Regenerates the PWA/app icons from an inline SVG source.
// Run with: node scripts/generate-icons.mjs
// Safe to re-run any time the brand mark or colors change.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const BRAND_FROM = "#8a05be";
const BRAND_TO = "#560a82";

// Trending-up glyph (same shape as the lucide TrendingUp icon used in the
// app header/login), scaled/centered onto a 512x512 canvas.
function glyphPaths(scale, offset) {
  const p = (x, y) => `${(offset + x * scale).toFixed(1)},${(offset + y * scale).toFixed(1)}`;
  const line1 = ["22,7", "13.5,15.5", "8.5,10.5", "2,17"]
    .map((pt) => {
      const [x, y] = pt.split(",").map(Number);
      return p(x, y);
    })
    .join(" ");
  const line2 = ["16,7", "22,7", "22,13"]
    .map((pt) => {
      const [x, y] = pt.split(",").map(Number);
      return p(x, y);
    })
    .join(" ");
  return { line1, line2 };
}

function iconSvg({ rounded }) {
  // content box: centered square with padding inside the 512 canvas
  const contentSize = rounded ? 256 : 224;
  const scale = contentSize / 24;
  const offset = (512 - contentSize) / 2;
  const { line1, line2 } = glyphPaths(scale, offset);
  const strokeWidth = (2 * scale).toFixed(1);
  const rect = rounded
    ? `<rect width="512" height="512" rx="115" fill="url(#g)"/>`
    : `<rect width="512" height="512" fill="url(#g)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${BRAND_FROM}"/>
      <stop offset="100%" stop-color="${BRAND_TO}"/>
    </linearGradient>
  </defs>
  ${rect}
  <polyline points="${line1}" fill="none" stroke="#ffffff" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="${line2}" fill="none" stroke="#ffffff" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

async function renderPng(svg, size, outPath) {
  const buffer = await sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toBuffer();
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, buffer);
  console.log("wrote", outPath, `${size}x${size}`);
}

const rounded = iconSvg({ rounded: true });
const fullBleed = iconSvg({ rounded: false });

await renderPng(rounded, 192, join(root, "public/icon-192.png"));
await renderPng(rounded, 512, join(root, "public/icon-512.png"));
await renderPng(fullBleed, 512, join(root, "public/icon-512-maskable.png"));
await renderPng(rounded, 512, join(root, "src/app/icon.png"));
await renderPng(fullBleed, 180, join(root, "src/app/apple-icon.png"));

console.log("done");
