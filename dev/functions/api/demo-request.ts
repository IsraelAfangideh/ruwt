/**
 * POST /api/demo-request
 * Public lead capture for hiring teams. Sends notification via Resend.
 */
import { z } from 'zod';
import { sendEmail } from '../_shared/newsletter/resend';

const demoSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  company: z.string().min(1).max(200),
  teamSize: z.string().max(100).optional(),
  message: z.string().max(2000).optional(),
});

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const parsed = demoSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, email, company, teamSize, message } = parsed.data;

    // Send internal notification
    const alertEmail = context.env.ERROR_ALERT_EMAIL;
    if (alertEmail) {
      await sendEmail(context.env, {
        to: alertEmail,
        subject: `Demo Request: ${company} (${name})`,
        html: [
          '<h2>New Demo Request</h2>',
          `<p><strong>Name:</strong> ${escapeHtml(name)}</p>`,
          `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
          `<p><strong>Company:</strong> ${escapeHtml(company)}</p>`,
          `<p><strong>Team Size:</strong> ${escapeHtml(teamSize || 'Not specified')}</p>`,
          `<p><strong>Message:</strong> ${escapeHtml(message || 'None')}</p>`,
        ].join('\n'),
      });
    }

    // Send confirmation to requester
    await sendEmail(context.env, {
      to: email,
      subject: 'We received your demo request — Ruwt',
      html: [
        `<p>Hi ${escapeHtml(name)},</p>`,
        '<p>Thanks for your interest in Ruwt! We\'ll be in touch within 24 hours to schedule a walkthrough.</p>',
        '<p>In the meantime, you can <a href="https://ruwt.dev/teams">explore our assessment packs</a> or create a free assessment right away.</p>',
        '<p>Best,<br>The Ruwt Team</p>',
      ].join('\n'),
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Demo request error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
