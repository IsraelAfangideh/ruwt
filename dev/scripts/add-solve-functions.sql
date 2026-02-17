-- ============================================================
-- Add solve() dispatch functions to all 12 real-world challenges
-- Each solve(testName) acts as an embedded test runner
-- Run: npx wrangler d1 execute ruwt-dev --remote --file=./scripts/add-solve-functions.sql
-- ============================================================

-- 1. rw-connection-pool
UPDATE challenges SET starter_code = replace(starter_code,
'module.exports = { ConnectionPool, resetCounter };',
'async function solve(testName) {
  resetCounter();
  switch (testName) {
    case ''basic-acquire-release'': {
      const pool = new ConnectionPool({ maxSize: 3 });
      const conn = await pool.acquire();
      await conn.query(''SELECT 1'');
      pool.release(conn);
      const s = pool.stats;
      if (s.totalAcquires === 1 && s.totalReleases === 1) return ''acquired-and-released'';
      return ''FAIL: '' + JSON.stringify(s);
    }
    case ''concurrent-acquire-respects-max'': {
      const pool = new ConnectionPool({ maxSize: 2, acquireTimeout: 200 });
      const c1 = await pool.acquire();
      const c2 = await pool.acquire();
      let timedOut = false;
      try { await pool.acquire(); } catch (e) { timedOut = true; }
      pool.release(c1);
      pool.release(c2);
      await pool.destroy();
      if (timedOut) return ''max-pool-size-respected'';
      return ''FAIL: did not timeout'';
    }
    case ''released-connection-reused'': {
      const pool = new ConnectionPool({ maxSize: 2 });
      const c1 = await pool.acquire();
      const id1 = c1.id;
      pool.release(c1);
      const c2 = await pool.acquire();
      pool.release(c2);
      await pool.destroy();
      if (c2.id === id1) return ''connection-reused'';
      return ''FAIL: got different connection'';
    }
    case ''destroy-rejects-pending-waiters'': {
      const pool = new ConnectionPool({ maxSize: 1, acquireTimeout: 5000 });
      const c1 = await pool.acquire();
      let rejected = false;
      const waiterPromise = pool.acquire().catch(() => { rejected = true; });
      await new Promise(r => setTimeout(r, 20));
      await pool.destroy();
      await new Promise(r => setTimeout(r, 50));
      if (rejected) return ''waiters-rejected'';
      return ''FAIL: waiter not rejected'';
    }
    case ''connection-inuse-flag-correct'': {
      const pool = new ConnectionPool({ maxSize: 2 });
      const conn = await pool.acquire();
      const duringAcquire = conn.inUse;
      pool.release(conn);
      const afterRelease = conn.inUse;
      await pool.destroy();
      if (duringAcquire === true && afterRelease === false) return ''inuse-flag-correct'';
      return ''FAIL: inUse during='' + duringAcquire + '' after='' + afterRelease;
    }
    case ''no-double-release'': {
      const pool = new ConnectionPool({ maxSize: 2 });
      const conn = await pool.acquire();
      pool.release(conn);
      try { pool.release(conn); } catch(e) { /* expected */ }
      const idleCount = pool.idleConnections.length;
      await pool.destroy();
      if (idleCount <= 1) return ''double-release-guarded'';
      return ''FAIL: idle count = '' + idleCount;
    }
    default: return ''unknown test: '' + testName;
  }
}

module.exports = { ConnectionPool, resetCounter, solve };')
WHERE id = 'rw-connection-pool';

