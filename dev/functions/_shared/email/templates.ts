/**
 * HTML email templates for the ruwt.dev hiring platform.
 *
 * Brand: warm cream (#f5f3f0), dark text (#1a1816), gold accent (#c9a962).
 * All emails use inline CSS for maximum email-client compatibility.
 * CTA buttons use the bulletproof table-based technique for Outlook.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format an ISO date string into a human-readable form (e.g. "Feb 21, 2026"). */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    /* istanbul ignore next -- @preserve */
    return iso;
  }
}

/** Format minutes into a readable duration (e.g. "90 minutes", "2 hours"). */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${hours}h ${rem}m`;
}

/**
 * Bulletproof CTA button that renders in Outlook and every major email client.
 * Uses the VML/table hybrid technique.
 */
function ctaButton(text: string, href: string): string {
  return `<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(href)}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="17%" strokecolor="#c9a962" fillcolor="#c9a962">
  <w:anchorlock/>
  <center style="color:#1a1816;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">${escapeHtml(text)}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
  <tr>
    <td style="border-radius: 8px; background-color: #c9a962; text-align: center;">
      <a href="${escapeHtml(href)}" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: bold; color: #1a1816; text-decoration: none; border-radius: 8px; background-color: #c9a962;">
        ${escapeHtml(text)}
      </a>
    </td>
  </tr>
