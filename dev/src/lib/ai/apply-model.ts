/**
 * Client-side caller for the apply model endpoint.
 * When structured edit parsing fails, this calls a code-specialized model
 * to merge the AI's intended changes into the current code.
 *
 * The server runs verification after the merge. If verification fails
 * (corruption detected), success=false and verificationErrors describes
 * what went wrong.
 */

interface ApplyModelOptions {
  attemptId: string;
  currentCode: string;
  aiResponse: string;
  language: string;
  challengeId?: string;
  challengeTitle?: string;
}

interface ApplyModelResult {
  success: boolean;
  mergedCode?: string;
  cost?: number;
  model?: string;
  error?: string;
  /** False if the server detected the apply model corrupted the code. */
  verified?: boolean;
  /** Specific corruption errors detected by verification. */
  verificationErrors?: string[];
}

export async function callApplyModel(opts: ApplyModelOptions): Promise<ApplyModelResult> {
  try {
    const response = await fetch('/api/ai/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(opts),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        success: false,
        error: (data as Record<string, string>).error || `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      mergedCode: string | null;
      verified: boolean;
      verificationErrors: string[];
      model: string;
      inputTokens: number;
      outputTokens: number;
      cost: number;
    };

    // Verification failed — server detected corruption
    if (!data.verified) {
      return {
        success: false,
        verified: false,
        verificationErrors: data.verificationErrors,
        cost: data.cost,
        model: data.model,
        error: 'Apply model produced corrupted output',
      };
    }

    // Sanity check: reject empty or tiny results
    if (!data.mergedCode || data.mergedCode.trim().length < 10) {
      return { success: false, error: 'Apply model returned empty result' };
    }

    return {
      success: true,
      verified: true,
      mergedCode: data.mergedCode,
      cost: data.cost,
      model: data.model,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}