-- 2. rw-express-router
UPDATE challenges SET starter_code = replace(starter_code,
'module.exports = { Router };',
'async function solve(testName) {
  switch (testName) {
    case ''get-static-route'': {
      const r = new Router();
      r.get(''/hello'', (req, res) => { res.send(''world''); });
      const result = await r.handle({ url: ''/hello'', method: ''GET'' });
      if (result.body === ''world'') return ''static-route-works'';
      return ''FAIL: '' + result.body;
    }
    case ''post-route'': {
      const r = new Router();
      r.post(''/data'', (req, res) => { res.send(''posted''); });
      const result = await r.handle({ url: ''/data'', method: ''POST'' });
      if (result.body === ''posted'') return ''post-route-works'';
      return ''FAIL: '' + result.body;
    }
    case ''path-params-extracted'': {
      const r = new Router();
      r.get(''/users/:id'', (req, res) => { res.send(req.params.id); });
      const result = await r.handle({ url: ''/users/42'', method: ''GET'' });
      if (result.body === ''42'') return ''params-extracted'';
      return ''FAIL: '' + result.body;
    }
    case ''query-string-parsed'': {
      const r = new Router();
      r.get(''/search'', (req, res) => { res.json(req.query); });
      const result = await r.handle({ url: ''/search?q=hello&page=2'', method: ''GET'' });
      const parsed = JSON.parse(result.body);
      if (parsed.q === ''hello'' && parsed.page === ''2'') return ''query-parsed'';
      return ''FAIL: '' + result.body;
    }
    case ''middleware-next-chains'': {
      const r = new Router();
      r.use((req, res, next) => { res.body += ''A''; next(); });
      r.use((req, res, next) => { res.body += ''B''; next(); });
      r.get(''/'', (req, res) => { res.body += ''C''; });
      const result = await r.handle({ url: ''/'', method: ''GET'' });
      if (result.body === ''ABC'') return ''middleware-chains'';
      return ''FAIL: '' + result.body;
    }
    case ''middleware-and-route'': {
      const r = new Router();
      r.use((req, res, next) => { req.mw = true; next(); });
      r.get(''/test'', (req, res) => { res.send(req.mw ? ''mw+route'' : ''route-only''); });
      const result = await r.handle({ url: ''/test'', method: ''GET'' });
      if (result.body === ''mw+route'') return ''middleware-then-route'';
      return ''FAIL: '' + result.body;
    }
    case ''not-found'': {
      const r = new Router();
      r.get(''/exists'', (req, res) => { res.send(''ok''); });
      const result = await r.handle({ url: ''/nope'', method: ''GET'' });
      if (result.status === 404) return ''404-returned'';
      return ''FAIL: status='' + result.status;
    }
    default: return ''unknown test: '' + testName;
  }
}

module.exports = { Router, solve };')
WHERE id = 'rw-express-router';

-- 3. rw-callback-refactor
UPDATE challenges SET starter_code = replace(starter_code,
'module.exports = { processFile, readFile, parseContent, validateData, transformData, writeFile };',
'async function solve(testName) {
  switch (testName) {
    case ''process-json-file'': {
      try {
        const result = await processFile(''users.json'');
        if (result && result.pipeline === ''complete'' && result.success) return ''pipeline-complete-json'';
        return ''FAIL: '' + JSON.stringify(result);
      } catch (e) { return ''ERROR: '' + e.message; }
    }
    case ''process-csv-file'': {
      try {
        const result = await processFile(''products.csv'');
        if (result && result.pipeline === ''complete'' && result.success) return ''pipeline-complete-csv'';
        return ''FAIL: '' + JSON.stringify(result);
      } catch (e) { return ''ERROR: '' + e.message; }
    }
    case ''file-not-found-error'': {
      try {
        await processFile(''nonexistent.txt'');
        return ''FAIL: should have thrown'';
      } catch (e) {
        if (e.message.includes(''ENOENT'')) return ''ENOENT-error'';
        return ''WRONG-ERROR: '' + e.message;
      }
    }
    case ''malformed-json-error'': {
      try {
        await processFile(''malformed.json'');
        return ''FAIL: should have thrown'';
      } catch (e) {
        if (e.message.toLowerCase().includes(''parse'') || e.message.toLowerCase().includes(''json'') || e.message.toLowerCase().includes(''unexpected'')) return ''parse-error'';
        return ''WRONG-ERROR: '' + e.message;
      }
    }
    case ''empty-file-error'': {
      try {
        await processFile(''empty.json'');
        return ''FAIL: should have thrown'';
      } catch (e) {
        if (e.message.toLowerCase().includes(''empty'')) return ''empty-file-error'';
        return ''WRONG-ERROR: '' + e.message;
      }
    }
    case ''concurrent-processing'': {
      try {
        const [r1, r2] = await Promise.all([processFile(''users.json''), processFile(''products.csv'')]);
        if (r1.pipeline === ''complete'' && r2.pipeline === ''complete'') return ''both-complete'';
        return ''FAIL'';
      } catch (e) { return ''ERROR: '' + e.message; }
    }
    case ''all-functions-are-async'': {
      try {
        const r = readFile(''users.json'');
        if (r && typeof r.then === ''function'') return ''all-async'';
        return ''FAIL: readFile does not return a Promise'';
      } catch (e) { return ''ERROR: '' + e.message; }
    }
    default: return ''unknown test: '' + testName;
  }
}

module.exports = { processFile, readFile, parseContent, validateData, transformData, writeFile, solve };')
WHERE id = 'rw-callback-refactor';

