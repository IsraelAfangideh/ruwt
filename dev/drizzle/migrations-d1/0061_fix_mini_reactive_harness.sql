-- Migration 0061: Add test_harness for mini-reactive challenge.
-- The challenge uses scenario names (basic-read, setter-triggers-effect, etc.)
-- as test inputs, which contain hyphens. Without a harness, judge.ts's
-- extractMultiExportNames produces invalid JS when building the dispatch table
-- (string literals can't be shorthand object properties), making the challenge
-- impossible to solve.

UPDATE challenges SET test_harness = 'function solve(testName) {
  switch (testName) {
    case ''basic-read'': {
      const [val] = createSignal(0);
      const log = [];
      log.push(''val='' + val());
      return log;
    }
    case ''setter-triggers-effect'': {
      const [val, setVal] = createSignal(0);
      const log = [];
      createEffect(() => { log.push(''val='' + val()); });
      setVal(1);
      return log;
    }
    case ''multiple-signals'': {
      const [a, setA] = createSignal(1);
      const [b, setB] = createSignal(2);
      const log = [];
      createEffect(() => { log.push(''a='' + a() + '',b='' + b()); });
      setA(10);
      setB(20);
      return log;
    }
    case ''independent-effects'': {
      const [count, setCount] = createSignal(0);
      const [name, setName] = createSignal(''Alice'');
      const log = [];
      createEffect(() => { log.push(''count='' + count()); });
      createEffect(() => { log.push(''name='' + name()); });
      setCount(1);
      setName(''Bob'');
      return log;
    }
    case ''no-spurious-runs'': {
      const [a, setA] = createSignal(1);
      const log = [];
      createEffect(() => { log.push(''a='' + a()); });
      setA(1);
      return log;
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };' WHERE id = 'mini-reactive';
