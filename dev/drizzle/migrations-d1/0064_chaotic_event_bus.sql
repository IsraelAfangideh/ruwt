-- chaotic-event-bus: AI-resistant chaotic-codebase challenge.
--
-- Single-file (until the IDE supports true multi-file challenges) but
-- intentionally larger and more entangled than typical challenges. Mixes
-- three subsystems (subscriber registry, retention buffer, wildcard router)
-- in one file with realistic legacy code-smells. Four bugs that span the
-- subsystems — fixing only the obvious ones leaves tests failing.

INSERT OR IGNORE INTO challenges (
  id, title, description, difficulty, starter_code, test_cases, hidden_test_cases,
  test_harness, exec_time_limit, exec_memory_limit, max_tokens, max_cost,
  wall_clock_limit, category, skill_tested, sort_order, tier, language, tags
) VALUES (
  'chaotic-event-bus',
  'Chaotic Legacy: Event Bus',
  'A 2019-era in-process pub/sub bus from a now-defunct microservice. Three customers report memory bloat under load, one reports duplicate messages after reconnection, one complains that ''user.*'' subscriptions match too aggressively.

Four real bugs hide in this code, spread across the subscriber registry, retention buffer, and wildcard router. Fix all four without breaking existing behavior. The code is intentionally ugly — variable names are inconsistent, there are dead branches, and the subsystems are not cleanly separated. That is the point: most production code looks like this.

The bus must support:
- subscribe(channel, handler) → returns the subscription id (used by unsubscribe)
- unsubscribe(id) → handler stops receiving immediately and is fully removed from internal indexes
- publish(channel, message) → all active subscribers (including wildcard matches) receive
- Wildcard: ''user.*'' matches exactly one trailing segment (''user.created'' yes, ''user.created.foo'' no)
- Retention buffer keeps the most recent RETENTION_PER_CHANNEL messages per channel; bus.drain returns those messages and nothing older
- subscriberCount(channel) → number of active subscribers that would receive a publish on that channel

Input format: one operation per line.
- ''subscribe <channel>''
- ''unsubscribe $N'' (where $N is the Nth subscribe in this scenario)
- ''publish <channel> <message>''
- ''late_subscribe <channel>'' (subscribes and immediately drains retention)
- ''count <channel>'' → outputs the subscriber count
- ''received $N'' → outputs the comma-joined messages received by the Nth subscriber

Output: one line per operation that produces output.',
  'hard',
  '// === EventBus — legacy code, do not "refactor" it cosmetically ===
// Subsystems intermingled below: subscriber registry, retention buffer,
// wildcard router. Bugs span more than one of them.

const RETENTION_PER_CHANNEL = 3;

class EventBus {
  constructor() {
    this._subs = []; // [{id, channel, handler, active}]
    this._byChannel = new Map(); // channel -> Set<subId>
    this._wildcardSubs = []; // [{prefix, subId}]
    this._retention = new Map(); // channel -> [messages]
    this._nextId = 1;
  }

  subscribe(channel, handler) {
    const id = this._nextId++;
    const entry = { id, channel, handler, active: true };
    this._subs.push(entry);

    if (channel.endsWith(''.*'')) {
      const prefix = channel.slice(0, -2);
      this._wildcardSubs.push({ prefix, subId: id });
    } else {
      if (!this._byChannel.has(channel)) this._byChannel.set(channel, new Set());
      this._byChannel.get(channel).add(id);
    }

    // BUG #1: returns the array length, not the actual id. After any
    // unsubscribe the length resets and a future subscribe returns a value
    // that collides with an earlier still-active id.
    return this._subs.length;
  }

  unsubscribe(id) {
    const idx = this._subs.findIndex(s => s.id === id);
    if (idx === -1) return false;
    const entry = this._subs[idx];
    entry.active = false;
    // BUG #2: we splice the registry but never remove from _byChannel
    // (and _wildcardSubs). subscriberCount stays inflated; future publish
    // calls still spend cycles searching the dead id.
    this._subs.splice(idx, 1);
    return true;
  }

  publish(channel, message) {
    // Direct match
    const direct = this._byChannel.get(channel);
    if (direct) {
      for (const subId of direct) {
        const sub = this._subs.find(s => s.id === subId);
        if (sub && sub.active) sub.handler(message);
      }
    }

    // Wildcard match
    for (const w of this._wildcardSubs) {
      // BUG #3: startsWith allows "user.*" to match "user.created.foo".
      // Wildcard should require exactly one trailing segment.
      if (channel.startsWith(w.prefix)) {
        const sub = this._subs.find(s => s.id === w.subId);
        if (sub && sub.active) sub.handler(message);
      }
    }

    // Retention buffer
    if (!this._retention.has(channel)) this._retention.set(channel, []);
    const buf = this._retention.get(channel);
    buf.push(message);
    // BUG #4: never trimmed — buffer grows unbounded and drain returns
    // more than RETENTION_PER_CHANNEL messages.
  }

  drain(channel) {
    return this._retention.get(channel) ?? [];
  }

  subscriberCount(channel) {
    const direct = this._byChannel.get(channel);
    let n = direct ? direct.size : 0;
    for (const w of this._wildcardSubs) {
      if (channel.startsWith(w.prefix)) n++;
    }
    return n;
  }
}

module.exports = { EventBus, RETENTION_PER_CHANNEL };',
  '[{"input":"subscribe orders\npublish orders hello\nreceived $1","expectedOutput":"hello"},{"input":"subscribe orders\nunsubscribe $1\npublish orders hidden\ncount orders","expectedOutput":"0"},{"input":"subscribe user.*\npublish user.created alice\npublish user.created.special bob\nreceived $1","expectedOutput":"alice"}]',
  '[{"input":"subscribe orders\nsubscribe orders\nsubscribe orders\nunsubscribe $1\nunsubscribe $2\nunsubscribe $3\ncount orders","expectedOutput":"0"},{"input":"publish orders 1\npublish orders 2\npublish orders 3\npublish orders 4\npublish orders 5\nlate_subscribe orders\nreceived $1","expectedOutput":"3,4,5"},{"input":"subscribe orders\nsubscribe user.*\npublish orders only-direct\npublish user.created u1\npublish user.created.deep deep\nreceived $1\nreceived $2","expectedOutput":"only-direct\nu1"},{"input":"subscribe orders\nsubscribe orders\nunsubscribe $1\nsubscribe orders\nunsubscribe $3\npublish orders BANG\nreceived $3","expectedOutput":""}]',
  'function solve(...args) {
  const bus = new EventBus();
  const slots = []; // slots[i] = { id, messages }

  function makeHandler(slotIdx) {
    return (msg) => slots[slotIdx].messages.push(msg);
  }

  function lookup(slotRef) {
    const n = Number(String(slotRef).replace(''$'', ''''));
    return slots[n - 1];
  }

  const out = [];
  for (let i = 0; i < args.length; i++) {
    const line = String(args[i]).trim();
    if (!line) continue;
    const parts = line.split('' '');
    const cmd = parts[0];

    if (cmd === ''subscribe'') {
      const slotIdx = slots.length;
      slots.push({ id: null, messages: [] });
      slots[slotIdx].id = bus.subscribe(parts[1], makeHandler(slotIdx));
    } else if (cmd === ''unsubscribe'') {
      const target = lookup(parts[1]);
      bus.unsubscribe(target.id);
    } else if (cmd === ''publish'') {
      bus.publish(parts[1], parts.slice(2).join('' ''));
    } else if (cmd === ''late_subscribe'') {
      const slotIdx = slots.length;
      slots.push({ id: null, messages: [] });
      const ch = parts[1];
      slots[slotIdx].id = bus.subscribe(ch, makeHandler(slotIdx));
      // Drain the retention buffer for this channel into the new subscriber.
      // If the buffer is properly bounded the slot ends up with at most
      // RETENTION_PER_CHANNEL messages; if not, the test fails.
      for (const m of bus.drain(ch)) slots[slotIdx].messages.push(m);
    } else if (cmd === ''count'') {
      out.push(String(bus.subscriberCount(parts[1])));
    } else if (cmd === ''received'') {
      const target = lookup(parts[1]);
      out.push(target.messages.join('',''));
    }
  }
  return out.join(''\n'');
}
module.exports = { solve };',
  5000, 256, NULL, 5000, 1800,
  'iterative_debugging',
  'Debugging entangled bugs across multiple subsystems in a legacy codebase.',
  100, 'core', 'javascript',
  '["chaotic-codebase","legacy","memory-leak","pubsub"]'
);
