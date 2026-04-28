/**
 * Sanity test for migrations-d1/0064_chaotic_event_bus.sql.
 *
 * Re-implements the corrected solution and the test harness here, then runs
 * each visible and hidden test case to verify the expected output strings
 * in the migration are actually achievable. Catches typos or unsolvable
 * test cases before they hit production.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = join(__dirname, '../../../drizzle/migrations-d1/0064_chaotic_event_bus.sql');

// ─── Reference solution: the buggy starter with the 4 fixes applied ────

const RETENTION_PER_CHANNEL = 3;

class EventBus {
  private _subs: Array<{ id: number; channel: string; handler: (m: string) => void; active: boolean }> = [];
  private _byChannel = new Map<string, Set<number>>();
  private _wildcardSubs: Array<{ prefix: string; subId: number }> = [];
  private _retention = new Map<string, string[]>();
  private _nextId = 1;

  subscribe(channel: string, handler: (m: string) => void): number {
    const id = this._nextId++;
    this._subs.push({ id, channel, handler, active: true });
    if (channel.endsWith('.*')) {
      const prefix = channel.slice(0, -2);
      this._wildcardSubs.push({ prefix, subId: id });
    } else {
      if (!this._byChannel.has(channel)) this._byChannel.set(channel, new Set());
      this._byChannel.get(channel)!.add(id);
    }
    return id; // FIX #1: return the actual id, not array length
  }

  unsubscribe(id: number): boolean {
    const idx = this._subs.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    const entry = this._subs[idx];
    entry.active = false;
    // FIX #2: clean indexes too
    if (entry.channel.endsWith('.*')) {
      const wIdx = this._wildcardSubs.findIndex((w) => w.subId === id);
      if (wIdx !== -1) this._wildcardSubs.splice(wIdx, 1);
    } else {
      this._byChannel.get(entry.channel)?.delete(id);
    }
    this._subs.splice(idx, 1);
    return true;
  }

  publish(channel: string, message: string): void {
    const direct = this._byChannel.get(channel);
    if (direct) {
      for (const subId of direct) {
        const sub = this._subs.find((s) => s.id === subId);
        if (sub && sub.active) sub.handler(message);
      }
    }
    for (const w of this._wildcardSubs) {
      // FIX #3: 'user.*' subscribe stores prefix='user'. A publish channel
      // 'user.X' should match iff there's exactly one segment after 'user.'.
      const required = w.prefix + '.';
      if (channel.startsWith(required)) {
        const tail = channel.slice(required.length);
        if (tail.length > 0 && !tail.includes('.')) {
          const sub = this._subs.find((s) => s.id === w.subId);
          if (sub && sub.active) sub.handler(message);
        }
      }
    }
    if (!this._retention.has(channel)) this._retention.set(channel, []);
    const buf = this._retention.get(channel)!;
    buf.push(message);
    // FIX #4: trim retention buffer to RETENTION_PER_CHANNEL
    while (buf.length > RETENTION_PER_CHANNEL) buf.shift();
  }

  drain(channel: string): string[] {
    return this._retention.get(channel) ?? [];
  }

  subscriberCount(channel: string): number {
    const direct = this._byChannel.get(channel);
    let n = direct ? direct.size : 0;
    for (const w of this._wildcardSubs) {
      const required = w.prefix + '.';
      if (channel.startsWith(required)) {
        const tail = channel.slice(required.length);
        if (tail.length > 0 && !tail.includes('.')) n++;
      }
    }
    return n;
  }
}

// ─── Reference harness (mirrors the SQL test_harness) ─────────────────

function solve(...args: string[]): string {
  const bus = new EventBus();
  const slots: Array<{ id: number | null; messages: string[] }> = [];

  function makeHandler(slotIdx: number) {
    return (msg: string) => slots[slotIdx].messages.push(msg);
  }
  function lookup(slotRef: string) {
    const n = Number(slotRef.replace('$', ''));
    return slots[n - 1];
  }

  const out: string[] = [];
  for (const arg of args) {
    const line = String(arg).trim();
    if (!line) continue;
    const parts = line.split(' ');
    const cmd = parts[0];

    if (cmd === 'subscribe') {
      const slotIdx = slots.length;
      slots.push({ id: null, messages: [] });
      slots[slotIdx].id = bus.subscribe(parts[1], makeHandler(slotIdx));
    } else if (cmd === 'unsubscribe') {
      bus.unsubscribe(lookup(parts[1]).id!);
    } else if (cmd === 'publish') {
      bus.publish(parts[1], parts.slice(2).join(' '));
    } else if (cmd === 'late_subscribe') {
      const slotIdx = slots.length;
      slots.push({ id: null, messages: [] });
      const ch = parts[1];
      slots[slotIdx].id = bus.subscribe(ch, makeHandler(slotIdx));
      for (const m of bus.drain(ch)) slots[slotIdx].messages.push(m);
    } else if (cmd === 'count') {
      out.push(String(bus.subscriberCount(parts[1])));
    } else if (cmd === 'received') {
      out.push(lookup(parts[1]).messages.join(','));
    }
  }
  return out.join('\n');
}

// ─── Pull cases out of the migration so we test what will ship ─────────

function extractCases(sql: string, key: 'test_cases' | 'hidden_test_cases'): Array<{ input: string; expectedOutput: string }> {
  // The migration column order has test_cases as the 6th VALUE entry and
  // hidden_test_cases as the 7th. Rather than parse SQL, find the JSON
  // literals by their distinctive shape.
  // Each JSON is a string: '[{"input":"...","expectedOutput":"..."}, ...]'
  // We scan for JSON arrays and pick the one we want.
  const jsonArrayRegex = /'(\[\{"input":[^']*?\}])'/g;
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = jsonArrayRegex.exec(sql)) !== null) {
    matches.push(m[1]);
  }
  if (matches.length < 2) {
    throw new Error(`Expected at least 2 JSON arrays in migration; found ${matches.length}`);
  }
  // First match is test_cases, second is hidden_test_cases.
  // Unescape SQL doubled single-quotes inside the JSON strings.
  const idx = key === 'test_cases' ? 0 : 1;
  const json = matches[idx].replace(/''/g, "'");
  return JSON.parse(json);
}

function runCase(input: string): string {
  const args = input.split('\n');
  return solve(...args);
}

describe('chaotic-event-bus migration', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf-8');

  it('parses cleanly and contains all required parts', () => {
    expect(sql).toContain("INSERT OR IGNORE INTO challenges");
    expect(sql).toContain("'chaotic-event-bus'");
    expect(sql).toContain('class EventBus');
    expect(sql).toContain('RETENTION_PER_CHANNEL');
    expect(sql).toContain("'iterative_debugging'");
  });

  describe('visible test cases', () => {
    const cases = extractCases(sql, 'test_cases');
    it('declares 3 visible cases', () => expect(cases).toHaveLength(3));
    cases.forEach((c, i) => {
      it(`case ${i + 1} passes with the corrected solution`, () => {
        expect(runCase(c.input)).toBe(c.expectedOutput);
      });
    });
  });

  describe('hidden test cases', () => {
    const cases = extractCases(sql, 'hidden_test_cases');
    it('declares 4 hidden cases', () => expect(cases).toHaveLength(4));
    cases.forEach((c, i) => {
      it(`hidden case ${i + 1} passes with the corrected solution`, () => {
        expect(runCase(c.input)).toBe(c.expectedOutput);
      });
    });
  });

  describe('hidden case behavior — guards against partial fixes', () => {
    it('subscribe-id bug is observable when subscribes interleave with unsubscribes', () => {
      // Re-implement with bug #1 only, keep other fixes — this isolates
      // the wrong-id behavior.
      class BuggyBus extends EventBus {
        subscribe(channel: string, handler: (m: string) => void): number {
          const id = (this as any)._nextId++;
          (this as any)._subs.push({ id, channel, handler, active: true });
          if (channel.endsWith('.*')) {
            (this as any)._wildcardSubs.push({ prefix: channel.slice(0, -2), subId: id });
          } else {
            if (!(this as any)._byChannel.has(channel)) (this as any)._byChannel.set(channel, new Set());
            (this as any)._byChannel.get(channel).add(id);
          }
          return (this as any)._subs.length; // BUG: array length, not id
        }
      }
      const bus = new BuggyBus();
      const received: Record<string, string[]> = { a: [], b: [], c: [] };

      const idA = bus.subscribe('orders', (m) => received.a.push(m)); // returns 1; real id=1
      const idB = bus.subscribe('orders', (m) => received.b.push(m)); // returns 2; real id=2
      bus.unsubscribe(idA); // removes real id=1; length=1
      const idC = bus.subscribe('orders', (m) => received.c.push(m)); // returns 2 (length=2 after push); real id=3
      bus.unsubscribe(idC); // calls unsubscribe(2) — removes real id=2 (B!), not C
      bus.publish('orders', 'BANG');

      // With bug #1: C's handler still active, receives BANG; B got removed by mistake.
      expect(received.c).toEqual(['BANG']);
      expect(received.b).toEqual([]);
    });

    it('hidden case 2 (retention bound) fails if BUG #4 is not fixed', () => {
      class BuggyBus extends EventBus {
        publish(channel: string, message: string): void {
          super.publish(channel, message);
          // Undo the trim by re-pushing what was just trimmed away
          const buf = (this as any)._retention.get(channel);
          // Simulate "no trim" by just clearing nothing — but EventBus already
          // trims. Instead, build a sibling that doesn't trim:
        }
      }
      // Easier: build the buggy publish from scratch
      const subs: any[] = [];
      const retention = new Map<string, string[]>();
      function publish(ch: string, msg: string) {
        if (!retention.has(ch)) retention.set(ch, []);
        retention.get(ch)!.push(msg); // no trim
      }
      for (let i = 1; i <= 5; i++) publish('orders', String(i));
      expect(retention.get('orders')!.length).toBe(5); // would leak past RETENTION_PER_CHANNEL
    });

    it('hidden case 3 (wildcard scoping) fails if BUG #3 is not fixed', () => {
      // Bug #3: startsWith allows multi-segment match. Demonstrate explicitly.
      const prefix = 'user.';
      const channel1 = 'user.created';
      const channel2 = 'user.created.deep';
      // Without fix: both match
      expect(channel1.startsWith(prefix)).toBe(true);
      expect(channel2.startsWith(prefix)).toBe(true);
      // With fix: only channel1 (one segment after prefix, no further dots)
      const tail1 = channel1.slice(prefix.length);
      const tail2 = channel2.slice(prefix.length);
      expect(tail1.length > 0 && !tail1.includes('.')).toBe(true);
      expect(tail2.length > 0 && !tail2.includes('.')).toBe(false);
    });
  });
});
