/**
 * Resend email client — raw fetch, no SDK.
 */

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(
  env: { RESEND_API_KEY?: string },
  params: SendEmailParams
): Promise<SendEmailResult> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from ?? 'Israel Afangideh <israel@ruwt.dev>',
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      headers: {
        'X-Entity-Ref-ID': crypto.randomUUID(),
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { success: false, error: `Resend API ${res.status}: ${body}` };
  }

  const data = await res.json() as { id: string };
  return { success: true, id: data.id };
}
