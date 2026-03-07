import { describe, it, expect } from 'vitest';
import {
  welcomeEmail,
  candidateInviteEmail,
  reminderEmail,
  resultsReadyEmail,
  newSignupNotificationEmail,
  challengeAttemptNotificationEmail,
  teamInviteEmail,
  trialStartNotificationEmail,
  trialWelcomeEmail,
  trialExpiringEmail,
  trialExpiredEmail,
} from './templates';

// ---------------------------------------------------------------------------
// Helpers (tested indirectly through the exported template functions)
// ---------------------------------------------------------------------------

describe('escapeHtml (via template output)', () => {
  it('escapes ampersands in user names', () => {
    const { html } = welcomeEmail({ name: 'Tom & Jerry' });
    expect(html).toContain('Tom &amp; Jerry');
    expect(html).not.toContain('Tom & Jerry');
  });

  it('escapes angle brackets in user names', () => {
    const { html } = welcomeEmail({ name: '<script>alert(1)</script>' });
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('escapes double quotes in URLs', () => {
    const { html } = candidateInviteEmail({
      assessmentTitle: 'Test',
      challengeCount: 3,
      timeLimit: 60,
      inviteUrl: 'https://ruwt.dev/invite?a="b"',
      expiresAt: '2026-03-15T00:00:00Z',
    });
    expect(html).toContain('https://ruwt.dev/invite?a=&quot;b&quot;');
  });

  it('escapes all four special characters together', () => {
    const { html } = welcomeEmail({ name: '&<>"' });
    expect(html).toContain('&amp;&lt;&gt;&quot;');
  });
});

describe('formatDate (via candidateInviteEmail + teamInviteEmail)', () => {
  it('formats a standard ISO date into short month format', () => {
    const { html, text } = candidateInviteEmail({
      assessmentTitle: 'Test',
      challengeCount: 1,
      timeLimit: 30,
      inviteUrl: 'https://ruwt.dev/invite/abc',
      expiresAt: '2026-02-21T00:00:00Z',
    });
    // The formatted date should look like "Feb 21, 2026" (but exact format
    // depends on locale; we check the text version which uses the same helper)
    expect(text).toContain('2026');
    expect(text).toContain('Feb');
  });

  it('formats a date in the middle of the year', () => {
    const { text } = teamInviteEmail({
      inviterName: 'Alice',
      orgName: 'Acme',
      role: 'admin',
      joinUrl: 'https://ruwt.dev/join/xyz',
      expiresAt: '2026-07-04T12:00:00Z',
    });
    expect(text).toContain('Jul');
    expect(text).toContain('2026');
  });

  it('formats a date at the end of the year', () => {
    const { text } = teamInviteEmail({
      inviterName: 'Bob',
      orgName: 'Corp',
      role: 'viewer',
      joinUrl: 'https://ruwt.dev/join/xyz',
      expiresAt: '2026-12-15T12:00:00Z',
    });
    expect(text).toContain('Dec');
    expect(text).toContain('2026');
  });

  it('handles an invalid date string gracefully (returns the raw string)', () => {
    // The function has a try/catch that returns the raw ISO string on failure.
    // However, `new Date('not-a-date')` in V8 returns Invalid Date rather than
    // throwing, so toLocaleDateString returns "Invalid Date". We verify it does
    // not crash and produces some output.
    const { html } = candidateInviteEmail({
      assessmentTitle: 'Test',
      challengeCount: 1,
      timeLimit: 30,
      inviteUrl: 'https://ruwt.dev/invite/abc',
      expiresAt: 'not-a-date',
    });
    // Should not throw, and the HTML should still be valid
    expect(html).toContain('<!DOCTYPE html>');
  });
});

describe('formatDuration (via candidateInviteEmail)', () => {
  function durationInHtml(minutes: number): string {
    return candidateInviteEmail({
      assessmentTitle: 'Test',
      challengeCount: 1,
      timeLimit: minutes,
      inviteUrl: 'https://ruwt.dev/invite/abc',
      expiresAt: '2026-03-01T00:00:00Z',
    }).text;
  }

  it('formats 0 minutes as "0 minutes"', () => {
    expect(durationInHtml(0)).toContain('Time limit: 0 minutes');
  });

  it('formats 1 minute with singular form', () => {
    expect(durationInHtml(1)).toContain('Time limit: 1 minute');
    // Must NOT say "1 minutes"
    expect(durationInHtml(1)).not.toContain('1 minutes');
  });

  it('formats 30 minutes in minutes', () => {
    expect(durationInHtml(30)).toContain('Time limit: 30 minutes');
  });

  it('formats 59 minutes in minutes', () => {
    expect(durationInHtml(59)).toContain('Time limit: 59 minutes');
  });

  it('formats exactly 60 minutes as "1 hour"', () => {
    expect(durationInHtml(60)).toContain('Time limit: 1 hour');
    // Must NOT say "1 hours"
    expect(durationInHtml(60)).not.toContain('1 hours');
  });

  it('formats exactly 120 minutes as "2 hours"', () => {
    expect(durationInHtml(120)).toContain('Time limit: 2 hours');
  });

  it('formats 90 minutes as "1h 30m"', () => {
    expect(durationInHtml(90)).toContain('Time limit: 1h 30m');
  });

  it('formats 150 minutes as "2h 30m"', () => {
    expect(durationInHtml(150)).toContain('Time limit: 2h 30m');
  });

  it('formats 61 minutes as "1h 1m"', () => {
    expect(durationInHtml(61)).toContain('Time limit: 1h 1m');
  });
});

describe('ctaButton (via template output)', () => {
  it('contains VML roundrect for Outlook compatibility', () => {
    const { html } = welcomeEmail({ name: 'Test' });
    expect(html).toContain('v:roundrect');
    expect(html).toContain('urn:schemas-microsoft-com:vml');
  });

  it('contains a table-based fallback for non-Outlook clients', () => {
    const { html } = welcomeEmail({ name: 'Test' });
    expect(html).toContain('<!--[if !mso]><!-->');
    expect(html).toContain('<table role="presentation"');
  });

  it('includes the correct href in the CTA link', () => {
    const { html } = welcomeEmail({});
    expect(html).toContain('href="https://ruwt.dev/challenges"');
  });

  it('includes the correct button label', () => {
    const { html } = welcomeEmail({});
    expect(html).toContain('Start Your First Challenge');
  });

  it('escapes href attributes in CTA buttons', () => {
    const { html } = candidateInviteEmail({
      assessmentTitle: 'Test',
      challengeCount: 1,
      timeLimit: 30,
      inviteUrl: 'https://ruwt.dev/invite?token=abc&flag=1',
      expiresAt: '2026-03-01T00:00:00Z',
    });
    // The ampersand in the URL should be escaped in the href attribute
    expect(html).toContain('token=abc&amp;flag=1');
  });
});

describe('wrapInLayout (via template output)', () => {
  it('wraps content in a valid HTML5 document', () => {
    const { html } = welcomeEmail({});
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('</html>');
  });

  it('includes the Ruwt logo header with link to ruwt.dev', () => {
    const { html } = welcomeEmail({});
    expect(html).toContain('href="https://ruwt.dev"');
    expect(html).toContain('ruwt');
    expect(html).toContain('.dev');
  });

  it('includes the footer with unsubscribe and privacy links', () => {
    const { html } = welcomeEmail({});
    expect(html).toContain('https://ruwt.dev/settings');
    expect(html).toContain('Unsubscribe');
    expect(html).toContain('https://ruwt.dev/privacy');
    expect(html).toContain('Privacy');
  });

  it('includes the preheader text in a hidden div', () => {
    const { html } = welcomeEmail({});
    // The welcome email uses a preheader
    expect(html).toContain(
      'display:none;font-size:1px;'
    );
    expect(html).toContain(
      'start your first AI coding challenge'
    );
  });

  it('escapes preheader text', () => {
    // The preheader for candidateInviteEmail includes the companyName, which
    // goes through escapeHtml when inserted into the layout
    const { html } = candidateInviteEmail({
      companyName: 'Acme & Co',
      assessmentTitle: 'Test',
      challengeCount: 1,
      timeLimit: 30,
      inviteUrl: 'https://ruwt.dev/invite/abc',
      expiresAt: '2026-03-01T00:00:00Z',
    });
    // The preheader should have the escaped version
    expect(html).toContain('Acme &amp; Co invited you');
  });

  it('includes meta tags for email compatibility', () => {
    const { html } = welcomeEmail({});
    expect(html).toContain('meta charset="utf-8"');
    expect(html).toContain('meta name="viewport"');
    expect(html).toContain('x-apple-disable-message-reformatting');
    expect(html).toContain('format-detection');
  });

  it('includes Office/VML namespaces for Outlook', () => {
    const { html } = welcomeEmail({});
    expect(html).toContain('xmlns:v="urn:schemas-microsoft-com:vml"');
    expect(html).toContain('xmlns:o="urn:schemas-microsoft-com:office:office"');
    expect(html).toContain('PixelsPerInch');
  });
});

// ---------------------------------------------------------------------------
// 1. Welcome Email
// ---------------------------------------------------------------------------

describe('welcomeEmail', () => {
  it('returns subject, html, and text properties', () => {
    const result = welcomeEmail({});
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
  });

  it('has the correct subject line', () => {
    const { subject } = welcomeEmail({});
    expect(subject).toBe('Welcome to ruwt.dev');
  });

  describe('with a name provided', () => {
    it('greets the user by name in HTML', () => {
      const { html } = welcomeEmail({ name: 'Alice' });
      expect(html).toContain('Hi Alice,');
    });

    it('greets the user by name in plain text', () => {
      const { text } = welcomeEmail({ name: 'Alice' });
      expect(text).toContain('Hi Alice,');
    });
  });

  describe('without a name', () => {
    it('uses a generic greeting when name is undefined', () => {
      const { html, text } = welcomeEmail({});
      expect(html).toContain('Hi there,');
      expect(text).toContain('Hi there,');
    });

    it('uses a generic greeting when name is null', () => {
      const { html, text } = welcomeEmail({ name: null });
      expect(html).toContain('Hi there,');
      expect(text).toContain('Hi there,');
    });

    it('uses a generic greeting when name is empty string', () => {
      // empty string is falsy, so should fall back to generic
      const { html, text } = welcomeEmail({ name: '' });
      expect(html).toContain('Hi there,');
      expect(text).toContain('Hi there,');
    });
  });

  it('escapes HTML special characters in the name', () => {
    const { html } = welcomeEmail({ name: '<b>Bold</b>' });
    expect(html).toContain('&lt;b&gt;Bold&lt;/b&gt;');
    expect(html).not.toContain('<b>Bold</b>');
  });

  it('includes platform highlights (challenges, models, daily)', () => {
    const { html } = welcomeEmail({});
    expect(html).toContain('100+ challenges');
    expect(html).toContain('17 AI models');
    expect(html).toContain('Daily challenges');
  });

  it('includes the CTA button linking to /challenges', () => {
    const { html } = welcomeEmail({});
    expect(html).toContain('Start Your First Challenge');
    expect(html).toContain('https://ruwt.dev/challenges');
  });

  it('mentions FizzBuzz Budget as a starter recommendation', () => {
    const { html, text } = welcomeEmail({});
    expect(html).toContain('FizzBuzz Budget');
    expect(text).toContain('FizzBuzz Budget');
  });

  it('plain text includes all key information', () => {
    const { text } = welcomeEmail({ name: 'Bob' });
    expect(text).toContain('Hi Bob,');
    expect(text).toContain('Welcome to ruwt.dev');
    expect(text).toContain('100% free');
    expect(text).toContain('https://ruwt.dev/challenges');
    expect(text).toContain('Unsubscribe: https://ruwt.dev/settings');
    expect(text).toContain('Sent by ruwt.dev');
  });

  it('handles a very long name without breaking', () => {
    const longName = 'A'.repeat(500);
    const { html, text } = welcomeEmail({ name: longName });
    expect(html).toContain(`Hi ${longName},`);
    expect(text).toContain(`Hi ${longName},`);
  });

  it('handles Unicode characters in names', () => {
    const { html, text } = welcomeEmail({ name: 'Rene (Rene)' });
    expect(html).toContain('Hi Rene (Rene),');
    expect(text).toContain('Hi Rene (Rene),');
  });
});

// ---------------------------------------------------------------------------
// 2. Candidate Invite Email
// ---------------------------------------------------------------------------

describe('candidateInviteEmail', () => {
  const baseParams = {
    assessmentTitle: 'Senior Engineer Assessment',
    challengeCount: 5,
    timeLimit: 90,
    inviteUrl: 'https://ruwt.dev/invite/abc123',
    expiresAt: '2026-03-15T00:00:00Z',
  };

  it('returns subject, html, and text properties', () => {
    const result = candidateInviteEmail(baseParams);
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
  });

  describe('subject line', () => {
    it('includes company name when provided', () => {
      const { subject } = candidateInviteEmail({
        ...baseParams,
        companyName: 'Acme Corp',
      });
      expect(subject).toBe('Acme Corp has invited you to an AI assessment');
    });

    it('uses a generic subject when no company name', () => {
      const { subject } = candidateInviteEmail(baseParams);
      expect(subject).toBe("You've been invited to an AI assessment");
    });
  });

  describe('greeting', () => {
    it('personalizes with candidate name', () => {
      const { html, text } = candidateInviteEmail({
        ...baseParams,
        candidateName: 'Jane',
      });
      expect(html).toContain('Hi Jane,');
      expect(text).toContain('Hi Jane,');
    });

    it('uses generic greeting without candidate name', () => {
      const { html, text } = candidateInviteEmail(baseParams);
      expect(html).toContain('Hi there,');
      expect(text).toContain('Hi there,');
    });
  });

  describe('company branding', () => {
    it('includes company logo when URL is provided', () => {
      const { html } = candidateInviteEmail({
        ...baseParams,
        companyName: 'Acme Corp',
        companyLogoUrl: 'https://acme.com/logo.png',
      });
      expect(html).toContain('<img src="https://acme.com/logo.png"');
      expect(html).toContain('alt="Acme Corp"');
    });

    it('uses "Company" as alt text when logo URL given without company name', () => {
      const { html } = candidateInviteEmail({
        ...baseParams,
        companyLogoUrl: 'https://example.com/logo.png',
      });
      expect(html).toContain('alt="Company"');
    });

    it('omits logo section when no URL provided', () => {
      const { html } = candidateInviteEmail(baseParams);
      expect(html).not.toContain('<img');
    });

    it('includes company name in the inviter line', () => {
      const { html } = candidateInviteEmail({
        ...baseParams,
        companyName: 'Google',
      });
      expect(html).toContain('<strong>Google</strong> has invited you');
    });

    it('uses generic inviter line without company name', () => {
      const { html } = candidateInviteEmail(baseParams);
      expect(html).toContain("You've been invited to complete an AI-efficiency assessment");
    });
  });

  describe('assessment description', () => {
    it('includes description when provided', () => {
      const { html } = candidateInviteEmail({
        ...baseParams,
        assessmentDescription: 'This tests your debugging skills.',
      });
      expect(html).toContain('This tests your debugging skills.');
    });

    it('includes description in plain text', () => {
      const { text } = candidateInviteEmail({
        ...baseParams,
        assessmentDescription: 'This tests your debugging skills.',
      });
      expect(text).toContain('This tests your debugging skills.');
    });

    it('omits description section when not provided', () => {
      const { html } = candidateInviteEmail(baseParams);
      // The description paragraph uses a specific style; check it's absent
      expect(html).not.toContain('color: #5c564e; font-size: 14px; line-height: 1.6;');
    });
  });

  it('displays the assessment title', () => {
    const { html, text } = candidateInviteEmail(baseParams);
    expect(html).toContain('Senior Engineer Assessment');
    expect(text).toContain('Assessment: Senior Engineer Assessment');
  });

  it('displays the challenge count', () => {
    const { html, text } = candidateInviteEmail(baseParams);
    expect(html).toContain('>5<');
    expect(text).toContain('Challenges: 5');
  });

  it('displays the formatted time limit', () => {
    const { html, text } = candidateInviteEmail(baseParams);
    // 90 minutes = "1h 30m"
    expect(html).toContain('1h 30m');
    expect(text).toContain('Time limit: 1h 30m');
  });

  it('includes the invite URL in the CTA and fallback link', () => {
    const { html } = candidateInviteEmail(baseParams);
    // The CTA button and fallback link both reference the invite URL
    const hrefCount = html.split('https://ruwt.dev/invite/abc123').length - 1;
    expect(hrefCount).toBeGreaterThanOrEqual(3); // VML href, anchor href, fallback
  });

  it('displays the expiry date', () => {
    const { html, text } = candidateInviteEmail(baseParams);
    expect(html).toContain('expires on');
    expect(text).toContain('expires on');
    // Should contain the formatted date (Mar 15, 2026 or similar)
    expect(text).toContain('Mar');
    expect(text).toContain('2026');
  });

  it('escapes special characters in all user-supplied fields', () => {
    const { html } = candidateInviteEmail({
      candidateName: 'J&J',
      companyName: '<Evil Corp>',
      assessmentTitle: 'Test "quotes"',
      assessmentDescription: 'Has <html> & "special" chars',
      challengeCount: 3,
      timeLimit: 60,
      inviteUrl: 'https://ruwt.dev/invite/abc',
      expiresAt: '2026-03-01T00:00:00Z',
    });
    expect(html).toContain('J&amp;J');
    expect(html).toContain('&lt;Evil Corp&gt;');
    expect(html).toContain('Test &quot;quotes&quot;');
    expect(html).toContain('Has &lt;html&gt; &amp; &quot;special&quot; chars');
  });

  describe('preheader', () => {
    it('includes company name in preheader when provided', () => {
      const { html } = candidateInviteEmail({
        ...baseParams,
        companyName: 'Acme',
      });
      expect(html).toContain('Acme invited you to an AI assessment');
    });

    it('uses generic preheader without company name', () => {
      const { html } = candidateInviteEmail(baseParams);
      expect(html).toContain('You have been invited to an AI assessment');
    });
  });

  it('plain text includes the full structured information', () => {
    const { text } = candidateInviteEmail({
      ...baseParams,
      candidateName: 'Bob',
      companyName: 'TestCo',
    });
    expect(text).toContain('Hi Bob,');
    expect(text).toContain('TestCo has invited you');
    expect(text).toContain('Assessment: Senior Engineer Assessment');
    expect(text).toContain('Challenges: 5');
    expect(text).toContain('Time limit: 1h 30m');
    expect(text).toContain('Start your assessment: https://ruwt.dev/invite/abc123');
    expect(text).toContain('Sent by ruwt.dev');
    expect(text).toContain('Unsubscribe');
  });
});

// ---------------------------------------------------------------------------
// 3. Reminder Email
// ---------------------------------------------------------------------------

describe('reminderEmail', () => {
  const baseParams = {
    assessmentTitle: 'Frontend Challenge',
    inviteUrl: 'https://ruwt.dev/invite/def456',
    daysRemaining: 3,
  };

  it('returns subject, html, and text properties', () => {
    const result = reminderEmail(baseParams);
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
  });

  describe('subject line', () => {
    it('includes the number of days remaining (plural)', () => {
      const { subject } = reminderEmail(baseParams);
      expect(subject).toContain('3 days left');
    });

    it('uses singular "day" for 1 day remaining', () => {
      const { subject } = reminderEmail({ ...baseParams, daysRemaining: 1 });
      expect(subject).toContain('1 day left');
      expect(subject).not.toContain('1 days');
    });
  });

  describe('greeting', () => {
    it('personalizes with candidate name', () => {
      const { html, text } = reminderEmail({
        ...baseParams,
        candidateName: 'Charlie',
      });
      expect(html).toContain('Hi Charlie,');
      expect(text).toContain('Hi Charlie,');
    });

    it('uses generic greeting without candidate name', () => {
      const { html } = reminderEmail(baseParams);
      expect(html).toContain('Hi there,');
    });
  });

  describe('company name', () => {
    it('includes company name in the reminder body', () => {
      const { html, text } = reminderEmail({
        ...baseParams,
        companyName: 'Acme',
      });
      expect(html).toContain('<strong>Acme</strong>');
      expect(text).toContain('from Acme');
    });

    it('omits the "from" clause without company name', () => {
      const { html, text } = reminderEmail(baseParams);
      expect(html).toContain('pending AI assessment on ruwt.dev');
      expect(html).not.toContain(' from <strong>');
      expect(text).not.toContain('from ');
    });
  });

  describe('urgency messaging', () => {
    it('shows "last day" message when daysRemaining is 1', () => {
      const { html, text } = reminderEmail({ ...baseParams, daysRemaining: 1 });
      expect(html).toContain('This is your last day to complete it.');
      expect(text).toContain('This is your last day to complete it.');
    });

    it('shows "last day" message when daysRemaining is 0', () => {
      const { html, text } = reminderEmail({ ...baseParams, daysRemaining: 0 });
      expect(html).toContain('This is your last day to complete it.');
      expect(text).toContain('This is your last day to complete it.');
    });

    it('shows X days remaining for values > 1', () => {
      const { html, text } = reminderEmail({ ...baseParams, daysRemaining: 5 });
      expect(html).toContain('<strong>5 days</strong> remaining');
      expect(text).toContain('5 days remaining');
    });
  });

  it('includes the assessment title', () => {
    const { html, text } = reminderEmail(baseParams);
    expect(html).toContain('Frontend Challenge');
    expect(text).toContain('Assessment: Frontend Challenge');
  });

  it('includes the CTA button with "Continue Assessment"', () => {
    const { html } = reminderEmail(baseParams);
    expect(html).toContain('Continue Assessment');
    expect(html).toContain('https://ruwt.dev/invite/def456');
  });

  it('includes a fallback link', () => {
    const { html } = reminderEmail(baseParams);
    expect(html).toContain("If the button doesn't work");
    expect(html).toContain('https://ruwt.dev/invite/def456');
  });

  it('escapes special characters in the assessment title', () => {
    const { html } = reminderEmail({
      ...baseParams,
      assessmentTitle: 'Test & Eval <v2>',
    });
    expect(html).toContain('Test &amp; Eval &lt;v2&gt;');
  });

  describe('preheader', () => {
    it('includes days remaining in preheader (plural)', () => {
      const { html } = reminderEmail(baseParams);
      expect(html).toContain('3 days left');
    });

    it('uses singular form in preheader for 1 day', () => {
      const { html } = reminderEmail({ ...baseParams, daysRemaining: 1 });
      // The preheader says "1 day left"
      expect(html).toContain('1 day left');
    });
  });

  it('plain text includes all key information', () => {
    const { text } = reminderEmail({
      ...baseParams,
      candidateName: 'Diana',
      companyName: 'BigCo',
    });
    expect(text).toContain('Hi Diana,');
    expect(text).toContain('from BigCo');
    expect(text).toContain('Assessment: Frontend Challenge');
    expect(text).toContain('3 days remaining');
    expect(text).toContain('Continue your assessment: https://ruwt.dev/invite/def456');
    expect(text).toContain('Sent by ruwt.dev');
  });
});

// ---------------------------------------------------------------------------
// 4. Results Ready Email
// ---------------------------------------------------------------------------

describe('resultsReadyEmail', () => {
  const baseParams = {
    candidateName: 'John Doe',
    candidateEmail: 'john@example.com',
    assessmentTitle: 'Backend Assessment',
    challengesPassed: 4,
    totalChallenges: 5,
    resultsUrl: 'https://ruwt.dev/results/xyz789',
  };

  it('returns subject, html, and text properties', () => {
    const result = resultsReadyEmail(baseParams);
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
  });

  it('includes candidate name and assessment title in the subject', () => {
    const { subject } = resultsReadyEmail(baseParams);
    expect(subject).toContain('John Doe');
    expect(subject).toContain('Backend Assessment');
    expect(subject).toContain('Assessment completed');
  });

  describe('greeting', () => {
    it('personalizes with hiring manager name', () => {
      const { html } = resultsReadyEmail({
        ...baseParams,
        hiringManagerName: 'Sarah',
      });
      expect(html).toContain('Hi Sarah,');
    });

    it('uses generic greeting without hiring manager name', () => {
      const { html } = resultsReadyEmail(baseParams);
      expect(html).toContain('Hi there,');
    });
  });

  it('displays the candidate name and email', () => {
    const { html, text } = resultsReadyEmail(baseParams);
    expect(html).toContain('<strong>John Doe</strong>');
    expect(html).toContain('john@example.com');
    expect(text).toContain('John Doe (john@example.com)');
  });

  it('shows the challenges passed out of total', () => {
    const { html, text } = resultsReadyEmail(baseParams);
    expect(html).toContain('4 / 5');
    expect(text).toContain('4 / 5 challenges passed');
  });

  it('shows the pass rate as a percentage', () => {
    const { text } = resultsReadyEmail(baseParams);
    expect(text).toContain('80%');
  });

  describe('score color coding', () => {
    it('uses green for >= 70% pass rate', () => {
      const { html } = resultsReadyEmail({
        ...baseParams,
        challengesPassed: 4,
        totalChallenges: 5, // 80%
      });
      expect(html).toContain('#5a8a5a'); // green
    });

    it('uses gold for >= 40% and < 70% pass rate', () => {
      const { html } = resultsReadyEmail({
        ...baseParams,
        challengesPassed: 2,
        totalChallenges: 5, // 40%
      });
      expect(html).toContain('#c9a962'); // gold (in score, not CTA)
    });

    it('uses red for < 40% pass rate', () => {
      const { html } = resultsReadyEmail({
        ...baseParams,
        challengesPassed: 1,
        totalChallenges: 5, // 20%
      });
      expect(html).toContain('#b06060'); // red
    });

    it('uses red (0%) when no challenges passed', () => {
      const { html, text } = resultsReadyEmail({
        ...baseParams,
        challengesPassed: 0,
        totalChallenges: 5,
      });
      expect(html).toContain('#b06060');
      expect(text).toContain('0%');
    });

    it('handles zero total challenges (avoids division by zero)', () => {
      const { html, text } = resultsReadyEmail({
        ...baseParams,
        challengesPassed: 0,
        totalChallenges: 0,
      });
      // passRate should be 0
      expect(text).toContain('0%');
      // Should not throw or produce NaN
      expect(html).not.toContain('NaN');
    });
  });

  it('includes a progress bar in the HTML', () => {
    const { html } = resultsReadyEmail(baseParams);
    // The progress bar uses a width percentage
    expect(html).toContain('width="80%"');
  });

  it('includes the CTA button with "View Full Results"', () => {
    const { html } = resultsReadyEmail(baseParams);
    expect(html).toContain('View Full Results');
    expect(html).toContain('https://ruwt.dev/results/xyz789');
  });

  it('includes a fallback link', () => {
    const { html } = resultsReadyEmail(baseParams);
    expect(html).toContain("If the button doesn't work");
  });

  it('escapes special characters in candidate info', () => {
    const { html } = resultsReadyEmail({
      ...baseParams,
      candidateName: 'O\'Brien & Associates',
      candidateEmail: 'test+<script>@evil.com',
    });
    // escapeHtml only escapes &, <, >, " -- single quotes are left as-is
    expect(html).toContain("O'Brien");
    expect(html).toContain('&amp; Associates');
    expect(html).toContain('&lt;script&gt;');
  });

  it('includes candidate name in the preheader', () => {
    const { html } = resultsReadyEmail(baseParams);
    // Preheader text: "John Doe completed Backend Assessment: 4/5 passed"
    expect(html).toContain('John Doe completed Backend Assessment');
  });

  it('plain text includes all key information', () => {
    const { text } = resultsReadyEmail({
      ...baseParams,
      hiringManagerName: 'Manager',
    });
    expect(text).toContain('Hi Manager,');
    expect(text).toContain('John Doe (john@example.com)');
    expect(text).toContain('"Backend Assessment"');
    expect(text).toContain('4 / 5 challenges passed (80%)');
    expect(text).toContain('https://ruwt.dev/results/xyz789');
    expect(text).toContain('Sent by ruwt.dev');
  });

  describe('boundary pass rates', () => {
    it('rounds correctly at exactly 70% (green)', () => {
      const { html } = resultsReadyEmail({
        ...baseParams,
        challengesPassed: 7,
        totalChallenges: 10,
      });
      expect(html).toContain('#5a8a5a');
    });

    it('uses gold at exactly 40%', () => {
      const { html } = resultsReadyEmail({
        ...baseParams,
        challengesPassed: 2,
        totalChallenges: 5,
      });
      expect(html).toContain('#c9a962');
    });

    it('uses red at 39%', () => {
      // 39/100 = 39%
      const { html } = resultsReadyEmail({
        ...baseParams,
        challengesPassed: 39,
        totalChallenges: 100,
      });
      expect(html).toContain('#b06060');
    });

    it('uses green at 100%', () => {
      const { html, text } = resultsReadyEmail({
        ...baseParams,
        challengesPassed: 5,
        totalChallenges: 5,
      });
      expect(html).toContain('#5a8a5a');
      expect(text).toContain('100%');
    });
  });
});

// ---------------------------------------------------------------------------
// 5. New Signup Notification Email (admin)
// ---------------------------------------------------------------------------

describe('newSignupNotificationEmail', () => {
  const baseParams = {
    userName: 'Jane Doe',
    userEmail: 'jane@example.com',
    provider: 'github',
  };

  it('returns subject, html, and text properties', () => {
    const result = newSignupNotificationEmail(baseParams);
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
  });

  it('includes user name in the subject when provided', () => {
    const { subject } = newSignupNotificationEmail(baseParams);
    expect(subject).toContain('Jane Doe');
    expect(subject).toContain('just joined');
  });

  it('falls back to email in subject when name is null', () => {
    const { subject } = newSignupNotificationEmail({ ...baseParams, userName: null });
    expect(subject).toContain('jane@example.com');
  });

  it('falls back to email in subject when name is undefined', () => {
    const { subject } = newSignupNotificationEmail({ userEmail: 'bob@test.com', provider: 'email' });
    expect(subject).toContain('bob@test.com');
  });

  it('displays user details in HTML', () => {
    const { html } = newSignupNotificationEmail(baseParams);
    expect(html).toContain('Jane Doe');
    expect(html).toContain('jane@example.com');
  });

  it('shows "GitHub OAuth" for github provider', () => {
    const { html, text } = newSignupNotificationEmail(baseParams);
    expect(html).toContain('GitHub OAuth');
    expect(text).toContain('GitHub OAuth');
  });

  it('shows "Email signup" for email provider', () => {
    const { html, text } = newSignupNotificationEmail({ ...baseParams, provider: 'email' });
    expect(html).toContain('Email signup');
    expect(text).toContain('Email signup');
  });

  it('shows raw provider for unknown providers', () => {
    const { html, text } = newSignupNotificationEmail({ ...baseParams, provider: 'google' });
    expect(html).toContain('google');
    expect(text).toContain('google');
  });

  it('shows "Someone new" when name is null', () => {
    const { html } = newSignupNotificationEmail({ ...baseParams, userName: null });
    expect(html).toContain('Someone new');
  });

  it('includes the action checklist in HTML', () => {
    const { html } = newSignupNotificationEmail(baseParams);
    expect(html).toContain('Send them a personal welcome');
    expect(html).toContain('Add them to the CRM');
    expect(html).toContain('complete onboarding');
    expect(html).toContain('which challenge they try first');
    expect(html).toContain('GitHub, check out their profile');
  });

  it('includes the action checklist in plain text', () => {
    const { text } = newSignupNotificationEmail(baseParams);
    expect(text).toContain('[ ] Send them a personal welcome');
    expect(text).toContain('[ ] Add them to the CRM');
    expect(text).toContain('[ ] Check if they complete onboarding');
    expect(text).toContain('[ ] See which challenge they try first');
  });

  it('includes CTA linking to leaderboard', () => {
    const { html } = newSignupNotificationEmail(baseParams);
    expect(html).toContain('View Leaderboard');
    expect(html).toContain('https://ruwt.dev/leaderboard');
  });

  it('includes motivational footer', () => {
    const { html, text } = newSignupNotificationEmail(baseParams);
    expect(html).toContain('Every signup is a step closer');
    expect(text).toContain('Every signup is a step closer');
  });

  it('escapes HTML in user name', () => {
    const { html } = newSignupNotificationEmail({ ...baseParams, userName: '<script>alert(1)</script>' });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('escapes HTML in user email', () => {
    const { html } = newSignupNotificationEmail({ ...baseParams, userEmail: 'a&b@test.com' });
    expect(html).toContain('a&amp;b@test.com');
  });

  it('escapes HTML in provider', () => {
    const { html } = newSignupNotificationEmail({ ...baseParams, provider: '<bad>' });
    expect(html).toContain('&lt;bad&gt;');
  });

  it('plain text includes all key information', () => {
    const { text } = newSignupNotificationEmail(baseParams);
    expect(text).toContain('New user just signed up!');
    expect(text).toContain('Name: Jane Doe');
    expect(text).toContain('Email: jane@example.com');
    expect(text).toContain('Signed up via: GitHub OAuth');
    expect(text).toContain('https://ruwt.dev/leaderboard');
  });

  it('plain text shows "Not provided" when name is null', () => {
    const { text } = newSignupNotificationEmail({ ...baseParams, userName: null });
    expect(text).toContain('Name: Not provided');
  });
});

// ---------------------------------------------------------------------------
// 6. Challenge Attempt Notification Email (admin)
// ---------------------------------------------------------------------------

describe('challengeAttemptNotificationEmail', () => {
  const passParams = {
    userName: 'Alice',
    userEmail: 'alice@example.com',
    challengeTitle: 'FizzBuzz Budget',
    challengeDifficulty: 'easy',
    passed: true,
    passedTests: 5,
    totalTests: 5,
    totalCost: 1200,
  };

  const failParams = {
    ...passParams,
    passed: false,
    passedTests: 3,
    totalTests: 5,
  };

  it('returns subject, html, and text properties', () => {
    const result = challengeAttemptNotificationEmail(passParams);
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
  });

  describe('subject line', () => {
    it('says "solved" for passed attempts', () => {
      const { subject } = challengeAttemptNotificationEmail(passParams);
      expect(subject).toContain('solved');
      expect(subject).toContain('FizzBuzz Budget');
      expect(subject).toContain('Alice');
    });

    it('says "attempted" for failed attempts', () => {
      const { subject } = challengeAttemptNotificationEmail(failParams);
      expect(subject).toContain('attempted');
      expect(subject).toContain('FizzBuzz Budget');
    });

    it('uses email when name is null', () => {
      const { subject } = challengeAttemptNotificationEmail({ ...passParams, userName: null });
      expect(subject).toContain('alice@example.com');
    });
  });

  describe('result display', () => {
    it('shows PASSED label with green color for passed', () => {
      const { html, text } = challengeAttemptNotificationEmail(passParams);
      expect(html).toContain('PASSED');
      expect(html).toContain('#5a8a5a');
      expect(text).toContain('PASSED');
    });

    it('shows FAILED label with red color for failed', () => {
      const { html, text } = challengeAttemptNotificationEmail(failParams);
      expect(html).toContain('FAILED');
      expect(html).toContain('#b06060');
      expect(text).toContain('FAILED');
    });
  });

  describe('attempt details', () => {
    it('shows challenge title and difficulty', () => {
      const { html, text } = challengeAttemptNotificationEmail(passParams);
      expect(html).toContain('FizzBuzz Budget');
      expect(html).toContain('Easy');
      expect(text).toContain('Challenge: FizzBuzz Budget');
      expect(text).toContain('Difficulty: Easy');
    });

    it('shows test results', () => {
      const { html, text } = challengeAttemptNotificationEmail(passParams);
      expect(html).toContain('5 / 5');
      expect(text).toContain('Tests: 5 / 5');
    });

    it('shows AI cost in credits', () => {
      const { html, text } = challengeAttemptNotificationEmail(passParams);
      expect(html).toContain('1,200 credits');
      expect(text).toContain('1,200 credits');
    });

    it('shows "Free (no AI used)" for zero cost', () => {
      const { html, text } = challengeAttemptNotificationEmail({ ...passParams, totalCost: 0 });
      expect(html).toContain('Free (no AI used)');
      expect(text).toContain('Free (no AI used)');
    });

    it('shows user name and email', () => {
      const { html, text } = challengeAttemptNotificationEmail(passParams);
      expect(html).toContain('Alice');
      expect(html).toContain('alice@example.com');
      expect(text).toContain('Alice');
      expect(text).toContain('alice@example.com');
    });

    it('shows email as display name when name is null', () => {
      const { html } = challengeAttemptNotificationEmail({ ...passParams, userName: null });
      expect(html).toContain('alice@example.com');
    });
  });

  describe('difficulty color coding', () => {
    it('uses green for easy', () => {
      const { html } = challengeAttemptNotificationEmail({ ...passParams, challengeDifficulty: 'easy' });
      expect(html).toContain('color: #5a8a5a;">Easy');
    });

    it('uses gold for medium', () => {
      const { html } = challengeAttemptNotificationEmail({ ...passParams, challengeDifficulty: 'medium' });
      expect(html).toContain('color: #c9a962;">Medium');
    });

    it('uses red for hard', () => {
      const { html } = challengeAttemptNotificationEmail({ ...passParams, challengeDifficulty: 'hard' });
      expect(html).toContain('color: #b06060;">Hard');
    });
  });

  describe('contextual messaging', () => {
    it('shows positive message for passed attempts', () => {
      const { html, text } = challengeAttemptNotificationEmail(passParams);
      expect(html).toContain('Another one in the bag');
      expect(text).toContain('Another one in the bag');
    });

    it('shows encouragement message for failed attempts', () => {
      const { html, text } = challengeAttemptNotificationEmail(failParams);
      expect(html).toContain('grinding');
      expect(text).toContain('grinding');
    });
  });

  it('includes CTA linking to activity feed', () => {
    const { html } = challengeAttemptNotificationEmail(passParams);
    expect(html).toContain('View Activity Feed');
    expect(html).toContain('https://ruwt.dev/activity');
  });

  it('escapes HTML in all user-supplied fields', () => {
    const { html } = challengeAttemptNotificationEmail({
      ...passParams,
      userName: '<b>Evil</b>',
      userEmail: 'a&b@test.com',
      challengeTitle: 'Test & Eval <v2>',
    });
    expect(html).toContain('&lt;b&gt;Evil&lt;/b&gt;');
    expect(html).toContain('a&amp;b@test.com');
    expect(html).toContain('Test &amp; Eval &lt;v2&gt;');
  });

  it('plain text includes all key information', () => {
    const { text } = challengeAttemptNotificationEmail(passParams);
    expect(text).toContain('PASSED: Alice');
    expect(text).toContain('FizzBuzz Budget');
    expect(text).toContain('Difficulty: Easy');
    expect(text).toContain('Tests: 5 / 5');
    expect(text).toContain('https://ruwt.dev/activity');
    expect(text).toContain('Sent by ruwt.dev');
  });
});

// ---------------------------------------------------------------------------
// 7. Team Invite Email
// ---------------------------------------------------------------------------

describe('teamInviteEmail', () => {
  const baseParams = {
    inviterName: 'Alice Johnson',
    orgName: 'Acme Engineering',
    role: 'admin',
    joinUrl: 'https://ruwt.dev/join/team123',
    expiresAt: '2026-04-01T00:00:00Z',
  };

  it('returns subject, html, and text properties', () => {
    const result = teamInviteEmail(baseParams);
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
  });

  it('includes org name in the subject', () => {
    const { subject } = teamInviteEmail(baseParams);
    expect(subject).toBe('Join Acme Engineering on Ruwt');
  });

  it('uses "Hi," as a static greeting (no personalization)', () => {
    const { html, text } = teamInviteEmail(baseParams);
    expect(html).toContain('>Hi,<');
    expect(text.startsWith('Hi,')).toBe(true);
  });

  it('mentions the inviter name', () => {
    const { html, text } = teamInviteEmail(baseParams);
    expect(html).toContain('<strong>Alice Johnson</strong>');
    expect(text).toContain('Alice Johnson has invited you');
  });

  it('mentions the organization name in the body and details box', () => {
    const { html, text } = teamInviteEmail(baseParams);
    // Organization appears in both the invite line and the details table
    const orgMatches = html.split('Acme Engineering').length - 1;
    expect(orgMatches).toBeGreaterThanOrEqual(2);
    expect(text).toContain('Organization: Acme Engineering');
  });

  it('capitalizes the first letter of the role', () => {
    const { html, text } = teamInviteEmail(baseParams);
    expect(html).toContain('Admin');
    expect(text).toContain('Your role: Admin');
  });

  it('capitalizes role correctly for multi-word roles', () => {
    const { html } = teamInviteEmail({ ...baseParams, role: 'viewer' });
    expect(html).toContain('Viewer');
  });

  it('includes the team collaboration description', () => {
    const { html, text } = teamInviteEmail(baseParams);
    expect(html).toContain('collaborate on assessments');
    expect(text).toContain('collaborate on assessments');
  });

  it('includes the CTA button with "Accept Invitation"', () => {
    const { html } = teamInviteEmail(baseParams);
    expect(html).toContain('Accept Invitation');
    expect(html).toContain('https://ruwt.dev/join/team123');
  });

  it('displays the expiry date', () => {
    const { html, text } = teamInviteEmail(baseParams);
    expect(html).toContain('expires on');
    expect(text).toContain('expires on');
    expect(text).toContain('Apr');
    expect(text).toContain('2026');
  });

  it('includes a fallback link', () => {
    const { html } = teamInviteEmail(baseParams);
    expect(html).toContain("If the button doesn't work");
    expect(html).toContain('https://ruwt.dev/join/team123');
  });

  it('escapes HTML in inviter name and org name', () => {
    const { html } = teamInviteEmail({
      ...baseParams,
      inviterName: 'Bob <admin>',
      orgName: 'R&D Corp',
    });
    expect(html).toContain('Bob &lt;admin&gt;');
    expect(html).toContain('R&amp;D Corp');
  });

  it('escapes HTML in the role', () => {
    const { html } = teamInviteEmail({
      ...baseParams,
      role: '<script>alert("xss")</script>',
    });
    // The role gets capitalized first (< -> <, charAt(0).toUpperCase() = '<')
    // then escaped. The display role becomes "&lt;script&gt;..."
    expect(html).not.toContain('<script>alert');
  });

  it('includes inviter and org in the preheader', () => {
    const { html } = teamInviteEmail(baseParams);
    expect(html).toContain('Alice Johnson invited you to join Acme Engineering');
  });

  it('plain text includes all key information', () => {
    const { text } = teamInviteEmail(baseParams);
    expect(text).toContain('Hi,');
    expect(text).toContain('Alice Johnson has invited you to join Acme Engineering');
    expect(text).toContain('Organization: Acme Engineering');
    expect(text).toContain('Your role: Admin');
    expect(text).toContain('Accept invitation: https://ruwt.dev/join/team123');
    expect(text).toContain('Sent by ruwt.dev');
    expect(text).toContain('Unsubscribe');
  });
});

// ---------------------------------------------------------------------------
// trialWelcomeEmail — no org/team name
// ---------------------------------------------------------------------------

describe('trialWelcomeEmail', () => {
  it('does not include any specific org or team name in the email', () => {
    const { html, text } = trialWelcomeEmail({
      name: 'Sam',
      trialEndsAt: '2026-04-05T00:00:00Z',
      assessmentLimit: 1,
      inviteLimit: 3,
    });

    // Should say "Your organization is set up..." without a specific name
    expect(html).toContain('Your organization is set up with a 30-day free trial');
    expect(text).toContain('Your organization is set up with a 30-day free trial');
    expect(html).not.toContain('My Team');
    expect(text).not.toContain('My Team');
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: all templates produce well-formed output
// ---------------------------------------------------------------------------

describe('all templates produce structurally valid output', () => {
  const allTemplates = [
    { name: 'welcomeEmail', fn: () => welcomeEmail({ name: 'Test' }) },
    {
      name: 'candidateInviteEmail',
      fn: () =>
        candidateInviteEmail({
          candidateName: 'Test',
          companyName: 'Acme',
          assessmentTitle: 'Assessment',
          challengeCount: 3,
          timeLimit: 60,
          inviteUrl: 'https://ruwt.dev/invite/x',
          expiresAt: '2026-06-01T00:00:00Z',
        }),
    },
    {
      name: 'reminderEmail',
      fn: () =>
        reminderEmail({
          candidateName: 'Test',
          companyName: 'Acme',
          assessmentTitle: 'Assessment',
          inviteUrl: 'https://ruwt.dev/invite/x',
          daysRemaining: 3,
        }),
    },
    {
      name: 'resultsReadyEmail',
      fn: () =>
        resultsReadyEmail({
          hiringManagerName: 'Manager',
          candidateName: 'Candidate',
          candidateEmail: 'c@test.com',
          assessmentTitle: 'Assessment',
          challengesPassed: 2,
          totalChallenges: 3,
          resultsUrl: 'https://ruwt.dev/results/x',
        }),
    },
    {
      name: 'newSignupNotificationEmail',
      fn: () =>
        newSignupNotificationEmail({
          userName: 'Test User',
          userEmail: 'test@example.com',
          provider: 'github',
        }),
    },
    {
      name: 'challengeAttemptNotificationEmail',
      fn: () =>
        challengeAttemptNotificationEmail({
          userName: 'Test User',
          userEmail: 'test@example.com',
          challengeTitle: 'Test Challenge',
          challengeDifficulty: 'easy',
          passed: true,
          passedTests: 3,
          totalTests: 3,
          totalCost: 500,
        }),
    },
    {
      name: 'teamInviteEmail',
      fn: () =>
        teamInviteEmail({
          inviterName: 'Inviter',
          orgName: 'Org',
          role: 'admin',
          joinUrl: 'https://ruwt.dev/join/x',
          expiresAt: '2026-06-01T00:00:00Z',
        }),
    },
    {
      name: 'trialStartNotificationEmail',
      fn: () =>
        trialStartNotificationEmail({
          userName: 'Test',
          userEmail: 'test@co.com',
          orgName: 'Acme',
          provider: 'github',
          trialEndsAt: '2026-04-06T00:00:00Z',
        }),
    },
    {
      name: 'trialWelcomeEmail',
      fn: () =>
        trialWelcomeEmail({
          name: 'Test',
          trialEndsAt: '2026-04-06T00:00:00Z',
          assessmentLimit: 1,
          inviteLimit: 3,
        }),
    },
    {
      name: 'trialExpiringEmail',
      fn: () =>
        trialExpiringEmail({
          name: 'Test',
          orgName: 'Acme',
          daysLeft: 7,
          assessmentsUsed: 0,
          assessmentsLimit: 1,
          invitesLimit: 3,
        }),
    },
    {
      name: 'trialExpiredEmail',
      fn: () =>
        trialExpiredEmail({
          name: 'Test',
          orgName: 'Acme',
          assessmentsUsed: 1,
          assessmentsLimit: 1,
        }),
    },
  ];

  for (const { name, fn } of allTemplates) {
    describe(name, () => {
      it('HTML starts with DOCTYPE and ends with closing html tag', () => {
        const { html } = fn();
        expect(html.trim()).toMatch(/^<!DOCTYPE html>/);
        expect(html.trim()).toMatch(/<\/html>$/);
      });

      it('HTML contains opening and closing body tags', () => {
        const { html } = fn();
        expect(html).toContain('<body');
        expect(html).toContain('</body>');
      });

      it('subject is a non-empty string', () => {
        const { subject } = fn();
        expect(typeof subject).toBe('string');
        expect(subject.length).toBeGreaterThan(0);
      });

      it('plain text is a non-empty string without HTML tags', () => {
        const { text } = fn();
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
        // Plain text should not contain HTML tags (except possibly entities like --)
        expect(text).not.toContain('</');
        expect(text).not.toMatch(/<[a-z]/i);
      });

      it('HTML includes the ruwt.dev footer', () => {
        const { html } = fn();
        expect(html).toContain('AI-efficiency assessment platform');
      });

      it('plain text includes the ruwt.dev signature', () => {
        const { text } = fn();
        expect(text).toContain('Sent by ruwt.dev');
      });
    });
  }
});
