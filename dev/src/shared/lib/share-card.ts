import { arena } from '@/shared/theme/colors';
import { formatCostFromHundredths } from '@/shared/lib/ai/pricing';
import type { BadgeDef } from '@/shared/lib/badge-defs';

interface ShareCardData {
  title: string;
  difficulty: string;
  categoryDisplayName: string;
  totalCost: number;
  badges: BadgeDef[];
  rank: { position: number; total: number } | null;
}

/** Renders a 600x340 branded share card to canvas and triggers PNG download. */
export function downloadShareCard(data: ShareCardData): void {
  const { title, difficulty, categoryDisplayName, totalCost, badges, rank } = data;
  const W = 600, H = 340;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = arena.bg;
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, arena.accentBgFaint);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Gold accent line
  const lineGrad = ctx.createLinearGradient(W * 0.15, 0, W * 0.85, 0);
  lineGrad.addColorStop(0, 'transparent');
  lineGrad.addColorStop(0.5, arena.accent);
  lineGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(W * 0.15, 0, W * 0.7, 2);

  ctx.textAlign = 'center';
  ctx.fillStyle = arena.accent;
  ctx.font = '600 11px sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('CHALLENGE PASSED', W / 2, 36);

  ctx.fillStyle = arena.text;
  ctx.font = '700 22px Georgia, serif';
  ctx.letterSpacing = '0px';
  const titleText = title.length > 35 ? title.slice(0, 33) + '...' : title;
  ctx.fillText(titleText, W / 2, 68);

  ctx.fillStyle = arena.textMuted;
  ctx.font = '500 12px sans-serif';
  ctx.fillText(`${(difficulty || '').toLowerCase()} \u2022 ${categoryDisplayName}`, W / 2, 90);

  if (badges.length > 0) {
    const badgeY = 118;
    ctx.font = '20px serif';
    const badgeW = 50;
    const startX = W / 2 - (badges.length * badgeW) / 2;
    badges.forEach((badge, idx) => {
      ctx.fillText(badge.icon, startX + idx * badgeW + badgeW / 2, badgeY);
    });
    ctx.fillStyle = arena.accent;
    ctx.font = '600 10px sans-serif';
    badges.forEach((badge, idx) => {
      ctx.fillText(badge.title, startX + idx * badgeW + badgeW / 2, badgeY + 18);
    });
  }

  // Stats boxes
  const statsY = badges.length > 0 ? 160 : 120;
  const cost = formatCostFromHundredths(totalCost);
  const rankStr = rank ? `#${rank.position} / ${rank.total}` : null;

  const drawStatBox = (x: number, w: number, label: string, value: string, highlight: boolean) => {
    ctx.fillStyle = highlight ? arena.accentBg : arena.borderFaint;
    ctx.beginPath();
    ctx.roundRect(x, statsY, w, 64, 8);
    ctx.fill();
    ctx.strokeStyle = highlight ? arena.accentBorder : arena.borderSubtle;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = arena.textMuted;
    ctx.font = '600 10px sans-serif';
    ctx.fillText(label.toUpperCase(), x + w / 2, statsY + 24);
    ctx.fillStyle = highlight ? arena.accent : arena.text;
    ctx.font = '700 20px monospace';
    ctx.fillText(value, x + w / 2, statsY + 50);
  };

  if (rankStr) {
    drawStatBox(60, 220, 'Your Cost', cost, true);
    drawStatBox(320, 220, 'Your Rank', rankStr, false);
  } else {
    drawStatBox(150, 300, 'Your Cost', cost, true);
  }

  // Branding
  const brandY = H - 30;
  ctx.textAlign = 'center';
  ctx.fillStyle = arena.accent;
  ctx.font = '700 14px Georgia, serif';
  ctx.fillText('ruwt.dev', W / 2, brandY);
  ctx.fillStyle = arena.textMuted;
  ctx.font = '400 10px sans-serif';
  ctx.fillText('AI Efficiency Arena', W / 2, brandY + 16);

  // Border
  ctx.strokeStyle = arena.accentBorderSubtle;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, W - 1, H - 1, 12);
  ctx.stroke();

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ruwt-${title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
