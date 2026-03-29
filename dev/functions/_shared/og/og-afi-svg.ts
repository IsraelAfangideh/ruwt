/**
 * OG image SVG builder for AFI share cards.
 * Generates a 1200x630 SVG showing a user's AI Fluency Index score.
 */

interface AfiOgParams {
  name: string;
  score: number;
  tier: string;
  certification: string | null;
  solveCount: number;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function tierColor(tier: string): string {
  switch (tier) {
    case 'exceptional': return '#c9a962';
    case 'advanced': return '#b8993e';
    case 'proficient': return '#8a7d5a';
    case 'developing': return '#6b6560';
    default: return '#4a4540';
  }
}

function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function certLabel(cert: string | null): string {
  if (cert === 'ai_fluent_expert') return 'AI-Fluent Expert';
  if (cert === 'ai_fluent_pro') return 'AI-Fluent Pro';
  if (cert === 'ai_fluent') return 'AI-Fluent';
  return '';
}

export function buildAfiShareSvg(params: AfiOgParams): string {
  const { name, score, tier, certification, solveCount } = params;
  const color = tierColor(tier);
  const label = tierLabel(tier);
  const cert = certLabel(certification);
  const safeName = escapeXml(name.length > 30 ? name.slice(0, 30) + '...' : name);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1816"/>
      <stop offset="100%" stop-color="#0f0e0d"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Top accent bar -->
  <rect width="1200" height="4" fill="${color}" opacity="0.8"/>

  <!-- Bottom accent bar -->
  <rect y="626" width="1200" height="4" fill="${color}" opacity="0.8"/>

  <!-- Logo -->
  <text x="80" y="80" font-family="Georgia, serif" font-size="28" font-weight="700" fill="${color}">ruwt.dev</text>

  <!-- Label -->
  <text x="600" y="180" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="16" fill="#6b6560" letter-spacing="3" text-transform="uppercase">AI FLUENCY INDEX</text>

  <!-- Score -->
  <text x="600" y="310" text-anchor="middle" font-family="Georgia, serif" font-size="140" font-weight="700" fill="${color}">${score}</text>

  <!-- Tier pill -->
  <rect x="${600 - label.length * 7}" y="335" width="${label.length * 14 + 24}" height="32" rx="16" fill="${color}" opacity="0.2"/>
  <text x="600" y="357" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="14" font-weight="700" fill="${color}" letter-spacing="1">${label.toUpperCase()}</text>

  <!-- Out of 850 -->
  <text x="600" y="395" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="14" fill="#4a4540">out of 850</text>

  <!-- Certification badge (if earned) -->
  ${cert ? `<text x="600" y="440" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="18" font-weight="600" fill="${color}">${escapeXml(cert)} Verified</text>` : ''}

  <!-- Name -->
  <text x="600" y="510" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="22" fill="#e8e4df">${safeName}</text>

  <!-- Solve count -->
  <text x="600" y="540" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="14" fill="#6b6560">${solveCount} challenge${solveCount !== 1 ? 's' : ''} solved</text>

  <!-- CTA -->
  <text x="600" y="590" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="14" fill="#4a4540">What's your AI Fluency Index? Find out at ruwt.dev</text>

  <!-- Domain -->
  <text x="1120" y="80" text-anchor="end" font-family="Helvetica Neue, Arial, sans-serif" font-size="14" fill="#4a4540">ruwt.dev</text>
</svg>`;
}
