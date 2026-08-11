/**
 * Tests for ensureProfile: first signup, existing profile, email sending, edge cases.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so these are available when vi.mock factories are hoisted
const { mockSendEmail, mockWelcomeEmail, mockNewSignupNotificationEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
  mockWelcomeEmail: vi.fn(),
  mockNewSignupNotificationEmail: vi.fn(),
}));

vi.mock('./newsletter/resend', () => ({
  sendEmail: mockSendEmail,
}));

vi.mock('./email/templates', () => ({
  welcomeEmail: mockWelcomeEmail,
  newSignupNotificationEmail: mockNewSignupNotificationEmail,
}));

import { ensureProfile } from './ensure-profile';
import { FIRST_CHALLENGE_ID, FIRST_CHALLENGE_TITLE } from '../../src/shared/lib/first-challenge';
import type { User } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-new-001',
    email: 'newuser@example.com',
    app_metadata: {},
    user_metadata: {
      full_name: 'Jane Doe',
      avatar_url: 'https://avatars.example.com/jane.png',
    },
    aud: 'authenticated',
    created_at: '2026-02-15T12:00:00Z',
    ...overrides,
  } as User;
}

/**
 * Builds a mock db where each call to db.insert() returns a chain that:
 * - tracks values and onConflictDoNothing calls
 * - resolves with { meta: { changes: N } } where N comes from the insertChanges array
 */
