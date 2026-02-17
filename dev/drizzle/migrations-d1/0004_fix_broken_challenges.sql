-- 0004_fix_broken_challenges.sql
-- Fix rw-circular-deps and rw-search-perf: both had starter code that
-- passed all tests without any user modifications.

-- ============================================================
-- 1. rw-circular-deps
-- Problem: All services defined as plain objects in one file — no actual
-- circular dependency. Everything works fine without changes.
-- Fix: Use registry + IIFEs to simulate module loading order. Modules
-- loaded early capture undefined references to later-loaded modules.
-- ============================================================
UPDATE challenges SET
description = '## Bug: Circular Dependencies Causing Undefined Functions

Three service modules are loaded through a shared registry using IIFEs (simulating Node.js module loading order). Each module captures its dependency references at load time:

- `UserService` loads first, captures `OrderService` (not loaded yet — undefined)
- `OrderService` loads second, captures `NotificationService` (not loaded yet — undefined)
- `NotificationService` loads third, captures `UserService` (already loaded — works)

Because of the load order, `UserService` and `OrderService` hold stale `undefined` references to their dependencies, causing `TypeError: Cannot read properties of undefined` when cross-service calls are made.

### Your Task

Fix the code so all cross-service calls work correctly. Common patterns:
- Use lazy lookups through the registry instead of captured references
- Restructure the load order
- Use dependency injection (pass dependencies as arguments)
- Use a mediator/event pattern

All tests must pass. The public API of each service must remain the same.

`module.exports = { solve }`',
starter_code = '// Simulated module system — demonstrates circular dependency loading order.
// Each "module" captures dependency references at load time via IIFEs.
// If a dependency hasn''t been loaded yet, the captured reference is undefined.
//
// Load order: UserService -> OrderService -> NotificationService
// Circular chain: UserService needs OrderService, OrderService needs
// NotificationService, NotificationService needs UserService.
//
// Fix the code so all cross-service calls work correctly.

const registry = {};

// Shared in-memory databases
const usersDB = new Map();
const ordersDB = new Map();
const notificationsDB = new Map();
let userIdCounter = 0;
let orderIdCounter = 0;
let notifIdCounter = 0;

function resetAll() {
  usersDB.clear();
  ordersDB.clear();
  notificationsDB.clear();
  userIdCounter = 0;
  orderIdCounter = 0;
  notifIdCounter = 0;
}

// ─── UserService (loaded first) ─────────────────────────────
// Captures OrderService at load time — BUT OrderService hasn''t loaded yet!
registry.UserService = (function() {
  const OrderSvc = registry.OrderService; // undefined — not loaded yet

  return {
    createUser(name, email) {
      const id = ++userIdCounter;
      const user = { id, name, email, createdAt: Date.now() };
      usersDB.set(id, user);
      return user;
    },

    getUser(id) {
      return usersDB.get(id) || null;
    },

    getUserEmail(id) {
      const user = usersDB.get(id);
      return user ? user.email : null;
    },

    getUserWithOrders(userId) {
      const user = this.getUser(userId);
      if (!user) return null;
      // BUG: OrderSvc was captured as undefined before OrderService loaded
      const orders = OrderSvc.getOrdersByUser(userId);
      return { ...user, orders };
    },

    listUsers() { return Array.from(usersDB.values()); },
    deleteUser(id) { return usersDB.delete(id); },
  };
})();

// ─── OrderService (loaded second) ───────────────────────────
// Captures NotificationService — BUT it hasn''t loaded yet!
registry.OrderService = (function() {
  const NotifSvc = registry.NotificationService; // undefined — not loaded yet

  return {
    createOrder(userId, items) {
      const user = registry.UserService.getUser(userId);
      if (!user) throw new Error(''User not found: '' + userId);

      const id = ++orderIdCounter;
      const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const order = {
        id, userId, items, total,
        status: ''created'',
        createdAt: Date.now(),
      };
      ordersDB.set(id, order);

      // BUG: NotifSvc was captured as undefined before NotificationService loaded
      try {
        NotifSvc.sendOrderConfirmation(userId, order);
      } catch (e) {
        order.notificationError = e.message;
      }

      return order;
    },

    getOrder(id) { return ordersDB.get(id) || null; },

    getOrdersByUser(userId) {
      const orders = [];
      for (const o of ordersDB.values()) if (o.userId === userId) orders.push(o);
      return orders;
    },

    updateOrderStatus(id, status) {
      const order = ordersDB.get(id);
      if (!order) throw new Error(''Order not found'');
      order.status = status;
      order.updatedAt = Date.now();

      try {
        NotifSvc.sendStatusUpdate(order.userId, order, status);
      } catch (e) {
        order.notificationError = e.message;
      }

      return order;
    },

    listOrders() { return Array.from(ordersDB.values()); },
  };
})();