-- 4. rw-input-validation
UPDATE challenges SET starter_code = replace(starter_code,
'module.exports = { registerUser, getUser, listUsers, deleteUser, resetDB };',
'function solve(testName) {
  resetDB();
  switch (testName) {
    case ''valid-registration'': {
      const r = registerUser({ email: ''test@example.com'', password: ''Abcdef1!'', username: ''testuser'' });
      if (r.success) return ''registration-success'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''duplicate-email'': {
      registerUser({ email: ''dup@example.com'', password: ''Abcdef1!'', username: ''user1'' });
      const r = registerUser({ email: ''dup@example.com'', password: ''Abcdef1!'', username: ''user2'' });
      if (!r.success && r.error.includes(''already registered'')) return ''email-already-registered'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''invalid-email-no-at'': {
      const r = registerUser({ email: ''bademail.com'', password: ''Abcdef1!'', username: ''testuser'' });
      if (!r.success && r.error.includes(''Invalid email'')) return ''invalid-email-format'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''invalid-email-no-dot'': {
      const r = registerUser({ email: ''bad@emailcom'', password: ''Abcdef1!'', username: ''testuser'' });
      if (!r.success && r.error.includes(''Invalid email'')) return ''invalid-email-format'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''weak-password-short'': {
      const r = registerUser({ email: ''t@e.com'', password: ''Ab1'', username: ''testuser'' });
      if (!r.success && r.error.includes(''Password'')) return ''password-validation-error'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''weak-password-no-uppercase'': {
      const r = registerUser({ email: ''t@e.com'', password: ''abcdefg1'', username: ''testuser'' });
      if (!r.success && r.error.includes(''Password'')) return ''password-validation-error'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''weak-password-no-digit'': {
      const r = registerUser({ email: ''t@e.com'', password: ''Abcdefgh'', username: ''testuser'' });
      if (!r.success && r.error.includes(''Password'')) return ''password-validation-error'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''invalid-username-short'': {
      const r = registerUser({ email: ''t@e.com'', password: ''Abcdef1!'', username: ''ab'' });
      if (!r.success && r.error.includes(''Username'')) return ''username-validation-error'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''invalid-username-starts-number'': {
      const r = registerUser({ email: ''t@e.com'', password: ''Abcdef1!'', username: ''1abc'' });
      if (!r.success && r.error.includes(''Username'')) return ''username-validation-error'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''missing-email-field'': {
      const r = registerUser({ password: ''Abcdef1!'', username: ''testuser'' });
      if (!r.success && r.error.includes(''Missing required'')) return ''missing-required-field'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''missing-password-field'': {
      const r = registerUser({ email: ''t@e.com'', username: ''testuser'' });
      if (!r.success && r.error.includes(''Missing required'')) return ''missing-required-field'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''existing-tests-still-pass'': {
      const reg = registerUser({ email: ''x@y.com'', password: ''Abcdef1!'', username: ''xuser'' });
      if (!reg.success) return ''FAIL: registration'';
      const u = getUser(reg.data.user.id);
      if (!u.success) return ''FAIL: getUser'';
      const list = listUsers();
      if (!list.success || list.data.users.length < 1) return ''FAIL: listUsers'';
      const del = deleteUser(reg.data.user.id);
      if (!del.success) return ''FAIL: deleteUser'';
      return ''all-existing-pass'';
    }
    default: return ''unknown test: '' + testName;
  }
}

module.exports = { registerUser, getUser, listUsers, deleteUser, resetDB, solve };')
WHERE id = 'rw-input-validation';

