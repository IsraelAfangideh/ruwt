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
// 1. Candidate Invite
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
// 4. Team Invite
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
