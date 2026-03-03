-- Fix debounce-throttle challenge: add test_harness with fake timers
-- so the judge can test async debounce/throttle behavior synchronously.
-- Also update difficulty from medium to easy and clean up description.
-- Run: npx wrangler d1 execute ruwt-dev --remote --file=./dev/drizzle/migrations-d1/0041_fix_debounce_throttle_harness.sql

UPDATE challenges SET
  difficulty = 'easy',
  description = 'Implement debounce and throttle functions.

debounce(fn, ms): Returns a function that delays invoking fn until ms milliseconds have elapsed since the last call. If called again before the delay expires, the timer resets.

throttle(fn, ms): Returns a function that invokes fn at most once per ms milliseconds. Subsequent calls within the interval are ignored.

Both returned functions should pass through arguments to the original fn.

Export both functions via module.exports = { debounce, throttle }.

Moderate token limit — describe both functions clearly and concisely in a single prompt exchange.',
  test_harness = 'function solve(testName, count, ms) {
  var _origSetTimeout = global.setTimeout;
  var _origClearTimeout = global.clearTimeout;
  var _origDateNow = Date.now;
  var timers = [];
  var now = 0;
  Date.now = function() { return now; };
  global.setTimeout = function(cb, delay) {
    var id = timers.length;
    timers.push({ cb: cb, fireAt: now + delay, cleared: false });
    return id;
  };
  global.clearTimeout = function(id) {
    if (timers[id]) timers[id].cleared = true;
  };
  function advanceTime(t) {
    now += t;
    for (var i = 0; i < timers.length; i++) {
      if (!timers[i].cleared && timers[i].fireAt <= now) {
        timers[i].cleared = true;
        timers[i].cb();
      }
    }
  }
  try {
    var calls = [];
    var fn = function() { calls.push(Array.prototype.slice.call(arguments)); };
    if (testName === ''debounce-basic'') {
      var d = debounce(fn, ms);
      for (var i = 0; i < count; i++) d();
      advanceTime(ms + 1);
      return String(calls.length);
    }
    if (testName === ''debounce-reset'') {
      var d = debounce(fn, ms);
      for (var i = 0; i < count; i++) {
        d();
        if (i < count - 1) advanceTime(ms - 1);
      }
      advanceTime(ms + 1);
      return String(calls.length);
    }
    if (testName === ''debounce-args'') {
      var d = debounce(fn, ms);
      d(count);
      advanceTime(ms + 1);
      return String(calls[0][0]);
    }
    if (testName === ''throttle-basic'') {
      var t = throttle(fn, ms);
      for (var i = 0; i < count; i++) t();
      return String(calls.length);
    }
    if (testName === ''throttle-spaced'') {
      var t = throttle(fn, ms);
      for (var i = 0; i < count; i++) {
        t();
        advanceTime(ms + 1);
      }
      return String(calls.length);
    }
    return ''UNKNOWN_TEST'';
  } finally {
    global.setTimeout = _origSetTimeout;
    global.clearTimeout = _origClearTimeout;
    Date.now = _origDateNow;
  }
}
module.exports = { solve };'
WHERE id = 'debounce-throttle';
