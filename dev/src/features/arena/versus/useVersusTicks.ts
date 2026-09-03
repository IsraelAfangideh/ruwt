import { useEffect, useRef } from 'react';
import type { VersusMatchPublic } from './types';

interface VersusSseEvent {
  type: 'thinking' | 'chunk' | 'status' | 'done' | 'error';
  content?: string;
  status?: string;
  teaser?: string;
  match?: VersusMatchPublic;
  continue?: boolean;
  error?: string;
}

async function readSseDone(res: Response, onEvent: (event: VersusSseEvent) => void): Promise<VersusSseEvent | null> {
  const reader = res.body?.getReader();
  if (!reader) {
    const json = await res.json().catch(() => null);
    return json;
  }
  const decoder = new TextDecoder();
  let buffer = '';
  let lastDone: VersusSseEvent | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';
    for (const line of parts) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6)) as VersusSseEvent;
        onEvent(event);
        if (event.type === 'done') lastDone = event;
      } catch {
        /* skip */
      }
    }
  }
  return lastDone;
}

export function useVersusTicks(
  matchId: string | null,
  winner: string | null | undefined,
  onMatch: (match: VersusMatchPublic) => void,
) {
  const onMatchRef = useRef(onMatch);
  onMatchRef.current = onMatch;
  const runningRef = useRef(false);

  useEffect(() => {
    if (!matchId || winner || runningRef.current) return;
    let cancelled = false;
    runningRef.current = true;

    const applyMatch = (m: VersusMatchPublic) => {
      if (!cancelled) onMatchRef.current(m);
    };

    (async () => {
      try {
        let keepGoing = true;
        while (keepGoing && !cancelled) {
          const res = await fetch(`/api/versus/matches/${matchId}/events`, { method: 'POST' });
          if (!res.ok) {
            const snap = await fetch(`/api/versus/matches/${matchId}`);
            if (snap.ok) {
              const data = await snap.json();
              if (data.match) applyMatch(data.match);
            }
            break;
          }
          const done = await readSseDone(res, (event) => {
            if (event.type === 'done' && event.match) applyMatch(event.match);
            if (event.type === 'status' && event.teaser) {
              /* status-only updates wait for done snapshot */
            }
          });
          if (done?.match) applyMatch(done.match);
          keepGoing = !!done?.continue && !done.match?.winner;
        }
      } finally {
        runningRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      runningRef.current = false;
    };
  }, [matchId, winner]);
}
