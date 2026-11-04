#!/usr/bin/env node
/**
 * Generates PWA icons (192x192 and 512x512) from an SVG source.
 * Run: node scripts/generate-pwa-icons.mjs
 *
 * Requires: npm install --save-dev sharp
 */
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

// Ensure public directory exists
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

// Shopping cart icon SVG - a simple, recognizable icon for a shopping app
const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0a0a0a"/>
  <g fill="none" stroke="#ffffff" stroke-width="24" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="200" cy="400" r="28"/>
    <circle cx="360" cy="400" r="28"/>
    <path d="M80 120h56l48 200h200l40-140H180"/>
  </g>
</svg>
`;

const sizes = [192, 512];

async function generateIcons() {
  for (const size of sizes) {
    const outputPath = join(publicDir, `icon-${size}x${size}.png`);
    await sharp(Buffer.from(iconSvg))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: ${outputPath}`);
  }
  console.log("PWA icons generated successfully!");
}

generateIcons().catch(console.error);