</table>
<!--<![endif]-->`;
}

/**
 * Wrap email content in the shared branded layout.
 * Provides: doctype, body background, centered container, Ruwt logo header, footer.
 */
function wrapInLayout(content: string, preheader?: string): string {
  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;color:#f5f3f0;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>ruwt.dev</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #1a1816; background-color: #f5f3f0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
${preheaderHtml}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f3f0;">
  <tr>
    <td align="center" style="padding: 32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width: 560px; width: 100%;">
        <!-- Logo -->
        <tr>
          <td align="center" style="padding-bottom: 32px;">
            <a href="https://ruwt.dev" target="_blank" style="text-decoration: none;">
              <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: bold; color: #1a1816; letter-spacing: -0.5px;">ruwt</span><span style="font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: bold; color: #c9a962; letter-spacing: -0.5px;">.dev</span>
            </a>
          </td>
        </tr>
        <!-- Content card -->
        <tr>
          <td style="background-color: #ffffff; border-radius: 12px; padding: 40px 36px;">
${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding: 28px 0 0 0; text-align: center;">
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #8a847a; line-height: 1.5;">
              Sent by <a href="https://ruwt.dev" style="color: #8a847a; text-decoration: underline;">ruwt.dev</a> &mdash; AI-efficiency assessment platform
            </p>
            <p style="margin: 0; font-size: 12px; color: #b0aaa0; line-height: 1.5;">
              <a href="https://ruwt.dev/settings" style="color: #b0aaa0; text-decoration: underline;">Unsubscribe</a> &middot; <a href="https://ruwt.dev/privacy" style="color: #b0aaa0; text-decoration: underline;">Privacy</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Shared return type
// ---------------------------------------------------------------------------

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// ---------------------------------------------------------------------------
// 1. Welcome Email (new signup)
// ---------------------------------------------------------------------------

export interface WelcomeParams {
  name?: string | null;
}

export function welcomeEmail(params: WelcomeParams): EmailTemplate {
  const greeting = params.name ? `Hi ${escapeHtml(params.name)},` : 'Hi there,';
  const subject = 'Welcome to ruwt.dev';

  const content = `
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #1a1816;">${greeting}</p>
            <p style="margin: 0 0 20px 0; color: #1a1816; line-height: 1.6;">Welcome to <strong>ruwt.dev</strong> &mdash; the platform where you practice AI-assisted coding and compete on efficiency.</p>
            <p style="margin: 0 0 20px 0; color: #1a1816; line-height: 1.6;">All practice challenges are <strong>100% free</strong>, including AI chat. Here&rsquo;s what you can do right now:</p>
            <!-- What's waiting -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 28px 0; background-color: #f5f3f0; border-radius: 8px;">
              <tr>
                <td style="padding: 20px 24px;">
                  <p style="margin: 0 0 12px 0; font-size: 14px; color: #1a1816;"><strong>100+ challenges</strong> across model selection, prompt efficiency, and debugging</p>
                  <p style="margin: 0 0 12px 0; font-size: 14px; color: #1a1816;"><strong>17 AI models</strong> across 5 cost tiers &mdash; choose wisely</p>
                  <p style="margin: 0; font-size: 14px; color: #1a1816;"><strong>Daily challenges</strong> &mdash; build a streak, climb the leaderboard</p>
                </td>
              </tr>
            </table>
            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  ${ctaButton('Start Your First Challenge', 'https://ruwt.dev/challenges')}
                </td>
              </tr>
            </table>
            <p style="margin: 0; font-size: 13px; color: #8a847a; text-align: center; line-height: 1.5;">We recommend starting with <strong>FizzBuzz Budget</strong> &mdash; it takes about 2 minutes and teaches you the core loop.</p>`;

  const html = wrapInLayout(content, 'Welcome to ruwt.dev — start your first AI coding challenge');

  const text = [
    greeting,
    '',
    'Welcome to ruwt.dev — the platform where you practice AI-assisted coding and compete on efficiency.',
    '',
    'All practice challenges are 100% free, including AI chat.',
    '',
    '- 100+ challenges across model selection, prompt efficiency, and debugging',
    '- 17 AI models across 5 cost tiers',
    '- Daily challenges — build a streak, climb the leaderboard',
    '',
    'Start your first challenge: https://ruwt.dev/challenges',
    '',
    'We recommend starting with FizzBuzz Budget — it takes about 2 minutes.',
    '',
    '---',
    'Sent by ruwt.dev -- AI-efficiency assessment platform',
    'Unsubscribe: https://ruwt.dev/settings',
  ].join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 2. Candidate Invite
// ---------------------------------------------------------------------------

export interface CandidateInviteParams {
  candidateName?: string;
  companyName?: string;
  companyLogoUrl?: string;
  assessmentTitle: string;
  assessmentDescription?: string;
  challengeCount: number;
  timeLimit: number; // minutes
  inviteUrl: string;
  expiresAt: string; // ISO date
}

export function candidateInviteEmail(params: CandidateInviteParams): EmailTemplate {
  const {
    candidateName,
    companyName,
    companyLogoUrl,
    assessmentTitle,
    assessmentDescription,
    challengeCount,
    timeLimit,
    inviteUrl,
    expiresAt,
  } = params;

  const greeting = candidateName
    ? `Hi ${escapeHtml(candidateName)},`
    : 'Hi there,';

  const subject = companyName
    ? `${companyName} has invited you to an AI assessment`
    : "You've been invited to an AI assessment";

  const companyLogoHtml = companyLogoUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  <img src="${escapeHtml(companyLogoUrl)}" alt="${escapeHtml(companyName || 'Company')}" width="120" style="max-width: 120px; height: auto; display: block;" />
                </td>
              </tr>
            </table>`
    : '';

  const inviterLine = companyName
    ? `<strong>${escapeHtml(companyName)}</strong> has invited you to complete an AI-efficiency assessment on ruwt.dev.`
    : 'You\'ve been invited to complete an AI-efficiency assessment on ruwt.dev.';

  const descriptionHtml = assessmentDescription
    ? `<p style="margin: 0 0 20px 0; color: #5c564e; font-size: 14px; line-height: 1.6;">${escapeHtml(assessmentDescription)}</p>`
    : '';

  const formattedExpiry = formatDate(expiresAt);
  const duration = formatDuration(timeLimit);

  const content = `
            ${companyLogoHtml}
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #1a1816;">${greeting}</p>
            <p style="margin: 0 0 20px 0; color: #1a1816; line-height: 1.6;">${inviterLine}</p>
            ${descriptionHtml}
            <!-- Assessment details -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 28px 0; background-color: #f5f3f0; border-radius: 8px;">
              <tr>
                <td style="padding: 20px 24px;">
                  <p style="margin: 0 0 12px 0; font-size: 17px; font-weight: bold; color: #1a1816;">${escapeHtml(assessmentTitle)}</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding-right: 24px;">
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Challenges</p>
                        <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: bold; color: #1a1816;">${challengeCount}</p>
                      </td>
                      <td>
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Time Limit</p>
                        <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: bold; color: #1a1816;">${escapeHtml(duration)}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  ${ctaButton('Start Assessment', inviteUrl)}
                </td>
              </tr>
            </table>
            <p style="margin: 0 0 12px 0; font-size: 13px; color: #8a847a; text-align: center; line-height: 1.5;">This invitation expires on <strong>${escapeHtml(formattedExpiry)}</strong>.</p>
            <p style="margin: 0; font-size: 13px; color: #b0aaa0; text-align: center; line-height: 1.5;">If the button doesn't work, copy and paste this link:<br><a href="${escapeHtml(inviteUrl)}" style="color: #8a847a; word-break: break-all;">${escapeHtml(inviteUrl)}</a></p>`;

  const html = wrapInLayout(
    content,
    companyName
      ? `${companyName} invited you to an AI assessment on ruwt.dev`
      : 'You have been invited to an AI assessment on ruwt.dev',
  );

  const text = [
    greeting,
    '',
    companyName
      ? `${companyName} has invited you to complete an AI-efficiency assessment on ruwt.dev.`
      : "You've been invited to complete an AI-efficiency assessment on ruwt.dev.",
    '',
    ...(assessmentDescription ? [assessmentDescription, ''] : []),
    `Assessment: ${assessmentTitle}`,
    `Challenges: ${challengeCount}`,
    `Time limit: ${duration}`,
    '',
    `Start your assessment: ${inviteUrl}`,
    '',
    `This invitation expires on ${formattedExpiry}.`,
    '',
    '---',
    'Sent by ruwt.dev -- AI-efficiency assessment platform',
    'Unsubscribe: https://ruwt.dev/settings',
  ].join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 2. Reminder
// ---------------------------------------------------------------------------

export interface ReminderParams {
  candidateName?: string;
  companyName?: string;
  assessmentTitle: string;
  inviteUrl: string;
  daysRemaining: number;
}

