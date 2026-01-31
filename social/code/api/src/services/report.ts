import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { reports, type NewReport } from '../db/schema';
import { sendEmail } from './email';
import { eq } from 'drizzle-orm';

// Initialize DB
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@127.0.0.1:5432/ruwt';
const client = postgres(connectionString);
const db = drizzle(client, { schema });

export interface ReportData {
  runner: string;
  reason: string;
  details?: string;
  contactEmail?: string | null;
  ipAddress?: string | null;
  messages?: unknown;
  clientMeta?: unknown;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatJsonBlock(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  const json = JSON.stringify(value, null, 2);
  return `<pre style="white-space: pre-wrap; background: #f6f8fa; padding: 12px; border-radius: 6px;">${escapeHtml(json)}</pre>`;
}

/**
 * Save a report to the database
 * This always succeeds if the DB write succeeds
 */
export async function saveReport(data: ReportData): Promise<string> {
  const newReport: NewReport = {
    runner: data.runner,
    reason: data.reason,
    details: data.details || null,
    contactEmail: data.contactEmail || null,
    ipAddress: data.ipAddress || null,
    messages: data.messages ?? null,
    clientMeta: data.clientMeta ?? null,
    notificationSent: false,
    notifiedAt: null,
  };

  const [savedReport] = await db.insert(reports).values(newReport).returning();
  return savedReport.id;
}

/**
 * Attempt to send email notification for a report
 * Updates the report record with notification status
 * Does not throw - email failures are logged but don't fail the request
 */
export async function notifyReport(reportId: string, data: ReportData): Promise<void> {
  try {
    const messagesBlock = formatJsonBlock(data.messages);
    const clientMetaBlock = formatJsonBlock(data.clientMeta);
    const emailHtml = `
      <h2>New Runner Report</h2>
      <p><strong>Runner:</strong> ${escapeHtml(data.runner)}</p>
      <p><strong>Reason:</strong> ${escapeHtml(data.reason)}</p>
      ${data.details ? `<p><strong>Details:</strong> ${escapeHtml(data.details)}</p>` : ''}
      ${data.contactEmail ? `<p><strong>Contact Email:</strong> ${escapeHtml(data.contactEmail)}</p>` : ''}
      ${data.ipAddress ? `<p><strong>IP Address:</strong> ${escapeHtml(data.ipAddress)}</p>` : ''}
      ${data.clientMeta ? `<h3>Client Meta</h3>${clientMetaBlock}` : ''}
      ${data.messages ? `<h3>Messages</h3>${messagesBlock}` : ''}
      <p><strong>Report ID:</strong> ${reportId}</p>
      <p><strong>Submitted at:</strong> ${new Date().toISOString()}</p>
    `;

    await sendEmail({
      to: 'israelafangideh@gmail.com',
      subject: `Runner Report: ${data.runner} - ${data.reason}`,
      html: emailHtml,
    });

    // Mark as notified on success
    await db
      .update(reports)
      .set({
        notificationSent: true,
        notifiedAt: new Date(),
      })
      .where(eq(reports.id, reportId));

    console.log(`Report ${reportId} notification sent successfully`);
  } catch (error) {
    // Log error but don't throw - the report is already saved
    console.error(`Failed to send notification for report ${reportId}:`, error);
    // Report remains in DB with notificationSent = false for future retry
  }
}

/**
 * Submit a report: save to DB first, then attempt email notification
 * Always returns success if DB write succeeds, regardless of email outcome
 */
export async function submitReport(data: ReportData): Promise<void> {
  // Always save to DB first - this is the source of truth
  const reportId = await saveReport(data);

  // Attempt email notification (best-effort, doesn't fail the request)
  await notifyReport(reportId, data);

  // Return success - report is saved even if email failed
}
