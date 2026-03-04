import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn().mockResolvedValue({ success: true, id: 'r-1' }),
}));

vi.mock('./newsletter/resend', () => ({ sendEmail: mockSendEmail }));

import { sendMilestoneEmail } from './milestone-email';

function makeDb(allResults: any[][]) {
  let callIndex = 0;
  return {
    all: vi.fn(async () => allResults[callIndex++] ?? []),
    run: vi.fn().mockResolvedValue({}),
  };
}

const mockEnv = { RESEND_API_KEY: 'test' } as unknown as Env;
const mockUser = { id: 'u-1', email: 'alice@test.com', name: 'Alice Smith' };

describe('sendMilestoneEmail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSendEmail.mockResolvedValue({ success: true, id: 'r-1' });
  });

  it('sends first_solve celebration email', async () => {
    const db = makeDb([[{ cnt: 0 }]]);
    await sendMilestoneEmail(db, mockEnv, mockUser, ['first_solve'], {});

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const args = mockSendEmail.mock.calls[0][1];
    expect(args.subject).toBe('first solve');
    expect(args.text).toContain('Alice');
    expect(args.text).toContain('first challenge solved');
  });

  it('picks highest priority badge when multiple awarded', async () => {
    const db = makeDb([[{ cnt: 0 }]]);
    await sendMilestoneEmail(db, mockEnv, mockUser, ['first_solve', 'streak_3', 'ten_solves'], {});

    const args = mockSendEmail.mock.calls[0][1];
    // ten_solves is higher priority than streak_3 and first_solve
    expect(args.subject).toBe('10 solves');
  });

  it('skips if badge was already emailed (dedup)', async () => {
    const db = makeDb([[{ cnt: 1 }]]); // already sent
    await sendMilestoneEmail(db, mockEnv, mockUser, ['first_solve'], {});
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('handles user with no name', async () => {
    const db = makeDb([[{ cnt: 0 }]]);
    await sendMilestoneEmail(db, mockEnv, { ...mockUser, name: null }, ['first_solve'], {});

    const args = mockSendEmail.mock.calls[0][1];
    expect(args.text).not.toContain('null');
    expect(args.text).toMatch(/^you did it/);
  });

  it('includes rank info for ten_solves when available', async () => {
    const db = makeDb([[{ cnt: 0 }]]);
    await sendMilestoneEmail(db, mockEnv, mockUser, ['ten_solves'], { rank: 5, totalRanked: 20 });

    const args = mockSendEmail.mock.calls[0][1];
    expect(args.text).toContain('#5 of 20');
  });

  it('logs send result to newsletter_logs', async () => {
    const db = makeDb([[{ cnt: 0 }]]);
    await sendMilestoneEmail(db, mockEnv, mockUser, ['first_solve'], {});

    expect(db.run).toHaveBeenCalled();
  });

  it('does nothing for unknown badge types', async () => {
    const db = makeDb([]);
    await sendMilestoneEmail(db, mockEnv, mockUser, ['unknown_badge_type'], {});
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('sends streak milestone emails', async () => {
    const db = makeDb([[{ cnt: 0 }]]);
    await sendMilestoneEmail(db, mockEnv, mockUser, ['streak_7'], {});

    const args = mockSendEmail.mock.calls[0][1];
    expect(args.subject).toBe('7-day streak');
    expect(args.text).toContain('7 days straight');
  });
});
