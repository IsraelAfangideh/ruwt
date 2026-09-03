const KEY = 'ruwt_versus_return';

export function stashVersusReturn(challengeId: string) {
  if (typeof sessionStorage === 'undefined' || !challengeId) return;
  sessionStorage.setItem(KEY, JSON.stringify({ challengeId, playMode: 'versus' }));
}

export function consumeVersusReturn():
  | { name: 'Arena'; params: { challengeId: string; playMode: 'versus' } }
  | null {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);
  try {
    const parsed = JSON.parse(raw) as { challengeId?: string };
    if (parsed.challengeId) {
      return { name: 'Arena', params: { challengeId: parsed.challengeId, playMode: 'versus' } };
    }
  } catch {
    /* ignore bad stash */
  }
  return null;
}
