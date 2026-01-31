import { API_URL } from '../config';
import { mockFetch } from './mockApi';

export interface ReportData {
  runner: string;
  reason: string;
  details: string;
  contactEmail?: string;
  messages?: unknown;
  clientMeta?: unknown;
}

export async function submitReport(data: ReportData): Promise<void> {
  try {
    const response = await mockFetch(`${API_URL}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to submit report' }));
      throw new Error(error.error || 'Failed to submit report');
    }
  } catch (error) {
    console.error('Error submitting report:', error);
    throw error;
  }
}