// ─── NotificationService (loaded third) ─────────────────────
// UserService IS available (loaded first), so this reference works.
registry.NotificationService = (function() {
  const UserSvc = registry.UserService; // works — loaded first

  return {
    sendOrderConfirmation(userId, order) {
      const email = UserSvc.getUserEmail(userId);
      if (!email) throw new Error(''No email for user: '' + userId);
      const id = ++notifIdCounter;
      const n = {
        id, type: ''order_confirmation'', userId, email, orderId: order.id,
        message: ''Your order #'' + order.id + '' has been confirmed. Total: $'' + order.total.toFixed(2),
        sentAt: Date.now(),
      };
      notificationsDB.set(id, n);
      return n;
    },

    sendStatusUpdate(userId, order, status) {
      const email = UserSvc.getUserEmail(userId);
      if (!email) throw new Error(''No email for user: '' + userId);
      const id = ++notifIdCounter;
      const n = {
        id, type: ''status_update'', userId, email, orderId: order.id,
        message: ''Order #'' + order.id + '' status changed to: '' + status,
        sentAt: Date.now(),
      };
      notificationsDB.set(id, n);
      return n;
    },

    notify(userId, message) {
      const email = UserSvc.getUserEmail(userId);
      if (!email) throw new Error(''No email for user: '' + userId);
      const id = ++notifIdCounter;
      const n = { id, type: ''general'', userId, email, message, sentAt: Date.now() };
      notificationsDB.set(id, n);
      return n;
    },

    getNotificationsForUser(userId) {
      const notifs = [];
      for (const n of notificationsDB.values()) if (n.userId === userId) notifs.push(n);
      return notifs;
    },

    listNotifications() { return Array.from(notificationsDB.values()); },
  };
})();

const UserService = registry.UserService;
const OrderService = registry.OrderService;
const NotificationService = registry.NotificationService;

function solve(testName) {
  resetAll();
  switch(testName) {
    case ''create-user'': {
      const u = UserService.createUser(''Alice'', ''alice@example.com'');
      return (u.id && u.name === ''Alice'') ? ''user-created'' : ''FAIL'';
    }
    case ''create-order-sends-notification'': {
      const u = UserService.createUser(''Bob'', ''bob@example.com'');
      const o = OrderService.createOrder(u.id, [{ price: 10, quantity: 2 }]);
      const notifs = NotificationService.getNotificationsForUser(u.id);
      return (o.id && notifs.length > 0) ? ''order-with-notification'' : ''FAIL'';
    }
    case ''get-user-with-orders'': {
      const u = UserService.createUser(''Carol'', ''carol@example.com'');
      OrderService.createOrder(u.id, [{ price: 5, quantity: 1 }]);
      const result = UserService.getUserWithOrders(u.id);
      return (result && result.orders && result.orders.length === 1) ? ''user-and-orders'' : ''FAIL'';
    }
    case ''notification-has-email'': {
      const u = UserService.createUser(''Dan'', ''dan@example.com'');
      const o = OrderService.createOrder(u.id, [{ price: 15, quantity: 1 }]);
      const notifs = NotificationService.getNotificationsForUser(u.id);
      return (notifs.length > 0 && notifs[0].email === ''dan@example.com'') ? ''email-in-notification'' : ''FAIL'';
    }
    case ''full-flow'': {
      const u = UserService.createUser(''Eve'', ''eve@example.com'');
      const o = OrderService.createOrder(u.id, [{ price: 20, quantity: 3 }]);
      OrderService.updateOrderStatus(o.id, ''shipped'');
      const notifs = NotificationService.getNotificationsForUser(u.id);
      return (notifs.length >= 2) ? ''create-order-notify-status'' : ''FAIL'';
    }
    case ''update-order-status-notifies'': {
      const u = UserService.createUser(''Frank'', ''frank@example.com'');
      const o = OrderService.createOrder(u.id, [{ price: 10, quantity: 1 }]);
      OrderService.updateOrderStatus(o.id, ''delivered'');
      const notifs = NotificationService.getNotificationsForUser(u.id);
      const hasStatus = notifs.some(n => n.type === ''status_update'');
      return hasStatus ? ''status-notification-sent'' : ''FAIL'';
    }
    case ''no-circular-undefined'': {
      const u = UserService.createUser(''Test'', ''test@example.com'');
      let allDefined = true;
      try {
        OrderService.createOrder(u.id, [{ price: 1, quantity: 1 }]);
        UserService.getUserWithOrders(u.id);
        NotificationService.notify(u.id, ''hello'');
      } catch(e) {
        if (e.message.includes(''is not a function'') || e.message.includes(''undefined'')) allDefined = false;
      }
      return allDefined ? ''all-functions-defined'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };'
WHERE id = 'rw-circular-deps';


-- ============================================================
-- 2. rw-search-perf
-- Problem: Naive scan with Set.has() was fast enough to pass the 500ms
-- performance test. All correctness tests also passed because the search
-- logic was correct, just slow.
-- Fix: Replace wordSet with stale allDocs array + re-tokenization per search.
-- Bugs: (1) removeDocument doesn't clean allDocs, (2) no pre-computed
-- wordSet so search re-tokenizes every doc on every query, (3) perf test
-- now uses 5000 docs to make naive approach genuinely too slow.
-- ============================================================
UPDATE challenges SET
starter_code = '// Text Search Engine — Currently O(n^2), needs inverted index
// BUG 1: search() uses a flat allDocs array that removeDocument never cleans up
// BUG 2: search() re-tokenizes every document on every query (no pre-computed word sets)
// Both bugs must be fixed. Build a proper inverted index.

class SearchEngine {
  constructor() {
    this.documents = new Map(); // id -> { text }
    this.allDocs = [];          // Flat array for search scanning
  }

  // Tokenize text into normalized words
  _tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '' '')
      .split(/\s+/)
      .filter(w => w.length > 0);
  }

  // Add a document to the search engine
  addDocument(id, text) {
    if (typeof text !== ''string'' || text.trim() === '''') {
      throw new Error(''Document text must be a non-empty string'');
    }

    // Remove old version if updating
    if (this.documents.has(id)) {
      this.removeDocument(id);
    }

    this.documents.set(id, { text });
    // BUG: Pushes to allDocs but removeDocument never cleans it up
    this.allDocs.push({ id, text });
  }

  // Remove a document from the search engine
  removeDocument(id) {
    const doc = this.documents.get(id);
    if (!doc) return false;

    this.documents.delete(id);
    // BUG: Should also remove from this.allDocs but doesn''t!
    // Removed documents still appear in search results.
    return true;
  }

  // Get original text of a document
  getDocument(id) {
    const doc = this.documents.get(id);
    return doc ? doc.text : null;
  }

  // Search for documents matching query
  // Returns array of { id, score } sorted by score descending
  search(query) {
    if (!query || typeof query !== ''string'' || query.trim() === '''') {
      return [];
    }

    const queryWords = this._tokenize(query);
    if (queryWords.length === 0) return [];

    const scores = new Map();

    // O(n^2): Scans allDocs (never cleaned up) and re-tokenizes every time
    for (const entry of this.allDocs) {
      const docWords = this._tokenize(entry.text);
      let score = 0;

      for (const qWord of queryWords) {
        for (const dWord of docWords) {
          if (dWord === qWord) {
            score++;
            break;
          }
        }
      }

      if (score > 0) {
        scores.set(entry.id, score);
      }
    }

    // Convert to sorted results
    const results = [];
    for (const [id, score] of scores) {
      results.push({ id, score });
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });

    return results;
  }

  // Get stats about the search engine
  getStats() {
    return {
      documentCount: this.documents.size,
    };
  }

  // Clear all documents
  clear() {
    this.documents.clear();
    this.allDocs = [];
  }
}

