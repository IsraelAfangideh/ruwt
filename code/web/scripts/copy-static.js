/**
 * Post-build script to copy static files to Expo Web build output
 * 
 * This copies:
 * - Legal pages (privacy.html, terms.html, delete.html, 404.html)
 * - Cloudflare config files (_redirects, _headers)
 * - Favicon
 */

const fs = require('fs');
const path = require('path');

const webDir = path.join(__dirname, '..');
const mobileDistDir = path.join(__dirname, '..', '..', 'mobile', 'dist');
const outputDir = path.join(webDir, 'dist');

// Files to copy from web directory to build output
const staticFiles = [
  'privacy.html',
  'terms.html',
  'delete.html',
  'child-safety.html',
  '404.html',
  '_redirects',
  '_headers',
  'favicon.svg',
  'styles.css', // Needed for legal pages styling
];

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Copy Expo Web build output to web/dist
console.log('Copying Expo Web build output...');
if (fs.existsSync(mobileDistDir)) {
  copyDir(mobileDistDir, outputDir);
  console.log(`✓ Copied Expo Web build from ${mobileDistDir}`);
} else {
  console.error(`✗ Expo Web build not found at ${mobileDistDir}`);
  console.log('  Run "cd ../mobile && npx expo export --platform web" first');
  process.exit(1);
}

// Copy static files
console.log('\nCopying static files...');
staticFiles.forEach(file => {
  const src = path.join(webDir, file);
  const dest = path.join(outputDir, file);
  
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied ${file}`);
  } else {
    console.log(`  Skipped ${file} (not found)`);
  }
});

console.log('\n✓ Build complete! Output in', outputDir);

// Helper function to recursively copy directory
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