-- 5. rw-search-perf
UPDATE challenges SET starter_code = replace(starter_code,
'module.exports = { SearchEngine };',
'function solve(testName) {
  switch (testName) {
    case ''basic-single-word-search'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''the quick brown fox'');
      se.addDocument(''d2'', ''the lazy brown dog'');
      se.addDocument(''d3'', ''hello world'');
      const results = se.search(''brown'');
      if (results.length === 2 && results.every(r => r.id === ''d1'' || r.id === ''d2'')) return ''matching-docs-returned'';
      return ''FAIL: '' + JSON.stringify(results);
    }
    case ''multi-word-search-ranking'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''apple banana cherry'');
      se.addDocument(''d2'', ''apple banana'');
      se.addDocument(''d3'', ''apple'');
      const results = se.search(''apple banana cherry'');
      if (results[0].id === ''d1'' && results[0].score === 3 && results[1].id === ''d2'' && results[1].score === 2) return ''ranked-by-score'';
      return ''FAIL: '' + JSON.stringify(results);
    }
    case ''case-insensitive-search'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''Hello World'');
      const results = se.search(''hello'');
      if (results.length === 1 && results[0].id === ''d1'') return ''case-insensitive-match'';
      return ''FAIL: '' + JSON.stringify(results);
    }
    case ''empty-query-returns-empty'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''test doc'');
      const results = se.search('''');
      if (Array.isArray(results) && results.length === 0) return ''empty-array'';
      return ''FAIL: '' + JSON.stringify(results);
    }
    case ''remove-document-updates-index'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''unique term findme'');
      se.removeDocument(''d1'');
      const results = se.search(''findme'');
      if (results.length === 0) return ''removed-doc-not-found'';
      return ''FAIL: '' + JSON.stringify(results);
    }
    case ''performance-1000-docs'': {
      const se = new SearchEngine();
      const words = [''alpha'',''beta'',''gamma'',''delta'',''epsilon'',''zeta'',''eta'',''theta'',''iota'',''kappa''];
      for (let i = 0; i < 1000; i++) {
        const text = Array.from({length: 20}, () => words[Math.floor(Math.random() * words.length)]).join('' '');
        se.addDocument(''doc'' + i, text);
      }
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        se.search(words[i % words.length] + '' '' + words[(i + 3) % words.length]);
      }
      const elapsed = Date.now() - start;
      if (elapsed < 500) return ''under-500ms'';
      return ''FAIL: took '' + elapsed + ''ms'';
    }
    case ''update-document-reindexes'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''original content here'');
      se.addDocument(''d1'', ''replacement text now'');
      const old = se.search(''original'');
      const fresh = se.search(''replacement'');
      if (old.length === 0 && fresh.length === 1 && fresh[0].id === ''d1'') return ''updated-results'';
      return ''FAIL: old='' + JSON.stringify(old) + '' fresh='' + JSON.stringify(fresh);
    }
    default: return ''unknown test: '' + testName;
  }
}

module.exports = { SearchEngine, solve };')
WHERE id = 'rw-search-perf';

-- 6. rw-message-queue
UPDATE challenges SET starter_code = replace(starter_code,
'module.exports = { MessageQueue };',
'async function solve(testName) {
  switch (testName) {
    case ''basic-pub-sub'': {
      const mq = new MessageQueue();
      let received = null;
      mq.subscribe(''test'', (msg) => { received = msg.payload; });
      await mq.publish(''test'', ''hello'');
      if (received === ''hello'') return ''message-delivered'';
      return ''FAIL: '' + received;
    }
    case ''multiple-subscribers-all-receive'': {
      const mq = new MessageQueue();
      let count = 0;
      mq.subscribe(''t'', () => { count++; });
      mq.subscribe(''t'', () => { count++; });
      mq.subscribe(''t'', () => { count++; });
      await mq.publish(''t'', ''hi'');
      if (count === 3) return ''all-received'';
      return ''FAIL: count='' + count;
    }
    case ''unsubscribe-stops-delivery'': {
      const mq = new MessageQueue();
      let called = false;
      const subId = mq.subscribe(''t'', () => { called = true; });
      mq.unsubscribe(subId);
      await mq.publish(''t'', ''hi'');
      if (!called) return ''unsubscribed-no-delivery'';
      return ''FAIL: handler was called'';
    }
    case ''failed-message-retries'': {
      const mq = new MessageQueue({ maxRetries: 3, retryBaseDelay: 10 });
      let attempts = 0;
      mq.subscribe(''t'', () => {
        attempts++;
        if (attempts < 2) throw new Error(''fail'');
      });
      await mq.publish(''t'', ''data'');
      await new Promise(r => setTimeout(r, 200));
      if (attempts >= 2) return ''retried-successfully'';
      return ''FAIL: attempts='' + attempts;
    }
    case ''dead-letter-after-max-retries'': {
      const mq = new MessageQueue({ maxRetries: 2, retryBaseDelay: 10 });
      mq.subscribe(''t'', () => { throw new Error(''always fail''); });
      await mq.publish(''t'', ''data'');
      await new Promise(r => setTimeout(r, 500));
      const dl = mq.getDeadLetters();
      if (dl.length > 0) return ''in-dead-letter-queue'';
      return ''FAIL: dead letters='' + dl.length;
    }
    case ''concurrent-publish'': {
      const mq = new MessageQueue();
      let count = 0;
      mq.subscribe(''t'', () => { count++; });
      await Promise.all([
        mq.publish(''t'', ''1''),
        mq.publish(''t'', ''2''),
        mq.publish(''t'', ''3''),
        mq.publish(''t'', ''4''),
        mq.publish(''t'', ''5''),
      ]);
      if (count === 5) return ''all-messages-delivered'';
      return ''FAIL: count='' + count;
    }
    case ''topic-filtering'': {
      const mq = new MessageQueue();
      let aCount = 0, bCount = 0;
      mq.subscribe(''topicA'', () => { aCount++; });
      mq.subscribe(''topicB'', () => { bCount++; });
      await mq.publish(''topicA'', ''a1'');
      await mq.publish(''topicB'', ''b1'');
      if (aCount === 1 && bCount === 1) return ''only-matching-receive'';
      return ''FAIL: a='' + aCount + '' b='' + bCount;
    }
    default: return ''unknown test: '' + testName;
  }
}

module.exports = { MessageQueue, solve };')
WHERE id = 'rw-message-queue';

-- 7. rw-pr-regression
UPDATE challenges SET starter_code = replace(starter_code,
'module.exports = { calculateDiscount, COUPONS, LOYALTY_TIERS };',
'function solve(testName) {
  switch (testName) {
    case ''single-volume-discount'': {
      const r = calculateDiscount({ unitPrice: 10, quantity: 100 });
      if (r.finalPrice === round2(10 * 100 * 0.85)) return ''correct-volume-price'';
      return ''FAIL: '' + r.finalPrice + '' expected '' + round2(1000 * 0.85);
    }
    case ''stacked-multiplicative'': {
      const r = calculateDiscount({ unitPrice: 100, quantity: 10, couponCode: ''SAVE20'' });
      const expected = round2(100 * 10 * 0.95 * 0.80);
      if (r.finalPrice === expected) return ''multiplicative-result'';
      return ''FAIL: '' + r.finalPrice + '' expected '' + expected;
    }
    case ''coupon-plus-volume'': {
      const r = calculateDiscount({ unitPrice: 100, quantity: 50, couponCode: ''SAVE20'' });
      const expected = round2(100 * 50 * 0.90 * 0.80);
      if (r.finalPrice === expected) return ''multiplicative-coupon-volume'';
      return ''FAIL: '' + r.finalPrice + '' expected '' + expected;
    }
    case ''loyalty-gold-discount'': {
      const r = calculateDiscount({ unitPrice: 100, quantity: 1, loyaltyTier: ''gold'' });
      const expected = round2(100 * 0.92);
      if (r.finalPrice === expected) return ''correct-loyalty-price'';
      return ''FAIL: '' + r.finalPrice + '' expected '' + expected;
    }
    case ''max-discount-cap'': {
      const r = calculateDiscount({ unitPrice: 100, quantity: 100, couponCode: ''VIP50'', loyaltyTier: ''platinum'', date: ''2024-11-27'' });
      const minPrice = round2(100 * 100 * 0.50);
      if (r.finalPrice >= minPrice) return ''price-at-least-50-percent'';
      return ''FAIL: '' + r.finalPrice + '' below min '' + minPrice;
    }
    case ''zero-quantity-error'': {
      const r = calculateDiscount({ unitPrice: 100, quantity: 0 });
      if (r.error) return ''invalid-quantity'';
      return ''FAIL: no error'';
    }
    case ''no-discounts-full-price'': {
      const r = calculateDiscount({ unitPrice: 50, quantity: 3 });
      if (r.finalPrice === 150 && r.totalDiscount === 0) return ''full-price'';
      return ''FAIL: '' + r.finalPrice;
    }
    case ''all-four-discounts'': {
      const r = calculateDiscount({ unitPrice: 100, quantity: 50, couponCode: ''SAVE10'', loyaltyTier: ''silver'', date: ''2024-06-15'' });
      const expected = round2(100 * 50 * 0.90 * 0.90 * 0.95 * 0.90);
      if (r.finalPrice === expected) return ''all-multiplicative'';
      return ''FAIL: '' + r.finalPrice + '' expected '' + expected;
    }
    default: return ''unknown test: '' + testName;
  }
}

module.exports = { calculateDiscount, COUPONS, LOYALTY_TIERS, solve };')
WHERE id = 'rw-pr-regression';

-- 8. rw-date-parser
UPDATE challenges SET starter_code = replace(starter_code,
'module.exports = { parseDate };',
'function solve(testName) {
  switch (testName) {
    case ''iso-basic'': {
      const r = parseDate(''2024-06-15'');
      if (r.iso === ''2024-06-15T00:00:00'') return ''2024-06-15T00:00:00'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''us-format'': {
      const r = parseDate(''03/04/2024'', ''US'');
      if (r.month === 3 && r.day === 4 && r.year === 2024) return ''2024-03-04'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''eu-format'': {
      const r = parseDate(''03/04/2024'', ''EU'');
      if (r.month === 4 && r.day === 3 && r.year === 2024) return ''2024-04-03'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''leap-year-feb29'': {
      const r = parseDate(''2024-02-29'');
      if (!r.error && r.month === 2 && r.day === 29) return ''2024-02-29'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''timezone-offset-positive'': {
      const r = parseDate(''2024-01-15T12:00:00+05:30'');
      if (!r.error && r.hour === 6 && r.minute === 30) return ''utc-conversion-correct'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''relative-yesterday'': {
      const r = parseDate(''yesterday'');
      if (!r.error && r.year && r.month && r.day) return ''correct-yesterday'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''written-format'': {
      const r = parseDate(''January 15, 2024'');
      if (r.month === 1 && r.day === 15 && r.year === 2024) return ''january-15-2024'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    case ''invalid-date'': {
      const r = parseDate(''2024-02-30'');
      if (r.error) return ''error-invalid'';
      return ''FAIL: '' + JSON.stringify(r);
    }
    default: return ''unknown test: '' + testName;
  }
}

module.exports = { parseDate, solve };')
WHERE id = 'rw-date-parser';

-- 9. rw-class-to-hooks
UPDATE challenges SET starter_code = replace(starter_code,
'module.exports = { createStore };',
'function solve(testName) {
  switch (testName) {
    case ''basic-get-set-state'': {
      const s = createStore({ count: 0 });
      s.setState({ count: 5 });
      if (s.getState().count === 5) return ''state-updated'';
      return ''FAIL: '' + JSON.stringify(s.getState());
    }
    case ''subscribe-fires-on-change'': {
      const s = createStore({ x: 1 });
      let called = false;
      s.subscribe(() => { called = true; });
      s.setState({ x: 2 });
      if (called) return ''listener-called'';
      return ''FAIL: not called'';
    }
    case ''unsubscribe-stops-notifications'': {
      const s = createStore({ x: 1 });
      let count = 0;
      const unsub = s.subscribe(() => { count++; });
      s.setState({ x: 2 });
      unsub();
      s.setState({ x: 3 });
      if (count === 1) return ''no-more-calls'';
      return ''FAIL: count='' + count;
    }
    case ''computed-values-update'': {
      const s = createStore({ items: [1, 2, 3] });
      s.computed(''total'', (state) => state.items.reduce((a, b) => a + b, 0));
      const v1 = s.getComputed(''total'');
      s.setState({ items: [10, 20] });
      const v2 = s.getComputed(''total'');
      if (v1 === 6 && v2 === 30) return ''computed-correct'';
      return ''FAIL: v1='' + v1 + '' v2='' + v2;
    }
    case ''actions-modify-state'': {
      const s = createStore({ count: 0 });
      s.action(''increment'', (ctx, amount) => { ctx.setState({ count: ctx.getState().count + amount }); });
      s.dispatch(''increment'', 5);
      if (s.getState().count === 5) return ''action-applied'';
      return ''FAIL: '' + s.getState().count;
    }
    case ''batch-single-notification'': {
      const s = createStore({ a: 0, b: 0 });
      let notifyCount = 0;
      s.subscribe(() => { notifyCount++; });
      s.batch(() => {
        s.setState({ a: 1 });
        s.setState({ b: 2 });
        s.setState({ a: 3 });
      });
      if (notifyCount === 1 && s.getState().a === 3 && s.getState().b === 2) return ''one-notification'';
      return ''FAIL: notifyCount='' + notifyCount + '' state='' + JSON.stringify(s.getState());
    }
    case ''nested-state-merge'': {
      const s = createStore({ x: 1, y: 2, z: 3 });
      s.setState({ x: 10, w: 4 });
      const st = s.getState();
      if (st.x === 10 && st.y === 2 && st.z === 3 && st.w === 4) return ''deep-merge-works'';
      return ''FAIL: '' + JSON.stringify(st);
    }
    case ''no-class-usage'': {
      const src = createStore.toString();
      if (!src.includes(''new Store'') && !src.includes(''new this'')) return ''no-class-found'';
      return ''FAIL: class usage detected'';
    }
    default: return ''unknown test: '' + testName;
  }
}

module.exports = { createStore, solve };')
WHERE id = 'rw-class-to-hooks';

-- 10. rw-memory-leak
UPDATE challenges SET starter_code = replace(starter_code,
'module.exports = { WebSocketServer };',
'function solve(testName) {
  switch (testName) {
    case ''connect-disconnect-cleanup'': {
      const ws = new WebSocketServer({ heartbeatInterval: 100000, connectionTimeout: 100000 });
      ws.connect({ user: ''alice'' });
      const connId = ''conn_'' + ws._idCounter;
      ws.disconnect(connId);
      const sessionCount = ws.getSessionCount();
      ws.shutdown();
      if (sessionCount === 0) return ''session-removed'';
      return ''FAIL: sessions='' + sessionCount;
    }
    case ''listeners-removed-on-disconnect'': {
      const ws = new WebSocketServer({ heartbeatInterval: 100000, connectionTimeout: 100000 });
      const before = ws.getListenerCount(''message'');
      const { connectionId } = ws.connect({});
      const during = ws.getListenerCount(''message'');
      ws.disconnect(connectionId);
      const after = ws.getListenerCount(''message'');
      ws.shutdown();
      if (after === before) return ''no-listener-leak'';
      return ''FAIL: before='' + before + '' during='' + during + '' after='' + after;
    }
    case ''timers-cleared-on-disconnect'': {
      const ws = new WebSocketServer({ heartbeatInterval: 50, connectionTimeout: 100000 });
      const { connectionId } = ws.connect({});
      const conn = ws.connections.get(connectionId);
      const hb = conn ? conn._heartbeatTimer : null;
      const to = conn ? conn._timeoutTimer : null;
      ws.disconnect(connectionId);
      ws.shutdown();
      if (hb !== null && to !== null) return ''timers-cleaned'';
      return ''FAIL: no timers found'';
    }
    case ''message-buffer-capped'': {
      const ws = new WebSocketServer({ heartbeatInterval: 100000, connectionTimeout: 100000, messageBufferSize: 5 });
      const { connectionId } = ws.connect({});
      for (let i = 0; i < 20; i++) ws.send(connectionId, ''msg'' + i);
      const conn = ws.connections.get(connectionId);
      const bufLen = conn ? conn.messageBuffer.length : 0;
      ws.disconnect(connectionId);
      ws.shutdown();
      if (bufLen <= 5) return ''buffer-bounded'';
      return ''FAIL: buffer='' + bufLen;
    }
    case ''shutdown-cleans-everything'': {
      const ws = new WebSocketServer({ heartbeatInterval: 100000, connectionTimeout: 100000 });
      ws.connect({});
      ws.connect({});
      ws.connect({});
      ws.shutdown();
      const sessions = ws.getSessionCount();
      const listeners = ws.getListenerCount(''message'');
      if (sessions === 0 && listeners === 0) return ''all-cleaned'';
      return ''FAIL: sessions='' + sessions + '' listeners='' + listeners;
    }
    case ''rapid-connect-disconnect'': {
      const ws = new WebSocketServer({ heartbeatInterval: 100000, connectionTimeout: 100000 });
      for (let i = 0; i < 100; i++) {
        const { connectionId } = ws.connect({});
        ws.disconnect(connectionId);
      }
      const sessions = ws.getSessionCount();
      const listeners = ws.getListenerCount(''message'');
      ws.shutdown();
      if (sessions === 0 && listeners === 0) return ''no-memory-growth'';
      return ''FAIL: sessions='' + sessions + '' listeners='' + listeners;
    }
    case ''session-data-lifecycle'': {
      const ws = new WebSocketServer({ heartbeatInterval: 100000, connectionTimeout: 100000 });
      const { connectionId } = ws.connect({ user: ''bob'' });
      ws.setSessionData(connectionId, ''theme'', ''dark'');
      const session = ws.getSession(connectionId);
      const hasData = session && session.data.theme === ''dark'';
      ws.disconnect(connectionId);
      const afterSession = ws.getSession(connectionId);
      ws.shutdown();
      if (hasData && afterSession === null) return ''data-cleaned-on-disconnect'';
      return ''FAIL: hasData='' + hasData + '' afterSession='' + (afterSession !== null);
    }
    default: return ''unknown test: '' + testName;
  }
}

module.exports = { WebSocketServer, solve };')
WHERE id = 'rw-memory-leak';

-- 11. rw-feature-flags
UPDATE challenges SET starter_code = replace(starter_code,
'module.exports = { FlagEvaluator };',
'function solve(testName) {
  switch (testName) {
    case ''boolean-flag-true'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''boolean'', value: true }] } });
      return fe.evaluate(''f1'', {}) ? ''true'' : ''false'';
    }
    case ''boolean-flag-false'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''boolean'', value: false }] } });
      return fe.evaluate(''f1'', {}) ? ''true'' : ''false'';
    }
    case ''environment-match'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''environment'', environments: [''production''], value: true }] } });
      return fe.evaluate(''f1'', { environment: ''production'' }) ? ''true'' : ''false'';
    }
    case ''environment-no-match'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''environment'', environments: [''production''] }], defaultValue: false } });
      const r = fe.evaluate(''f1'', { environment: ''staging'' });
      return r ? ''true'' : ''default-value'';
    }
    case ''percentage-rollout-deterministic'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''percentage'', percentage: 50 }] } });
      const r1 = fe.evaluate(''f1'', { userId: ''user123'' });
      const r2 = fe.evaluate(''f1'', { userId: ''user123'' });
      if (r1 === r2) return ''consistent-result'';
      return ''FAIL: inconsistent'';
    }
    case ''percentage-zero-off'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''percentage'', percentage: 0 }], defaultValue: false } });
      return fe.evaluate(''f1'', { userId: ''anyone'' }) ? ''true'' : ''false'';
    }
    case ''percentage-hundred-on'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''percentage'', percentage: 100 }] } });
      return fe.evaluate(''f1'', { userId: ''anyone'' }) ? ''true'' : ''false'';
    }
    case ''user-target-by-id'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''userTarget'', userIds: [''u1'', ''u2''] }] } });
      return fe.evaluate(''f1'', { userId: ''u1'' }) ? ''true'' : ''false'';
    }
    case ''user-target-by-attributes'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''userTarget'', attributes: { plan: ''pro'' } }] } });
      return fe.evaluate(''f1'', { userId: ''u99'', attributes: { plan: ''pro'' } }) ? ''true'' : ''false'';
    }
    case ''date-range-active'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''dateRange'', startDate: ''2020-01-01T00:00:00Z'', endDate: ''2030-01-01T00:00:00Z'' }] } });
      return fe.evaluate(''f1'', { now: Date.now() }) ? ''true'' : ''false'';
    }
    case ''date-range-expired'': {
      const fe = new FlagEvaluator({ f1: { enabled: true, rules: [{ type: ''dateRange'', startDate: ''2020-01-01T00:00:00Z'', endDate: ''2021-01-01T00:00:00Z'' }], defaultValue: false } });
      return fe.evaluate(''f1'', { now: Date.now() }) ? ''true'' : ''false'';
    }
    case ''flag-not-found'': {
      const fe = new FlagEvaluator({});
      return fe.evaluate(''nonexistent'', {}) ? ''true'' : ''false'';
    }
    case ''disabled-flag'': {
      const fe = new FlagEvaluator({ f1: { enabled: false, rules: [{ type: ''boolean'', value: true }] } });
      return fe.evaluate(''f1'', {}) ? ''true'' : ''false'';
    }
    default: return ''unknown test: '' + testName;
  }
}

module.exports = { FlagEvaluator, solve };')
WHERE id = 'rw-feature-flags';

-- 12. rw-circular-deps
UPDATE challenges SET starter_code = replace(starter_code,
'module.exports = { UserService, OrderService, NotificationService, resetAll };',
'function solve(testName) {
  resetAll();
  switch (testName) {
    case ''create-user'': {
      const u = UserService.createUser(''Alice'', ''alice@test.com'');
      if (u && u.id && u.name === ''Alice'') return ''user-created'';
      return ''FAIL: '' + JSON.stringify(u);
    }
    case ''create-order-sends-notification'': {
      const u = UserService.createUser(''Bob'', ''bob@test.com'');
      const o = OrderService.createOrder(u.id, [{ name: ''Widget'', price: 10, quantity: 2 }]);
      const notifs = NotificationService.getNotificationsForUser(u.id);
      if (o && o.id && notifs.length > 0 && notifs[0].type === ''order_confirmation'') return ''order-with-notification'';
      return ''FAIL: order='' + JSON.stringify(o) + '' notifs='' + notifs.length;
    }
    case ''get-user-with-orders'': {
      const u = UserService.createUser(''Carol'', ''carol@test.com'');
      OrderService.createOrder(u.id, [{ name: ''Gadget'', price: 20, quantity: 1 }]);
      const uo = UserService.getUserWithOrders(u.id);
      if (uo && uo.orders && uo.orders.length === 1) return ''user-and-orders'';
      return ''FAIL: '' + JSON.stringify(uo);
    }
    case ''notification-has-email'': {
      const u = UserService.createUser(''Dave'', ''dave@test.com'');
      OrderService.createOrder(u.id, [{ name: ''Thing'', price: 5, quantity: 1 }]);
      const notifs = NotificationService.getNotificationsForUser(u.id);
      if (notifs.length > 0 && notifs[0].email === ''dave@test.com'') return ''email-in-notification'';
      return ''FAIL: '' + JSON.stringify(notifs);
    }
    case ''full-flow'': {
      const u = UserService.createUser(''Eve'', ''eve@test.com'');
      const o = OrderService.createOrder(u.id, [{ name: ''Item'', price: 30, quantity: 2 }]);
      OrderService.updateOrderStatus(o.id, ''shipped'');
      const notifs = NotificationService.getNotificationsForUser(u.id);
      const hasConfirm = notifs.some(n => n.type === ''order_confirmation'');
      const hasStatus = notifs.some(n => n.type === ''status_update'');
      if (hasConfirm && hasStatus) return ''create-order-notify-status'';
      return ''FAIL: confirm='' + hasConfirm + '' status='' + hasStatus;
    }
    case ''update-order-status-notifies'': {
      const u = UserService.createUser(''Frank'', ''frank@test.com'');
      const o = OrderService.createOrder(u.id, [{ name: ''X'', price: 10, quantity: 1 }]);
      OrderService.updateOrderStatus(o.id, ''delivered'');
      const notifs = NotificationService.getNotificationsForUser(u.id);
      const statusNotifs = notifs.filter(n => n.type === ''status_update'');
      if (statusNotifs.length > 0 && statusNotifs[0].message.includes(''delivered'')) return ''status-notification-sent'';
      return ''FAIL: '' + JSON.stringify(statusNotifs);
    }
    case ''no-circular-undefined'': {
      try {
        const u = UserService.createUser(''Test'', ''t@t.com'');
        const o = OrderService.createOrder(u.id, [{ name: ''Y'', price: 1, quantity: 1 }]);
        const uo = UserService.getUserWithOrders(u.id);
        NotificationService.notify(u.id, ''test'');
        if (o && uo && uo.orders) return ''all-functions-defined'';
        return ''FAIL'';
      } catch (e) {
        return ''ERROR: '' + e.message;
      }
    }
    default: return ''unknown test: '' + testName;
  }
}

module.exports = { UserService, OrderService, NotificationService, resetAll, solve };')
WHERE id = 'rw-circular-deps';
