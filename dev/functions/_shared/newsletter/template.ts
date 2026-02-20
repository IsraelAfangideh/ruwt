/**
 * HTML email template for the ruwt.dev daily newsletter.
 * Platform updates first, dev news links at the bottom.
 * Kept simple for Gmail Primary inbox placement.
 */

import type { CuratedStory, PlatformActivity } from './content';

interface NewsletterData {
  date: string;
  platformDigest: string;     // AI-written platform update (main content)
  stories: CuratedStory[];    // dev news links (bottom)
  activity: PlatformActivity; // raw stats for footer
}

export function buildNewsletterHtml(data: NewsletterData): string {
  // Convert \n\n in digest to <p> tags
  const digestHtml = data.platformDigest
    .split('\n\n')
    .filter((p) => p.trim())
    .map((p) => `<p style="margin: 0 0 14px 0; line-height: 1.6;">${escapeHtml(p.trim())}</p>`)
    .join('\n');

  const storiesHtml = data.stories.length > 0
    ? `<p style="margin: 24px 0 12px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: #8a847a; font-weight: 600;">Elsewhere</p>
${data.stories.map((s) =>
  `<p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.5;"><a href="${escapeHtml(s.url)}" style="color: #1a1816; text-decoration: underline;">${escapeHtml(s.title)}</a> <span style="color: #8a847a; font-size: 12px;">${escapeHtml(s.source)}</span><br><span style="color: #5c564e; font-size: 13px;">${escapeHtml(s.take)}</span></p>`
).join('\n')}`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ruwt.dev — ${escapeHtml(data.date)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #1a1816; background-color: #ffffff;">
<div style="max-width: 540px; margin: 0 auto; padding: 32px 20px;">

<p style="margin: 0 0 4px 0; font-size: 17px; font-weight: 700; color: #1a1816;">ruwt.dev <span style="font-weight: 400; color: #8a847a;">daily</span></p>
<p style="margin: 0 0 20px 0; font-size: 13px; color: #8a847a;">${escapeHtml(data.date)}</p>

${digestHtml}

${storiesHtml}

<p style="margin: 28px 0 0 0; font-size: 12px; color: #b0aaa0; line-height: 1.6;">You're on <a href="https://ruwt.dev" style="color: #8a847a;">ruwt.dev</a>. <a href="https://ruwt.dev/settings" style="color: #8a847a;">Unsubscribe</a></p>

</div>
</body>
</html>`;
}

export function buildNewsletterText(data: NewsletterData): string {
  const header = `ruwt.dev daily — ${data.date}\n---\n\n`;

  const digest = data.platformDigest + '\n';

  const stories = data.stories.length > 0
    ? '\n\nElsewhere:\n\n' + data.stories.map((s, i) => `${i + 1}. ${s.title} (${s.source})\n   ${s.take}\n   ${s.url}`).join('\n\n')
    : '';

  const footer = `\n\n---\nYou're on ruwt.dev. Unsubscribe: https://ruwt.dev/settings`;

  return header + digest + stories + footer;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
