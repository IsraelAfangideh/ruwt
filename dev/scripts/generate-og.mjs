/**
 * Prebuild script: generates static assets from SVG sources.
 * - og-image.svg → og-image.png (1200x630, for Twitter/social cards)
 * - favicon.svg → favicon.ico (32x32, for legacy browser support)
 * - favicon.svg → apple-touch-icon.png (180x180, for iOS home screen)
 * Run: node scripts/generate-og.mjs
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');

// OG image: SVG → PNG
const ogSvg = readFileSync(resolve(publicDir, 'og-image.svg'));
await sharp(ogSvg)
  .resize(1200, 630)
  .png({ quality: 90 })
  .toFile(resolve(publicDir, 'og-image.png'));
console.log('Generated og-image.png (1200x630)');

// Favicon: SVG → ICO (PNG in ICO container)
const favSvg = readFileSync(resolve(publicDir, 'favicon.svg'));
await sharp(favSvg)
  .resize(32, 32)
  .png()
  .toFile(resolve(publicDir, 'favicon.ico'));
console.log('Generated favicon.ico (32x32)');

// Apple Touch Icon: SVG → PNG (180x180)
await sharp(favSvg)
  .resize(180, 180)
  .png()
  .toFile(resolve(publicDir, 'apple-touch-icon.png'));
console.log('Generated apple-touch-icon.png (180x180)');