export function reminderEmail(params: ReminderParams): EmailTemplate {
  const { candidateName, companyName, assessmentTitle, inviteUrl, daysRemaining } = params;

  const greeting = candidateName
    ? `Hi ${escapeHtml(candidateName)},`
    : 'Hi there,';

  const subject = `Reminder: Complete your AI assessment \u2014 ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`;

  const fromLine = companyName
    ? ` from <strong>${escapeHtml(companyName)}</strong>`
    : '';

  const urgencyNote = daysRemaining <= 1
    ? '<strong>This is your last day to complete it.</strong>'
    : `You have <strong>${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong> remaining.`;

  const content = `
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #1a1816;">${greeting}</p>
            <p style="margin: 0 0 16px 0; color: #1a1816; line-height: 1.6;">Just a friendly reminder that you have a pending AI assessment${fromLine} on ruwt.dev.</p>
            <!-- Assessment name -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 20px 0; background-color: #f5f3f0; border-radius: 8px;">
              <tr>
                <td style="padding: 16px 24px;">
                  <p style="margin: 0; font-size: 15px; font-weight: bold; color: #1a1816;">${escapeHtml(assessmentTitle)}</p>
                </td>
              </tr>
            </table>
            <p style="margin: 0 0 24px 0; color: #1a1816; line-height: 1.6;">${urgencyNote} Pick it up whenever you're ready.</p>
            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  ${ctaButton('Continue Assessment', inviteUrl)}
                </td>
              </tr>
            </table>
            <p style="margin: 0; font-size: 13px; color: #b0aaa0; text-align: center; line-height: 1.5;">If the button doesn't work, copy and paste this link:<br><a href="${escapeHtml(inviteUrl)}" style="color: #8a847a; word-break: break-all;">${escapeHtml(inviteUrl)}</a></p>`;

  const html = wrapInLayout(
    content,
    `Reminder: ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left to complete your assessment`,
  );

  const text = [
    greeting,
    '',
    `Just a friendly reminder that you have a pending AI assessment${companyName ? ` from ${companyName}` : ''} on ruwt.dev.`,
    '',
    `Assessment: ${assessmentTitle}`,
    '',
    daysRemaining <= 1
      ? 'This is your last day to complete it.'
      : `You have ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining.`,
    'Pick it up whenever you are ready.',
    '',
    `Continue your assessment: ${inviteUrl}`,
    '',
    '---',
    'Sent by ruwt.dev -- AI-efficiency assessment platform',
    'Unsubscribe: https://ruwt.dev/settings',
  ].join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 3. Results Ready (sent to hiring manager)
// ---------------------------------------------------------------------------

export interface ResultsReadyParams {
  hiringManagerName?: string;
  candidateName: string;
  candidateEmail: string;
  assessmentTitle: string;
  challengesPassed: number;
  totalChallenges: number;
  resultsUrl: string;
}

export function resultsReadyEmail(params: ResultsReadyParams): EmailTemplate {
  const {
    hiringManagerName,
    candidateName,
    candidateEmail,
    assessmentTitle,
    challengesPassed,
    totalChallenges,
    resultsUrl,
  } = params;

  const greeting = hiringManagerName
    ? `Hi ${escapeHtml(hiringManagerName)},`
    : 'Hi there,';

  const subject = `Assessment completed: ${candidateName} \u2014 ${assessmentTitle}`;

  const passRate = totalChallenges > 0
    ? Math.round((challengesPassed / totalChallenges) * 100)
    : 0;

  // Color the score: green >= 70%, gold >= 40%, red below
  const scoreColor = passRate >= 70 ? '#5a8a5a' : passRate >= 40 ? '#c9a962' : '#b06060';

  const content = `
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #1a1816;">${greeting}</p>
            <p style="margin: 0 0 24px 0; color: #1a1816; line-height: 1.6;"><strong>${escapeHtml(candidateName)}</strong> (${escapeHtml(candidateEmail)}) has completed the assessment <strong>${escapeHtml(assessmentTitle)}</strong>.</p>
            <!-- Results summary -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 28px 0; background-color: #f5f3f0; border-radius: 8px;">
              <tr>
                <td style="padding: 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding-bottom: 16px;">
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Challenges Passed</p>
                        <p style="margin: 8px 0 0 0; font-size: 32px; font-weight: bold; color: ${scoreColor};">${challengesPassed} / ${totalChallenges}</p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center">
                        <!-- Progress bar -->
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="80%" style="margin: 0 auto;">
                          <tr>
                            <td style="background-color: #e0dcd7; border-radius: 4px; height: 8px; padding: 0;">
                              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${passRate}%" style="min-width: ${passRate > 0 ? '8px' : '0'};">
                                <tr>
                                  <td style="background-color: ${scoreColor}; border-radius: 4px; height: 8px; font-size: 1px; line-height: 1px;">&nbsp;</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  ${ctaButton('View Full Results', resultsUrl)}
                </td>
              </tr>
            </table>
            <p style="margin: 0; font-size: 13px; color: #b0aaa0; text-align: center; line-height: 1.5;">If the button doesn't work, copy and paste this link:<br><a href="${escapeHtml(resultsUrl)}" style="color: #8a847a; word-break: break-all;">${escapeHtml(resultsUrl)}</a></p>`;

  const html = wrapInLayout(
    content,
    `${candidateName} completed ${assessmentTitle}: ${challengesPassed}/${totalChallenges} passed`,
  );

  const text = [
    greeting,
    '',
    `${candidateName} (${candidateEmail}) has completed the assessment "${assessmentTitle}".`,
    '',
    `Result: ${challengesPassed} / ${totalChallenges} challenges passed (${passRate}%)`,
    '',
    `View full results: ${resultsUrl}`,
    '',
    '---',
    'Sent by ruwt.dev -- AI-efficiency assessment platform',
    'Unsubscribe: https://ruwt.dev/settings',
  ].join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 4. New Signup Notification (sent to admin)
// ---------------------------------------------------------------------------

export interface NewSignupNotificationParams {
  userName?: string | null;
  userEmail: string;
  provider: string; // 'github' | 'email' | etc.
}

export function newSignupNotificationEmail(params: NewSignupNotificationParams): EmailTemplate {
  const { userName, userEmail, provider } = params;

  const displayName = userName ? escapeHtml(userName) : 'Someone new';
  const displayProvider = provider === 'github' ? 'GitHub OAuth' : provider === 'email' ? 'Email signup' : escapeHtml(provider);
  const subject = `New signup: ${userName || userEmail} just joined ruwt.dev`;

  const content = `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 24px 0;">
              <tr>
                <td align="center" style="padding: 20px 0 8px 0;">
                  <p style="margin: 0; font-size: 48px; line-height: 1;">&#127881;</p>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <p style="margin: 0; font-size: 22px; font-weight: bold; color: #1a1816;">New user just signed up!</p>
                </td>
              </tr>
            </table>
            <!-- User details -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 28px 0; background-color: #f5f3f0; border-radius: 8px;">
              <tr>
                <td style="padding: 20px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="padding-bottom: 12px;">
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Name</p>
                        <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: bold; color: #1a1816;">${displayName}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom: 12px;">
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Email</p>
                        <p style="margin: 4px 0 0 0; font-size: 16px; color: #1a1816;">${escapeHtml(userEmail)}</p>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Signed Up Via</p>
                        <p style="margin: 4px 0 0 0; font-size: 16px; color: #1a1816;">${displayProvider}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <!-- Action checklist -->
            <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: bold; color: #1a1816;">Your move:</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 28px 0;">
              <tr>
                <td style="padding: 8px 0; font-size: 15px; color: #1a1816; line-height: 1.5;">&#9744; Send them a personal welcome (reply to this email for their address)</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 15px; color: #1a1816; line-height: 1.5;">&#9744; Add them to the CRM</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 15px; color: #1a1816; line-height: 1.5;">&#9744; Check if they complete onboarding today</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 15px; color: #1a1816; line-height: 1.5;">&#9744; See which challenge they try first</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 15px; color: #1a1816; line-height: 1.5;">&#9744; If they came from GitHub, check out their profile</td>
              </tr>
            </table>
            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom: 16px;">
                  ${ctaButton('View Leaderboard', 'https://ruwt.dev/leaderboard')}
                </td>
              </tr>
            </table>
            <p style="margin: 0; font-size: 13px; color: #8a847a; text-align: center; line-height: 1.5;">Every signup is a step closer. Keep building.</p>`;

  const html = wrapInLayout(content, `New signup: ${userName || userEmail} just joined ruwt.dev`);

  const text = [
    'New user just signed up!',
    '',
    `Name: ${userName || 'Not provided'}`,
    `Email: ${userEmail}`,
    `Signed up via: ${displayProvider}`,
    '',
    'Your move:',
    '[ ] Send them a personal welcome',
    '[ ] Add them to the CRM',
    '[ ] Check if they complete onboarding today',
    '[ ] See which challenge they try first',
    '[ ] If they came from GitHub, check out their profile',
    '',
    'View leaderboard: https://ruwt.dev/leaderboard',
    '',
    'Every signup is a step closer. Keep building.',
    '',
    '---',
    'Sent by ruwt.dev -- AI-efficiency assessment platform',
  ].join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 5. Challenge Attempt Notification (sent to admin)
// ---------------------------------------------------------------------------

export interface ChallengeAttemptNotificationParams {
  userName?: string | null;
  userEmail: string;
  challengeTitle: string;
  challengeDifficulty: string; // 'easy' | 'medium' | 'hard'
  passed: boolean;
  passedTests: number;
  totalTests: number;
  totalCost: number; // credits spent on AI
}

export function challengeAttemptNotificationEmail(params: ChallengeAttemptNotificationParams): EmailTemplate {
  const {
    userName,
    userEmail,
    challengeTitle,
    challengeDifficulty,
    passed,
    passedTests,
    totalTests,
    totalCost,
  } = params;

  const displayName = userName ? escapeHtml(userName) : escapeHtml(userEmail);
  const resultEmoji = passed ? '&#9989;' : '&#10060;';
  const resultLabel = passed ? 'PASSED' : 'FAILED';
  const resultColor = passed ? '#5a8a5a' : '#b06060';
  const difficultyColor = challengeDifficulty === 'easy' ? '#5a8a5a' : challengeDifficulty === 'medium' ? '#c9a962' : '#b06060';

  const costDisplay = totalCost === 0 ? 'Free (no AI used)' : `${totalCost.toLocaleString()} credits`;

  const subject = passed
    ? `${userName || userEmail} solved ${challengeTitle}!`
    : `${userName || userEmail} attempted ${challengeTitle}`;

  const content = `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 20px 0;">
              <tr>
                <td align="center" style="padding: 16px 0 8px 0;">
                  <p style="margin: 0; font-size: 40px; line-height: 1;">${resultEmoji}</p>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <p style="margin: 0 0 4px 0; font-size: 20px; font-weight: bold; color: ${resultColor};">${resultLabel}</p>
                  <p style="margin: 0; font-size: 14px; color: #8a847a;">${displayName} &mdash; ${escapeHtml(challengeTitle)}</p>
                </td>
              </tr>
            </table>
            <!-- Attempt details -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 24px 0; background-color: #f5f3f0; border-radius: 8px;">
              <tr>
                <td style="padding: 20px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="padding-bottom: 14px; width: 50%;">
                        <p style="margin: 0; font-size: 12px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Challenge</p>
                        <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: bold; color: #1a1816;">${escapeHtml(challengeTitle)}</p>
                      </td>
                      <td style="padding-bottom: 14px; width: 50%;">
                        <p style="margin: 0; font-size: 12px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Difficulty</p>
                        <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: bold; color: ${difficultyColor};">${escapeHtml(challengeDifficulty.charAt(0).toUpperCase() + challengeDifficulty.slice(1))}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom: 14px; width: 50%;">
                        <p style="margin: 0; font-size: 12px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Tests</p>
                        <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: bold; color: ${resultColor};">${passedTests} / ${totalTests}</p>
                      </td>
                      <td style="padding-bottom: 14px; width: 50%;">
                        <p style="margin: 0; font-size: 12px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">AI Cost</p>
                        <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: bold; color: #1a1816;">${escapeHtml(costDisplay)}</p>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2">
                        <p style="margin: 0; font-size: 12px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">User</p>
                        <p style="margin: 4px 0 0 0; font-size: 15px; color: #1a1816;">${displayName} (${escapeHtml(userEmail)})</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>${passed ? `
            <!-- Dopamine hit for solves -->
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #1a1816; text-align: center; line-height: 1.6;">Another one in the bag. The leaderboard just moved.</p>` : `
            <!-- Encouragement for fails -->
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #1a1816; text-align: center; line-height: 1.6;">They&rsquo;re grinding. A retry is likely incoming.</p>`}
            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom: 16px;">
                  ${ctaButton('View Activity Feed', 'https://ruwt.dev/activity')}
                </td>
              </tr>
            </table>`;

  const html = wrapInLayout(
    content,
    passed
      ? `${userName || userEmail} solved ${challengeTitle} on ruwt.dev`
      : `${userName || userEmail} attempted ${challengeTitle} on ruwt.dev`,
  );

  const text = [
    `${resultLabel}: ${userName || userEmail} — ${challengeTitle}`,
    '',
    `Challenge: ${challengeTitle}`,
    `Difficulty: ${challengeDifficulty.charAt(0).toUpperCase() + challengeDifficulty.slice(1)}`,
    `Tests: ${passedTests} / ${totalTests}`,
    `AI Cost: ${costDisplay}`,
    `User: ${userName || 'N/A'} (${userEmail})`,
    '',
    passed
      ? 'Another one in the bag. The leaderboard just moved.'
      : "They're grinding. A retry is likely incoming.",
    '',
    'View activity feed: https://ruwt.dev/activity',
    '',
    '---',
    'Sent by ruwt.dev -- AI-efficiency assessment platform',
  ].join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 6. Team Invite
// ---------------------------------------------------------------------------

export interface TeamInviteParams {
  inviterName: string;
  orgName: string;
  role: string;
  joinUrl: string;
  expiresAt: string; // ISO date
}

export function teamInviteEmail(params: TeamInviteParams): EmailTemplate {
  const { inviterName, orgName, role, joinUrl, expiresAt } = params;

  const subject = `Join ${orgName} on Ruwt`;
  const formattedExpiry = formatDate(expiresAt);
  const displayRole = role.charAt(0).toUpperCase() + role.slice(1);

  const content = `
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #1a1816;">Hi,</p>
            <p style="margin: 0 0 20px 0; color: #1a1816; line-height: 1.6;"><strong>${escapeHtml(inviterName)}</strong> has invited you to join <strong>${escapeHtml(orgName)}</strong> on ruwt.dev.</p>
            <!-- Role details -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 28px 0; background-color: #f5f3f0; border-radius: 8px;">
              <tr>
                <td style="padding: 20px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding-right: 32px;">
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Organization</p>
                        <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: bold; color: #1a1816;">${escapeHtml(orgName)}</p>
                      </td>
                      <td>
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Your Role</p>
                        <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: bold; color: #1a1816;">${escapeHtml(displayRole)}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin: 0 0 24px 0; color: #5c564e; font-size: 14px; line-height: 1.6;">As a team member, you'll be able to collaborate on assessments, review candidate results, and manage your organization's hiring pipeline.</p>
            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  ${ctaButton('Accept Invitation', joinUrl)}
                </td>
              </tr>
            </table>
            <p style="margin: 0 0 12px 0; font-size: 13px; color: #8a847a; text-align: center; line-height: 1.5;">This invitation expires on <strong>${escapeHtml(formattedExpiry)}</strong>.</p>
            <p style="margin: 0; font-size: 13px; color: #b0aaa0; text-align: center; line-height: 1.5;">If the button doesn't work, copy and paste this link:<br><a href="${escapeHtml(joinUrl)}" style="color: #8a847a; word-break: break-all;">${escapeHtml(joinUrl)}</a></p>`;

  const html = wrapInLayout(
    content,
    `${inviterName} invited you to join ${orgName} on ruwt.dev`,
  );

  const text = [
    'Hi,',
    '',
    `${inviterName} has invited you to join ${orgName} on ruwt.dev.`,
    '',
    `Organization: ${orgName}`,
    `Your role: ${displayRole}`,
    '',
    "As a team member, you will be able to collaborate on assessments, review candidate results, and manage your organization's hiring pipeline.",
    '',
    `Accept invitation: ${joinUrl}`,
    '',
    `This invitation expires on ${formattedExpiry}.`,
    '',
    '---',
    'Sent by ruwt.dev -- AI-efficiency assessment platform',
    'Unsubscribe: https://ruwt.dev/settings',
  ].join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 7. Trial Start Notification (sent to admin)
// ---------------------------------------------------------------------------

export interface TrialStartNotificationParams {
  userName?: string | null;
  userEmail: string;
  orgName: string;
  provider: string;
  trialEndsAt: string; // ISO date
}

export function trialStartNotificationEmail(params: TrialStartNotificationParams): EmailTemplate {
  const { userName, userEmail, orgName, provider, trialEndsAt } = params;

  const displayName = userName ? escapeHtml(userName) : 'Someone new';
  const displayProvider = provider === 'github' ? 'GitHub OAuth' : provider === 'email' ? 'Email signup' : escapeHtml(provider);
  const formattedExpiry = formatDate(trialEndsAt);
  const subject = `New teams trial: ${userName || userEmail} started a trial`;

  const content = `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 24px 0;">
              <tr>
                <td align="center" style="padding: 20px 0 8px 0;">
                  <p style="margin: 0; font-size: 48px; line-height: 1;">&#128640;</p>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <p style="margin: 0; font-size: 22px; font-weight: bold; color: #1a1816;">New teams trial started!</p>
                </td>
              </tr>
            </table>
            <!-- Trial badge -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 24px 0;">
              <tr>
                <td align="center">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color: #c9a962; border-radius: 16px; padding: 6px 16px;">
                        <p style="margin: 0; font-size: 13px; font-weight: bold; color: #1a1816; text-transform: uppercase; letter-spacing: 0.5px;">30-Day Trial</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <!-- User details -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 28px 0; background-color: #f5f3f0; border-radius: 8px;">
              <tr>
                <td style="padding: 20px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="padding-bottom: 12px;">
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Name</p>
                        <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: bold; color: #1a1816;">${displayName}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom: 12px;">
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Email</p>
                        <p style="margin: 4px 0 0 0; font-size: 16px; color: #1a1816;">${escapeHtml(userEmail)}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom: 12px;">
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Organization</p>
                        <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: bold; color: #1a1816;">${escapeHtml(orgName)}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom: 12px;">
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Signed Up Via</p>
                        <p style="margin: 4px 0 0 0; font-size: 16px; color: #1a1816;">${displayProvider}</p>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Trial Expires</p>
                        <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: bold; color: #c9a962;">${escapeHtml(formattedExpiry)}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <!-- Action checklist -->
            <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: bold; color: #1a1816;">Your move:</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 28px 0;">
              <tr>
                <td style="padding: 8px 0; font-size: 15px; color: #1a1816; line-height: 1.5;">&#9744; Send personal welcome</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 15px; color: #1a1816; line-height: 1.5;">&#9744; Check if they create an assessment today</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 15px; color: #1a1816; line-height: 1.5;">&#9744; Add to CRM</td>
              </tr>
            </table>
            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom: 16px;">
                  ${ctaButton('View Dashboard', 'https://ruwt.dev/admin')}
                </td>
              </tr>
            </table>
            <p style="margin: 0; font-size: 13px; color: #8a847a; text-align: center; line-height: 1.5;">Another org in the pipeline. Keep building.</p>`;

  const html = wrapInLayout(content, `New teams trial: ${userName || userEmail} \u2014 ${orgName}`);

  const text = [
    'New teams trial started!',
    '',
    `Name: ${userName || 'Not provided'}`,
    `Email: ${userEmail}`,
    `Organization: ${orgName}`,
    `Signed up via: ${displayProvider}`,
    `Trial expires: ${formattedExpiry}`,
    '',
    'Your move:',
    '[ ] Send personal welcome',
    '[ ] Check if they create an assessment today',
    '[ ] Add to CRM',
    '',
    'View dashboard: https://ruwt.dev/admin',
    '',
    'Another org in the pipeline. Keep building.',
    '',
    '---',
    'Sent by ruwt.dev -- AI-efficiency assessment platform',
  ].join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 8. Trial Welcome (sent to the new trial user)
// ---------------------------------------------------------------------------

export interface TrialWelcomeParams {
  name?: string | null;
  trialEndsAt: string; // ISO date
  assessmentLimit: number;
  inviteLimit: number;
}

export function trialWelcomeEmail(params: TrialWelcomeParams): EmailTemplate {
  const { name, trialEndsAt, assessmentLimit, inviteLimit } = params;

  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  const formattedExpiry = formatDate(trialEndsAt);
  const subject = 'Your 30-day trial is active';

  const content = `
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #1a1816;">${greeting}</p>
            <p style="margin: 0 0 20px 0; color: #1a1816; line-height: 1.6;">Your organization is set up with a 30-day free trial.</p>
            <!-- What's included -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 28px 0; background-color: #f5f3f0; border-radius: 8px;">
              <tr>
                <td style="padding: 20px 24px;">
                  <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: bold; color: #1a1816;">What&rsquo;s included</p>
                  <p style="margin: 0 0 10px 0; font-size: 14px; color: #1a1816; line-height: 1.5;"><strong>${assessmentLimit} assessment${assessmentLimit === 1 ? '' : 's'}</strong></p>
                  <p style="margin: 0 0 10px 0; font-size: 14px; color: #1a1816; line-height: 1.5;"><strong>${inviteLimit} candidate invite${inviteLimit === 1 ? '' : 's'}</strong></p>
                  <p style="margin: 0 0 10px 0; font-size: 14px; color: #1a1816; line-height: 1.5;"><strong>Full session replays</strong></p>
                  <p style="margin: 0; font-size: 14px; color: #1a1816; line-height: 1.5;"><strong>AI profile insights</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 0 0 24px 0; color: #1a1816; line-height: 1.6;"><strong>Next step:</strong> Create your first assessment &mdash; it takes about 5 minutes.</p>
            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  ${ctaButton('Create Assessment', 'https://ruwt.dev/assessment/new')}
                </td>
              </tr>
            </table>
            <p style="margin: 0; font-size: 13px; color: #8a847a; text-align: center; line-height: 1.5;">Trial expires <strong>${escapeHtml(formattedExpiry)}</strong>. Questions? Reply to this email.</p>`;

  const html = wrapInLayout(content, 'Your 30-day trial is active \u2014 create your first assessment');

  const text = [
    greeting,
    '',
    'Your organization is set up with a 30-day free trial.',
    '',
    "What's included:",
    `- ${assessmentLimit} assessment${assessmentLimit === 1 ? '' : 's'}`,
    `- ${inviteLimit} candidate invite${inviteLimit === 1 ? '' : 's'}`,
    '- Full session replays',
    '- AI profile insights',
    '',
    'Next step: Create your first assessment — it takes about 5 minutes.',
    '',
    'Create assessment: https://ruwt.dev/assessment/new',
    '',
    `Trial expires ${formattedExpiry}. Questions? Reply to this email.`,
    '',
    '---',
    'Sent by ruwt.dev -- AI-efficiency assessment platform',
    'Unsubscribe: https://ruwt.dev/settings',
  ].join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 9. Trial Expiring (sent to user 7 days before expiry)
// ---------------------------------------------------------------------------

export interface TrialExpiringParams {
  name?: string | null;
  orgName: string;
  daysRemaining: number;
  assessmentsUsed: number;
  assessmentLimit: number;
  invitesUsed: number;
  inviteLimit: number;
  trialEndsAt: string;
}

export function trialExpiringEmail(params: TrialExpiringParams): EmailTemplate {
  const {
    name,
    orgName,
    daysRemaining,
    assessmentsUsed,
    assessmentLimit,
    invitesUsed,
    inviteLimit,
    trialEndsAt,
  } = params;

  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  const formattedExpiry = formatDate(trialEndsAt);
  const subject = `Your trial expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
  const noAssessments = assessmentsUsed === 0;
  const ctaText = noAssessments ? 'Create Assessment' : 'Subscribe';
  const ctaUrl = noAssessments ? 'https://ruwt.dev/assessment/new' : 'https://ruwt.dev/teams';

  const content = `
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #1a1816;">${greeting}</p>
            <p style="margin: 0 0 20px 0; color: #1a1816; line-height: 1.6;">Your trial for <strong>${escapeHtml(orgName)}</strong> expires in <strong>${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong> (${escapeHtml(formattedExpiry)}).</p>
            <!-- Usage summary -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 28px 0; background-color: #f5f3f0; border-radius: 8px;">
              <tr>
                <td style="padding: 20px 24px;">
                  <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: bold; color: #1a1816;">Your usage so far</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="padding-bottom: 12px; width: 50%;">
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Assessments</p>
                        <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: bold; color: #1a1816;">${assessmentsUsed} / ${assessmentLimit}</p>
                      </td>
                      <td style="padding-bottom: 12px; width: 50%;">
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Invites</p>
                        <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: bold; color: #1a1816;">${invitesUsed} / ${inviteLimit}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>${noAssessments ? `
            <p style="margin: 0 0 24px 0; color: #1a1816; line-height: 1.6;">You haven&rsquo;t created an assessment yet &mdash; there&rsquo;s still time.</p>` : ''}
            <!-- Pricing -->
            <p style="margin: 0 0 24px 0; color: #5c564e; font-size: 14px; line-height: 1.6;">Subscribe for <strong>$200/month</strong> &mdash; unlimited assessments, unlimited candidates, full analytics.</p>
            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  ${ctaButton(ctaText, ctaUrl)}
                </td>
              </tr>
            </table>
            <p style="margin: 0; font-size: 13px; color: #8a847a; text-align: center; line-height: 1.5;">Questions? Reply to this email &mdash; we&rsquo;re here to help.</p>`;

  const html = wrapInLayout(
    content,
    `Your trial expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} \u2014 ${noAssessments ? 'create your first assessment' : 'subscribe to continue'}`,
  );

  const text = [
    greeting,
    '',
    `Your trial for ${orgName} expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} (${formattedExpiry}).`,
    '',
    'Your usage so far:',
    `- Assessments: ${assessmentsUsed} / ${assessmentLimit}`,
    `- Invites: ${invitesUsed} / ${inviteLimit}`,
    '',
    ...(noAssessments ? ["You haven't created an assessment yet — there's still time.", ''] : []),
    'Subscribe for $200/month — unlimited assessments, unlimited candidates, full analytics.',
    '',
    `${ctaText}: ${ctaUrl}`,
    '',
    'Questions? Reply to this email — we are here to help.',
    '',
    '---',
    'Sent by ruwt.dev -- AI-efficiency assessment platform',
    'Unsubscribe: https://ruwt.dev/settings',
  ].join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 10. Trial Expired (sent when trial expires)
// ---------------------------------------------------------------------------

export interface TrialExpiredParams {
  name?: string | null;
  orgName: string;
  assessmentsUsed: number;
  invitesUsed: number;
}

export function trialExpiredEmail(params: TrialExpiredParams): EmailTemplate {
  const { name, orgName, assessmentsUsed, invitesUsed } = params;

  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  const subject = 'Your trial has ended';
  const usedAssessments = assessmentsUsed > 0;

  const content = `
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #1a1816;">${greeting}</p>
            <p style="margin: 0 0 20px 0; color: #1a1816; line-height: 1.6;">Your 30-day trial for <strong>${escapeHtml(orgName)}</strong> has ended.</p>${usedAssessments ? `
            <!-- Usage recap -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 28px 0; background-color: #f5f3f0; border-radius: 8px;">
              <tr>
                <td style="padding: 20px 24px;">
                  <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: bold; color: #1a1816;">During your trial</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="width: 50%;">
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Assessments</p>
                        <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: bold; color: #1a1816;">${assessmentsUsed}</p>
                      </td>
                      <td style="width: 50%;">
                        <p style="margin: 0; font-size: 13px; color: #8a847a; text-transform: uppercase; letter-spacing: 0.5px;">Invites Sent</p>
                        <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: bold; color: #1a1816;">${invitesUsed}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin: 0 0 24px 0; color: #1a1816; line-height: 1.6;">You ran <strong>${assessmentsUsed} assessment${assessmentsUsed === 1 ? '' : 's'}</strong> during your trial. Subscribe to keep going.</p>` : `
            <p style="margin: 0 0 24px 0; color: #1a1816; line-height: 1.6;">Your trial ended before you created an assessment. We&rsquo;d love to help &mdash; reply to this email.</p>`}
            <p style="margin: 0 0 24px 0; color: #5c564e; font-size: 14px; line-height: 1.6;">All your data is saved. Subscribe anytime to pick up where you left off.</p>
            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  ${ctaButton('Subscribe Now', 'https://ruwt.dev/teams')}
                </td>
              </tr>
            </table>
            <p style="margin: 0; font-size: 13px; color: #8a847a; text-align: center; line-height: 1.5;">Questions? Reply to this email &mdash; we&rsquo;re here to help.</p>`;

  const html = wrapInLayout(content, 'Your trial has ended \u2014 subscribe to continue');

  const text = [
    greeting,
    '',
    `Your 30-day trial for ${orgName} has ended.`,
    '',
    ...(usedAssessments
      ? [
          `During your trial:`,
          `- Assessments: ${assessmentsUsed}`,
          `- Invites sent: ${invitesUsed}`,
          '',
          `You ran ${assessmentsUsed} assessment${assessmentsUsed === 1 ? '' : 's'} during your trial. Subscribe to keep going.`,
        ]
      : [
          "Your trial ended before you created an assessment. We'd love to help — reply to this email.",
        ]),
    '',
    'All your data is saved. Subscribe anytime to pick up where you left off.',
    '',
    'Subscribe now: https://ruwt.dev/teams',
    '',
    'Questions? Reply to this email — we are here to help.',
    '',
    '---',
    'Sent by ruwt.dev -- AI-efficiency assessment platform',
    'Unsubscribe: https://ruwt.dev/settings',
  ].join('\n');

  return { subject, html, text };
}