function solve(testName) {
  switch(testName) {
    case ''basic-single-word-search'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''the quick brown fox'');
      se.addDocument(''d2'', ''the lazy brown dog'');
      se.addDocument(''d3'', ''hello world'');
      const results = se.search(''brown'');
      return (results.length === 2) ? ''matching-docs-returned'' : ''FAIL'';
    }
    case ''multi-word-search-ranking'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''apple banana cherry'');
      se.addDocument(''d2'', ''apple banana date'');
      se.addDocument(''d3'', ''apple elderberry fig'');
      const r = se.search(''apple banana'');
      return (r.length === 3 && r[0].score === 2 && r[2].score === 1) ? ''ranked-by-score'' : ''FAIL'';
    }
    case ''case-insensitive-search'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''Hello World'');
      const r = se.search(''hello'');
      return (r.length === 1 && r[0].id === ''d1'') ? ''case-insensitive-match'' : ''FAIL'';
    }
    case ''empty-query-returns-empty'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''test doc'');
      return se.search('''').length === 0 ? ''empty-array'' : ''FAIL'';
    }
    case ''remove-document-updates-index'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''unique content here'');
      se.removeDocument(''d1'');
      return se.search(''unique'').length === 0 ? ''removed-doc-not-found'' : ''FAIL'';
    }
    case ''performance-1000-docs'': {
      const se = new SearchEngine();
      const words = [''alpha'',''beta'',''gamma'',''delta'',''epsilon'',''zeta'',''eta'',''theta'',''iota'',''kappa'',
                     ''lambda'',''mu'',''nu'',''xi'',''omicron'',''pi'',''rho'',''sigma'',''tau'',''upsilon''];
      for (let i = 0; i < 5000; i++) {
        const dw = [];
        for (let j = 0; j < 50; j++) dw.push(words[(i*7+j*3) % words.length]);
        se.addDocument(''doc''+i, dw.join('' ''));
      }
      const start = Date.now();
      for (let i = 0; i < 100; i++) se.search(words[i%words.length]+'' ''+words[(i+3)%words.length]);
      return (Date.now()-start) < 500 ? ''under-500ms'' : ''FAIL'';
    }
    case ''update-document-reindexes'': {
      const se = new SearchEngine();
      se.addDocument(''d1'', ''old content here'');
      se.addDocument(''d1'', ''new content now'');
      return (se.search(''old'').length===0 && se.search(''new'').length===1) ? ''updated-results'' : ''FAIL'';
    }
    default: return ''unknown-test'';
  }
}

module.exports = { solve };'
WHERE id = 'rw-search-perf';
