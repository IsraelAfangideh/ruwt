/**
 * Dynamic OG image SVG builder.
 * Generates a 1200x630 SVG string for social sharing cards.
 * Uses system-safe fonts (Georgia, Helvetica Neue, Arial) and the Ruwt brand palette.
 */

interface OgSvgParams {
  challengeTitle: string;
  solverName: string;
  costStr: string;
  rank: number;
  totalSolvers: number;
  difficulty: string;
  category: string;
  passedTests: number;
  totalTests: number;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

function difficultyColor(d: string): { bg: string; text: string } {
  switch (d.toLowerCase()) {
    case 'easy': return { bg: '#1a3a2a', text: '#3fb950' };
    case 'medium': return { bg: '#3a2f1a', text: '#c9a962' };
    case 'hard': return { bg: '#3a1a1a', text: '#f85149' };
    default: return { bg: '#2a2a2a', text: '#9a938a' };
  }
}

// 20 vertical + 11 horizontal gold grid lines at 3% opacity (matches existing og-image.svg)
const GRID_LINES = Array.from({ length: 21 }, (_, i) =>
  `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="630" stroke="#c9a962" stroke-width="1"/>`
).concat(Array.from({ length: 11 }, (_, i) =>
  `<line x1="0" y1="${i * 60}" x2="1200" y2="${i * 60}" stroke="#c9a962" stroke-width="1"/>`
)).join('\n    ');

export function buildShareSvg(params: OgSvgParams): string {
  const {
    challengeTitle, solverName, costStr, rank, totalSolvers,
    difficulty, category, passedTests, totalTests,
  } = params;

  const dc = difficultyColor(difficulty);
  const title = escapeXml(truncate(challengeTitle, 45));
  const solver = escapeXml(truncate(solverName, 30));
  const cat = escapeXml(category);
  const diff = escapeXml(difficulty.charAt(0).toUpperCase() + difficulty.slice(1));
  const cost = escapeXml(costStr);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1816"/>
      <stop offset="100%" style="stop-color:#0f0e0d"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#c9a962"/>
      <stop offset="100%" style="stop-color:#9a7b3c"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <!-- Subtle grid -->
  <g opacity="0.03">
    ${GRID_LINES}
  </g>
  <!-- Gold accent bars -->
  <rect x="0" y="0" width="1200" height="4" fill="url(#gold)"/>
  <rect x="0" y="626" width="1200" height="4" fill="url(#gold)"/>

  <!-- Branding -->
  <text x="80" y="70" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="700" fill="#c9a962">ruwt.dev</text>

  <!-- Challenge title -->
  <text x="80" y="200" font-family="Georgia, 'Times New Roman', serif" font-size="52" font-weight="700" fill="#f5f3f0">${title}</text>

  <!-- Difficulty pill + Category -->
  <rect x="80" y="230" width="${diff.length * 14 + 24}" height="32" rx="16" fill="${dc.bg}" stroke="${dc.text}" stroke-width="1"/>
  <text x="${80 + (diff.length * 14 + 24) / 2}" y="251" font-family="'Helvetica Neue', Arial, sans-serif" font-size="14" font-weight="600" fill="${dc.text}" text-anchor="middle">${diff}</text>
  <text x="${80 + diff.length * 14 + 24 + 16}" y="251" font-family="'Helvetica Neue', Arial, sans-serif" font-size="16" fill="#9a938a">${cat}</text>

  <!-- Stats row -->
  <text x="80" y="340" font-family="'Helvetica Neue', Arial, sans-serif" font-size="18" fill="#9a938a">AI Cost</text>
  <text x="80" y="375" font-family="'Helvetica Neue', Arial, sans-serif" font-size="36" font-weight="700" fill="#c9a962">${cost}</text>

  <text x="340" y="340" font-family="'Helvetica Neue', Arial, sans-serif" font-size="18" fill="#9a938a">Rank</text>
  <text x="340" y="375" font-family="'Helvetica Neue', Arial, sans-serif" font-size="36" font-weight="700" fill="#f5f3f0">#${rank}<tspan font-size="18" font-weight="400" fill="#9a938a"> / ${totalSolvers}</tspan></text>

  <text x="580" y="340" font-family="'Helvetica Neue', Arial, sans-serif" font-size="18" fill="#9a938a">Tests</text>
  <text x="580" y="375" font-family="'Helvetica Neue', Arial, sans-serif" font-size="36" font-weight="700" fill="#3fb950">${passedTests}/${totalTests}</text>

  <!-- Solver + CTA -->
  <text x="80" y="480" font-family="'Helvetica Neue', Arial, sans-serif" font-size="22" fill="#f5f3f0">${solver} <tspan fill="#9a938a">solved this for</tspan> <tspan fill="#c9a962">${cost}</tspan></text>
  <text x="80" y="530" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28" font-weight="600" fill="#c9a962">Can you beat that?</text>

  <!-- Bottom domain -->
  <text x="1120" y="590" font-family="'Helvetica Neue', Arial, sans-serif" font-size="16" fill="#9a938a" text-anchor="end">ruwt.dev</text>
</svg>`;
}
