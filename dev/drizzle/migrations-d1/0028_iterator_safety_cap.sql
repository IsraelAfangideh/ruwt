-- Fix broken-iterator harness: add iteration safety cap to prevent OOM
-- when buggy user code returns an iterator that never terminates.
-- Array.from(iterable) on an infinite iterator exhausts memory before
-- the 5-second timeout can kill the process → OOM crash on ruwt-exec.
-- Cap at 10,000 items (legitimate tests have at most 6 items).
-- ============================================================
UPDATE challenges SET test_harness = 'function solve(...args) {
  var parts = String(args[0]).split('' '').map(Number);
  var iterable = range.apply(null, parts);
  var arr = [];
  var count = 0;
  for (var v of iterable) {
    if (++count > 10000) break;
    arr.push(v);
  }
  return JSON.stringify(arr);
}
module.exports = { solve };' WHERE id = 'broken-iterator';
