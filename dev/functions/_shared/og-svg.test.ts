import { describe, it, expect } from 'vitest';
import { buildShareSvg } from './og-svg';

/** Baseline params for building an SVG — override per-test as needed. */
function baseParams() {
  return {
    challengeTitle: 'Fix the Broken Cache',
    solverName: 'alice',
    costStr: '$0.42',
    rank: 3,
    totalSolvers: 25,
    difficulty: 'medium',
    category: 'Debugging',
    passedTests: 5,
    totalTests: 5,
  };
}

// ---------------------------------------------------------------------------
// escapeXml (exercised via buildShareSvg)
// ---------------------------------------------------------------------------
describe('XML escaping in SVG output', () => {
  it('escapes ampersand in title', () => {
    const svg = buildShareSvg({ ...baseParams(), challengeTitle: 'A & B' });
    expect(svg).toContain('A &amp; B');
    expect(svg).not.toContain('A & B');
  });

  it('escapes < and > in title', () => {
    const svg = buildShareSvg({ ...baseParams(), challengeTitle: '<script>alert(1)</script>' });
    expect(svg).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(svg).not.toContain('<script>');
  });

  it('escapes double quotes in solver name', () => {
    const svg = buildShareSvg({ ...baseParams(), solverName: 'user"name' });
    expect(svg).toContain('user&quot;name');
  });

  it('escapes single quotes (apostrophes) in title', () => {
    const svg = buildShareSvg({ ...baseParams(), challengeTitle: "O'Reilly" });
    expect(svg).toContain('O&apos;Reilly');
  });

  it('escapes all five XML special characters when combined', () => {
    const nasty = '<"&\'>';
    const svg = buildShareSvg({ ...baseParams(), challengeTitle: nasty });
    expect(svg).toContain('&lt;&quot;&amp;&apos;&gt;');
  });

  it('escapes category text', () => {
    const svg = buildShareSvg({ ...baseParams(), category: 'A & B' });
    expect(svg).toContain('A &amp; B');
  });

  it('escapes costStr text', () => {
    const svg = buildShareSvg({ ...baseParams(), costStr: '$0 <free>' });
    expect(svg).toContain('$0 &lt;free&gt;');
  });
});

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------
describe('text truncation', () => {
  it('truncates challenge titles longer than 45 characters', () => {
    const longTitle = 'A'.repeat(50);
    const svg = buildShareSvg({ ...baseParams(), challengeTitle: longTitle });
    // truncate(s, 45) → first 45 chars + "..."
    expect(svg).toContain('A'.repeat(45) + '...');
    expect(svg).not.toContain('A'.repeat(46));
  });

  it('does not truncate titles exactly 45 characters long', () => {
    const exact = 'B'.repeat(45);
    const svg = buildShareSvg({ ...baseParams(), challengeTitle: exact });
    expect(svg).toContain(exact);
    expect(svg).not.toContain(exact + '...');
  });

  it('does not truncate titles shorter than 45 characters', () => {
    const short = 'C'.repeat(10);
    const svg = buildShareSvg({ ...baseParams(), challengeTitle: short });
    expect(svg).toContain(short);
    expect(svg).not.toContain('...');
  });

  it('truncates solver names longer than 30 characters', () => {
    const longSolver = 'x'.repeat(35);
    const svg = buildShareSvg({ ...baseParams(), solverName: longSolver });
    expect(svg).toContain('x'.repeat(30) + '...');
    expect(svg).not.toContain('x'.repeat(31));
  });

  it('does not truncate solver names exactly 30 characters long', () => {
    const exact = 'y'.repeat(30);
    const svg = buildShareSvg({ ...baseParams(), solverName: exact });
    expect(svg).toContain(exact);
    expect(svg).not.toContain(exact + '...');
  });
});

// ---------------------------------------------------------------------------
// difficultyColor
// ---------------------------------------------------------------------------
describe('difficulty color mapping', () => {
  it('uses green tones for "easy"', () => {
    const svg = buildShareSvg({ ...baseParams(), difficulty: 'easy' });
    expect(svg).toContain('fill="#1a3a2a"');
    expect(svg).toContain('fill="#3fb950"');
  });

  it('uses gold tones for "medium"', () => {
    const svg = buildShareSvg({ ...baseParams(), difficulty: 'medium' });
    expect(svg).toContain('fill="#3a2f1a"');
    expect(svg).toContain('fill="#c9a962"');
  });

  it('uses red tones for "hard"', () => {
    const svg = buildShareSvg({ ...baseParams(), difficulty: 'hard' });
    expect(svg).toContain('fill="#3a1a1a"');
    expect(svg).toContain('fill="#f85149"');
  });

  it('is case-insensitive for difficulty', () => {
    const svgUpper = buildShareSvg({ ...baseParams(), difficulty: 'EASY' });
    expect(svgUpper).toContain('fill="#1a3a2a"');
    expect(svgUpper).toContain('fill="#3fb950"');

    const svgMixed = buildShareSvg({ ...baseParams(), difficulty: 'Hard' });
    expect(svgMixed).toContain('fill="#3a1a1a"');
    expect(svgMixed).toContain('fill="#f85149"');
  });

  it('uses gray fallback for unknown difficulty', () => {
    const svg = buildShareSvg({ ...baseParams(), difficulty: 'impossible' });
    expect(svg).toContain('fill="#2a2a2a"');
    expect(svg).toContain('fill="#9a938a"');
  });
});

