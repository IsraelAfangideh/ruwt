/** Default ingestion endpoint for the ruwt.ai agent observation platform. */
export const DEFAULT_INGESTION_URL = 'https://ruwt.ai/api/intelligence/events';

/** Pages fallback while the custom domain is being configured. */
export const FALLBACK_INGESTION_URL = 'https://ruwt-ai.pages.dev/api/intelligence/events';

export function resolveIngestionUrl(override?: string): string {
  if (override?.trim()) return override.trim();
  if (process.env.RUWT_INGESTION_URL?.trim()) return process.env.RUWT_INGESTION_URL.trim();
  return DEFAULT_INGESTION_URL;
}
