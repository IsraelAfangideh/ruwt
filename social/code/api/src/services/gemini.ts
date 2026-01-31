type UnknownError = unknown;

function normalizeModelName(model: string): string {
  const trimmed = model.trim();
  // The Node SDK expects names like "gemini-1.5-flash" (no "models/" prefix).
  return trimmed.startsWith('models/') ? trimmed.slice('models/'.length) : trimmed;
}

export function getGeminiModelCandidates(): string[] {
  const raw =
    process.env.GOOGLE_GENERATIVE_AI_MODEL ||
    process.env.GEMINI_MODEL ||
    process.env.GOOGLE_MODEL;

  if (raw && raw.trim()) {
    return raw
      .split(',')
      .map(normalizeModelName)
      .filter(Boolean);
  }

  // Safe defaults for generateContent on v1beta.
  return ['gemini-1.5-flash', 'gemini-1.5-pro'];
}

export function isGeminiModelNotFoundError(err: UnknownError): boolean {
  if (!err || typeof err !== 'object') return false;

  const anyErr = err as any;
  const status = anyErr?.status;
  const message = String(anyErr?.message || '');

  // @google/generative-ai throws GoogleGenerativeAIFetchError with `status`.
  if (status === 404) return true;

  // Defensive fallback if the SDK shape changes.
  return (
    message.includes('is not found for API version') ||
    message.includes('not supported for generateContent') ||
    message.includes('models/') && message.includes('is not found')
  );
}

