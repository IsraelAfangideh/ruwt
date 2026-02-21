/**
 * HTML email template for the ruwt.dev daily newsletter.
 * Personal hook first, platform digest, dev news links at the bottom.
 * Kept simple for Gmail Primary inbox placement.
 */

import type { CuratedStory, PlatformActivity } from './content';

interface NewsletterData {
  date: string;
  platformDigest: string;
  stories: CuratedStory[];
  activity: PlatformActivity;
  personalHook?: string | null;
  linkedinDraft?: string | null;
}

export function buildNewsletterHtml(data: NewsletterData): string {
  const hookHtml = data.personalHook
    ? `<p style="margin: 0 0 18px 0; line-height: 1.6; font-style: italic; color: #5c564e;">${escapeHtml(data.personalHook)}</p>\n`
    : '';

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

<p style="margin: 0 0 20px 0; font-size: 13px; color: #8a847a;">ruwt.dev daily — ${escapeHtml(data.date)}</p>

${hookHtml}${digestHtml}

${storiesHtml}

${data.linkedinDraft ? `<p style="margin: 28px 0 12px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: #8a847a; font-weight: 600;">LinkedIn draft (copy &amp; paste)</p>
<div style="background-color: #f5f3f0; border-radius: 8px; padding: 16px; font-size: 14px; line-height: 1.6; color: #1a1816; white-space: pre-wrap;">${escapeHtml(data.linkedinDraft)}</div>` : ''}

<p style="margin: 28px 0 0 0; font-size: 12px; color: #b0aaa0; line-height: 1.6;">You're on <a href="https://ruwt.dev" style="color: #8a847a;">ruwt.dev</a>. <a href="https://ruwt.dev/settings" style="color: #8a847a;">Unsubscribe</a></p>

</div>
</body>
</html>`;
}

export function buildNewsletterText(data: NewsletterData): string {
  const header = `ruwt.dev daily — ${data.date}\n---\n\n`;

  const hook = data.personalHook ? data.personalHook + '\n\n' : '';

  const digest = data.platformDigest + '\n';

  const stories = data.stories.length > 0
    ? '\n\nElsewhere:\n\n' + data.stories.map((s, i) => `${i + 1}. ${s.title} (${s.source})\n   ${s.take}\n   ${s.url}`).join('\n\n')
    : '';

  const linkedin = data.linkedinDraft
    ? `\n\n---\nLINKEDIN DRAFT (copy & paste):\n\n${data.linkedinDraft}`
    : '';

  const footer = `\n\n---\nYou're on ruwt.dev. Unsubscribe: https://ruwt.dev/settings`;

  return header + hook + digest + stories + linkedin + footer;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
