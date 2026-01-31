import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { anonymousUsers, type NewAnonymousUser } from '../db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from './email';

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@127.0.0.1:5432/ruwt';
const client = postgres(connectionString);
const db = drizzle(client, { schema });

export interface AnonymousUserData {
  anonymousUserId: string;
  runnerName?: string;
  ipAddress?: string | null;
  clientMeta?: {
    platform?: string;
    appVersion?: string;
    locale?: string;
    timezone?: string;
    userAgent?: string;
  } | null;
  userAgent?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function trackAnonymousUser(data: AnonymousUserData): Promise<void> {
  if (!data.anonymousUserId) {
    return;
  }

  const existing = await db.query.anonymousUsers.findFirst({
    where: eq(schema.anonymousUsers.anonymousUserId, data.anonymousUserId),
  });

  if (existing) {
    await db
      .update(anonymousUsers)
      .set({ lastSeenAt: new Date() })
      .where(eq(anonymousUsers.anonymousUserId, data.anonymousUserId));
    return;
  }

  const newUser: NewAnonymousUser = {
    anonymousUserId: data.anonymousUserId,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    firstRunnerName: data.runnerName || null,
    firstIpAddress: data.ipAddress || null,
    firstUserAgent: data.userAgent || data.clientMeta?.userAgent || null,
    platform: data.clientMeta?.platform || null,
    appVersion: data.clientMeta?.appVersion || null,
    locale: data.clientMeta?.locale || null,
    timezone: data.clientMeta?.timezone || null,
  };

  await db.insert(anonymousUsers).values(newUser);

  const emailHtml = `
    <h2>New Ruwt User</h2>
    <p><strong>Anonymous User ID:</strong> ${escapeHtml(data.anonymousUserId)}</p>
    ${data.runnerName ? `<p><strong>Runner:</strong> ${escapeHtml(data.runnerName)}</p>` : ''}
    ${data.ipAddress ? `<p><strong>IP Address:</strong> ${escapeHtml(data.ipAddress)}</p>` : ''}
    ${(data.userAgent || data.clientMeta?.userAgent) ? `<p><strong>User Agent:</strong> ${escapeHtml(data.userAgent || data.clientMeta?.userAgent || '')}</p>` : ''}
    ${data.clientMeta?.platform ? `<p><strong>Platform:</strong> ${escapeHtml(data.clientMeta.platform)}</p>` : ''}
    ${data.clientMeta?.appVersion ? `<p><strong>App Version:</strong> ${escapeHtml(data.clientMeta.appVersion)}</p>` : ''}
    ${data.clientMeta?.locale ? `<p><strong>Locale:</strong> ${escapeHtml(data.clientMeta.locale)}</p>` : ''}
    ${data.clientMeta?.timezone ? `<p><strong>Timezone:</strong> ${escapeHtml(data.clientMeta.timezone)}</p>` : ''}
    <p><strong>First Seen:</strong> ${new Date().toISOString()}</p>
  `;

  try {
    await sendEmail({
      to: 'israelafangideh@gmail.com',
      subject: 'New user first message',
      html: emailHtml,
    });
  } catch (error) {
    console.error('Failed to send new user email:', error);
  }
}
