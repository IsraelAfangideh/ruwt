/**
 * Converts og-image.svg to og-image.png for social platform compatibility.
 * Twitter/X requires PNG/JPG for card images.
 * Run: node scripts/generate-og.mjs
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dirname, '../public/og-image.svg');
const pngPath = resolve(__dirname, '../public/og-image.png');

const svg = readFileSync(svgPath);

await sharp(svg)
  .resize(1200, 630)
  .png({ quality: 90 })
  .toFile(pngPath);

console.log('Generated og-image.png (1200x630)');