function createMockDb(insertChanges: number[] = [1, 1, 1]) {
  let insertIdx = 0;
  const tracked: Array<{ values: any; conflictHandled: boolean; changes: number }> = [];

  const db: any = {
    insert: vi.fn().mockImplementation((_table: any) => {
      const idx = insertIdx++;
      const entry = { values: null as any, conflictHandled: false, changes: insertChanges[idx] ?? 1 };
      tracked.push(entry);

      const chain: Record<string, any> = {};
      chain.values = vi.fn().mockImplementation((vals: any) => {
        entry.values = vals;
        return chain;
      });
      chain.onConflictDoNothing = vi.fn().mockImplementation(() => {
        entry.conflictHandled = true;
        return chain;
      });
      chain.then = (res: any, rej: any) =>
        Promise.resolve({ meta: { changes: entry.changes } }).then(res, rej);
      return chain;
    }),
    _tracked: tracked,
  };

  return db;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ensureProfile', () => {
  const env = { RESEND_API_KEY: 'test-resend-key-123' };

  beforeEach(() => {
    mockSendEmail.mockReset();
    mockWelcomeEmail.mockReset();
    mockNewSignupNotificationEmail.mockReset();
    mockSendEmail.mockResolvedValue({ success: true, id: 'email-123' });
    mockWelcomeEmail.mockReturnValue({
      subject: 'Welcome to ruwt.dev!',
      html: '<h1>Welcome</h1>',
      text: 'Welcome to ruwt.dev',
    });
    mockNewSignupNotificationEmail.mockReturnValue({
      subject: 'New signup: Jane Doe just joined ruwt.dev',
      html: '<h1>New signup</h1>',
      text: 'New signup notification',
    });
  });

  it('creates profile with 50k credits for new signup', async () => {
    const db = createMockDb([1, 1, 1]);
    const user = createMockUser();

    await ensureProfile(db, user, env);

    const profileInsert = db._tracked[0];
    expect(profileInsert.values.id).toBe('user-new-001');
    expect(profileInsert.values.email).toBe('newuser@example.com');
    expect(profileInsert.values.name).toBe('Jane Doe');
    expect(profileInsert.values.credits).toBe(50000);
    expect(profileInsert.values.avatarUrl).toBe('https://avatars.example.com/jane.png');
  });

  it('records signup_bonus transaction for new profile', async () => {
    const db = createMockDb([1, 1, 1]);
    const user = createMockUser();

    await ensureProfile(db, user, env);

    // Second insert is the transaction
    const txInsert = db._tracked[1];
    expect(txInsert.values.type).toBe('signup_bonus');
    expect(txInsert.values.amount).toBe(50000);
    expect(txInsert.values.userId).toBe('user-new-001');
  });

  it('creates welcome notification for new signup', async () => {
    const db = createMockDb([1, 1, 1]);
    const user = createMockUser();

    await ensureProfile(db, user, env);

    // Third insert is the notification
    const notifInsert = db._tracked[2];
    expect(notifInsert.values.type).toBe('new_challenge');
    expect(notifInsert.values.title).toBe('Welcome to ruwt.dev!');
    expect(notifInsert.values.userId).toBe('user-new-001');
    // Must point at the shared constant. Routing every new signup to a
    // challenge nobody finishes is the mistake this replaced.
    expect(JSON.parse(notifInsert.values.metadata).challengeId).toBe(FIRST_CHALLENGE_ID);
    expect(notifInsert.values.body).toContain(FIRST_CHALLENGE_TITLE);
  });

  it('sends welcome email for new signup with RESEND_API_KEY', async () => {
    const db = createMockDb([1, 1, 1]);
    const user = createMockUser();

    await ensureProfile(db, user, env);

    // Allow fire-and-forget to settle
    await vi.waitFor(() => {
      expect(mockWelcomeEmail).toHaveBeenCalledWith({ name: 'Jane' });
      expect(mockSendEmail).toHaveBeenCalledWith(
        env,
        expect.objectContaining({
          to: 'newuser@example.com',
          subject: 'Welcome to ruwt.dev!',
          html: '<h1>Welcome</h1>',
          text: 'Welcome to ruwt.dev',
        }),
      );
    });
  });

  it('skips everything for existing profile (meta.changes = 0)', async () => {
    const db = createMockDb([0]); // conflict -- row already exists
    const user = createMockUser();

    await ensureProfile(db, user, env);

    // Only the profile insert attempt, no transaction or notification
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockWelcomeEmail).not.toHaveBeenCalled();
    expect(mockNewSignupNotificationEmail).not.toHaveBeenCalled();
  });

  it('sends admin notification email for new signup', async () => {
    const db = createMockDb([1, 1, 1]);
    const user = createMockUser();

    await ensureProfile(db, user, env);

    await vi.waitFor(() => {
      expect(mockNewSignupNotificationEmail).toHaveBeenCalledWith({
        userName: 'Jane Doe',
        userEmail: 'newuser@example.com',
        provider: 'email',
      });
      expect(mockSendEmail).toHaveBeenCalledWith(
        env,
        expect.objectContaining({
          to: 'israel@ruwt.dev',
          subject: 'New signup: Jane Doe just joined ruwt.dev',
        }),
      );
    });
  });

  it('sends admin notification with github provider from app_metadata', async () => {
    const db = createMockDb([1, 1, 1]);
    const user = createMockUser({
      app_metadata: { provider: 'github' },
    });

    await ensureProfile(db, user, env);

    await vi.waitFor(() => {
      expect(mockNewSignupNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'github' }),
      );
    });
  });

  it('sends admin notification even when user has no email (still notifies admin)', async () => {
    const db = createMockDb([1, 1, 1]);
    const user = createMockUser({ email: undefined });

    await ensureProfile(db, user, env);

    // Welcome email should NOT be sent (no user email)
    // But admin notification should still be sent
    await vi.waitFor(() => {
      expect(mockNewSignupNotificationEmail).toHaveBeenCalled();
      expect(mockSendEmail).toHaveBeenCalledWith(
        env,
        expect.objectContaining({
          to: 'israel@ruwt.dev',
        }),
      );
    });
  });

  it('handles missing email in user metadata gracefully', async () => {
    const db = createMockDb([1, 1, 1]);
    const user = createMockUser({ email: undefined });

    await ensureProfile(db, user, env);

    // Profile should be created with empty string email
    const profileInsert = db._tracked[0];
    expect(profileInsert.values.email).toBe('');
    // Welcome email should NOT be sent (no email address), but admin notif is
    expect(mockSendEmail).not.toHaveBeenCalledWith(
      env,
      expect.objectContaining({ to: '' }),
    );
  });

  it('handles missing name in user metadata', async () => {
    const db = createMockDb([1, 1, 1]);
    const user = createMockUser({
      user_metadata: { avatar_url: 'https://example.com/avatar.png' },
    });

    await ensureProfile(db, user, env);

    const profileInsert = db._tracked[0];
    expect(profileInsert.values.name).toBeNull();
    // Welcome email should use null for name
    expect(mockWelcomeEmail).toHaveBeenCalledWith({ name: null });
  });

  it('uses user_metadata.name as fallback when full_name is missing', async () => {
    const db = createMockDb([1, 1, 1]);
    const user = createMockUser({
      user_metadata: { name: 'GitHub Username', avatar_url: null },
    });

    await ensureProfile(db, user, env);

    const profileInsert = db._tracked[0];
    expect(profileInsert.values.name).toBe('GitHub Username');
    // First name for email = split on space
    expect(mockWelcomeEmail).toHaveBeenCalledWith({ name: 'GitHub' });
  });

  it('does not send email when RESEND_API_KEY is missing', async () => {
    const db = createMockDb([1, 1, 1]);
    const user = createMockUser();

    await ensureProfile(db, user, {}); // no RESEND_API_KEY

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('does not send email when env is undefined', async () => {
    const db = createMockDb([1, 1, 1]);
    const user = createMockUser();

    await ensureProfile(db, user); // env omitted

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('email failure does not block the function (fire-and-forget)', async () => {
    const db = createMockDb([1, 1, 1]);
    const user = createMockUser();

    // Simulate email failure
    mockSendEmail.mockRejectedValue(new Error('Resend API down'));

    // Should NOT throw
    await expect(ensureProfile(db, user, env)).resolves.toBeUndefined();
  });

  it('uses onConflictDoNothing for the profile insert', async () => {
    const db = createMockDb([1, 1, 1]);
    const user = createMockUser();

    await ensureProfile(db, user, env);

    // The profile insert should have called onConflictDoNothing
    const profileInsert = db._tracked[0];
    expect(profileInsert.conflictHandled).toBe(true);
  });

  it('notification insert uses onConflictDoNothing', async () => {
    const db = createMockDb([1, 1, 1]);
    const user = createMockUser();

    await ensureProfile(db, user, env);

    // The notification (3rd insert) should also use onConflictDoNothing
    const notifInsert = db._tracked[2];
    expect(notifInsert.conflictHandled).toBe(true);
  });
});
