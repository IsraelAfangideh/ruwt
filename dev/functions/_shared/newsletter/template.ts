/**
 * HTML email template for the ruwt.dev weekly digest.
 *
 * Gmail Primary rules: mimic what Gmail itself generates when a human
 * composes an email. No DOCTYPE, no <head>, no <body>, no inline styles,
 * no centered container. Just bare <div> and <p> tags with raw <a> links.
 */

import type { CuratedStory } from './content';

export interface WeeklyDigestData {
  date: string;
  perUserBody: string;          // AI-generated personalized paragraphs
  whatsNew: string;             // shared "what we shipped"
  stories: CuratedStory[];      // shared dev links
  linkedinDraft?: string | null;
}

export function buildWeeklyHtml(data: WeeklyDigestData): string {
  const body = data.perUserBody
    .split('\n\n')
    .filter((p) => p.trim())
    .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
    .join('\n');

  // Skip "what's new" when there's nothing real to report
  const hasRealNews = data.whatsNew && !data.whatsNew.toLowerCase().includes('quiet week');
  const whatsNew = hasRealNews
    ? `<p><font color="#8a847a" size="2">what's new —</font></p>\n<p>${escapeHtml(data.whatsNew)}</p>\n`
    : '';

  const stories = data.stories.length > 0
    ? `<p><font color="#8a847a" size="2">elsewhere —</font></p>\n` +
      data.stories.map((s) =>
        `<p><a href="${escapeHtml(s.url)}">${escapeHtml(s.title)}</a> <font color="#8a847a" size="1">${escapeHtml(s.source)}</font><br><font color="#5c564e" size="2">${escapeHtml(s.take)}</font></p>`
      ).join('\n')
    : '';

  const linkedin = data.linkedinDraft
    ? `<p><font color="#8a847a" size="2">linkedin draft (copy &amp; paste) —</font></p>\n<p>${escapeHtml(data.linkedinDraft).replace(/\n/g, '<br>')}</p>`
    : '';

  return `<div dir="ltr">
<p><font color="#8a847a" size="2">${escapeHtml(data.date)}</font></p>
${body}
${whatsNew}${stories}
${linkedin}
<p><font color="#b0aaa0" size="1">reply stop to unsubscribe</font></p>
</div>`;
}

export function buildWeeklyText(data: WeeklyDigestData): string {
  const header = `${data.date}\n---\n\n`;

  const body = data.perUserBody + '\n';

  const hasRealNewsText = data.whatsNew && !data.whatsNew.toLowerCase().includes('quiet week');
  const whatsNew = hasRealNewsText
    ? `\nwhat's new —\n${data.whatsNew}\n`
    : '';

  const stories = data.stories.length > 0
    ? '\n\nelsewhere —\n\n' + data.stories.map((s, i) => `${i + 1}. ${s.title} (${s.source})\n   ${s.take}\n   ${s.url}`).join('\n\n')
    : '';

  const linkedin = data.linkedinDraft
    ? `\n\n---\nlinkedin draft (copy & paste) —\n\n${data.linkedinDraft}`
    : '';

  const footer = `\n\n---\nreply stop to unsubscribe`;

  return header + body + whatsNew + stories + linkedin + footer;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
