import { describe, it, expect, vi } from 'vitest';
import { logSecurityEvent } from './security-log';

describe('logSecurityEvent', () => {
  function makeMockDb() {
    const runMock = vi.fn().mockResolvedValue(undefined);
    const bindMock = vi.fn().mockReturnValue({ run: runMock });
    const prepareMock = vi.fn().mockReturnValue({ bind: bindMock });
    return { prepareMock, bindMock, runMock, db: { prepare: prepareMock } as unknown as D1Database };
  }

  it('inserts a security event into error_logs', () => {
    const { db, prepareMock, bindMock } = makeMockDb();

    logSecurityEvent(db, {
      type: 'rate_limit',
      endpoint: '/api/ai/chat',
      method: 'POST',
      ip: '1.2.3.4',
      userId: 'user-123',
      details: 'Rate limit exceeded (retry after 10s)',
    });

    expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO error_logs'));
    expect(bindMock).toHaveBeenCalledWith(
      expect.any(String), // UUID
      '/api/ai/chat',
      'POST',
      'user-123',
      '[rate_limit] Rate limit exceeded (retry after 10s)',
      expect.stringContaining('"securityType":"rate_limit"'),
    );
  });

  it('uses null for userId when not provided', () => {
    const { db, bindMock } = makeMockDb();

    logSecurityEvent(db, {
      type: 'csrf_reject',
      endpoint: '/api/submissions',
      method: 'POST',
      ip: '5.6.7.8',
      details: 'Rejected origin: https://evil.com',
    });

    expect(bindMock).toHaveBeenCalledWith(
      expect.any(String),
      '/api/submissions',
      'POST',
      null, // no userId
      '[csrf_reject] Rejected origin: https://evil.com',
      expect.stringContaining('"ip":"5.6.7.8"'),
    );
  });

  it('uses type as details when details not provided', () => {
    const { db, bindMock } = makeMockDb();

    logSecurityEvent(db, {
      type: 'suspicious',
      endpoint: '/api/ai/chat',
      method: 'POST',
      ip: '10.0.0.1',
    });

    expect(bindMock).toHaveBeenCalledWith(
      expect.any(String),
      '/api/ai/chat',
      'POST',
      null,
      '[suspicious] suspicious',
      expect.any(String),
    );
  });

  it('never throws even when db fails', () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error('DB unavailable')),
        }),
      }),
    } as unknown as D1Database;

    // Should not throw
    expect(() => {
      logSecurityEvent(db, {
        type: 'rate_limit',
        endpoint: '/api/test',
        method: 'GET',
        ip: '0.0.0.0',
      });
    }).not.toThrow();
  });

  it('includes IP in metadata JSON', () => {
    const { db, bindMock } = makeMockDb();

    logSecurityEvent(db, {
      type: 'auth_failure',
      endpoint: '/api/profile',
      method: 'GET',
      ip: '192.168.1.1',
    });

    const metadataArg = bindMock.mock.calls[0][5];
    const parsed = JSON.parse(metadataArg);
    expect(parsed.securityType).toBe('auth_failure');
    expect(parsed.ip).toBe('192.168.1.1');
  });
});