// ---------------------------------------------------------------------------
// SVG structural integrity
// ---------------------------------------------------------------------------
describe('SVG structural elements', () => {
  const svg = buildShareSvg(baseParams());

  it('starts with a valid SVG root element', () => {
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain('viewBox="0 0 1200 630"');
  });

  it('contains gradient definitions', () => {
    expect(svg).toContain('<defs>');
    expect(svg).toContain('id="bg"');
    expect(svg).toContain('id="gold"');
    expect(svg).toContain('</defs>');
  });

  it('contains background rect using gradient', () => {
    expect(svg).toContain('fill="url(#bg)"');
  });

  it('contains grid lines group with low opacity', () => {
    expect(svg).toContain('opacity="0.03"');
    expect(svg).toContain('stroke="#c9a962"');
  });

  it('contains gold accent bars at top and bottom', () => {
    expect(svg).toContain('y="0" width="1200" height="4" fill="url(#gold)"');
    expect(svg).toContain('y="626" width="1200" height="4" fill="url(#gold)"');
  });

  it('contains ruwt.dev branding text', () => {
    expect(svg).toContain('>ruwt.dev<');
  });

  it('contains the challenge title', () => {
    expect(svg).toContain('Fix the Broken Cache');
  });

  it('contains the difficulty pill with correct label', () => {
    // "medium" → first char uppercase → "Medium"
    expect(svg).toContain('>Medium<');
  });

  it('contains the category label', () => {
    expect(svg).toContain('>Debugging<');
  });

  it('contains the AI Cost section with cost value', () => {
    expect(svg).toContain('>AI Cost<');
    expect(svg).toContain('>$0.42<');
  });

  it('contains the Rank section with rank and total', () => {
    expect(svg).toContain('>Rank<');
    expect(svg).toContain('>#3<');
    expect(svg).toContain('/ 25');
  });

  it('contains the Tests section with pass/total', () => {
    expect(svg).toContain('>Tests<');
    expect(svg).toContain('>5/5<');
  });

  it('contains the solver CTA line', () => {
    expect(svg).toContain('>alice <');
    expect(svg).toContain('solved this for');
    expect(svg).toContain('>Can you beat that?<');
  });

  it('contains the bottom-right domain', () => {
    expect(svg).toContain('text-anchor="end">ruwt.dev</text>');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('parameter edge cases', () => {
  it('handles a very long title by truncating to 45 + "..."', () => {
    const longTitle = 'Implement a Distributed Cache with Consistent Hashing and Replication Factor Management';
    const svg = buildShareSvg({ ...baseParams(), challengeTitle: longTitle });
    const expected = longTitle.slice(0, 45) + '...';
    expect(svg).toContain(expected);
  });

  it('handles zero cost', () => {
    const svg = buildShareSvg({ ...baseParams(), costStr: '$0.00' });
    expect(svg).toContain('>$0.00<');
  });

  it('handles rank 1 of 1', () => {
    const svg = buildShareSvg({ ...baseParams(), rank: 1, totalSolvers: 1 });
    expect(svg).toContain('>#1<');
    expect(svg).toContain('/ 1');
  });

  it('handles 0 passed tests out of total', () => {
    const svg = buildShareSvg({ ...baseParams(), passedTests: 0, totalTests: 10 });
    expect(svg).toContain('>0/10<');
  });

  it('handles empty string fields without crashing', () => {
    const svg = buildShareSvg({
      challengeTitle: '',
      solverName: '',
      costStr: '',
      rank: 0,
      totalSolvers: 0,
      difficulty: '',
      category: '',
      passedTests: 0,
      totalTests: 0,
    });
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    // Empty difficulty falls through to default colors
    expect(svg).toContain('fill="#2a2a2a"');
  });

  it('capitalizes first letter of difficulty for the pill label', () => {
    const svg = buildShareSvg({ ...baseParams(), difficulty: 'hard' });
    expect(svg).toContain('>Hard<');
  });

  it('handles difficulty with already capitalized input', () => {
    const svg = buildShareSvg({ ...baseParams(), difficulty: 'Easy' });
    // charAt(0).toUpperCase() + slice(1) → "Easy"
    expect(svg).toContain('>Easy<');
    // Color mapping is case-insensitive
    expect(svg).toContain('fill="#1a3a2a"');
  });
});
