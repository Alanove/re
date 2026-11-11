# Production Stability Guide: Memory Leaks, DB Growth & Orphan Data

This document describes fixes applied to prevent server freezes and unbounded database growth. Use it as a checklist for similar Node/Express + MySQL projects.

---

## 1. Session store: move from RAM to database (CRITICAL)

**Problem:** `express-session` defaults to `MemoryStore`. With `saveUninitialized: true`, every request (including bots) creates a session object in RAM. Expired sessions are never evicted, so memory grows until the process is OOM-killed.

**Fix:** Store sessions in MySQL so they are persisted and expired rows can be cleaned automatically.

**Steps:**

1. Install the store and types:
   ```bash
   npm install express-mysql-session
   npm install --save-dev @types/express-mysql-session
   ```

2. In your session configuration (e.g. `securityService.ts` or wherever `express-session` is set up):
   - Import the store factory and your DB pool:
     ```typescript
     import MySQLStoreFactory from 'express-mysql-session';
     import db from '../config/database';  // or your pool export
     ```
   - Before `app.use(session(sessionConfig))`, create the store and attach it:
     ```typescript
     const MySQLStore = MySQLStoreFactory(session);
     const sessionStore = new MySQLStore({
       expiration: 24 * 60 * 60 * 1000,   // match cookie maxAge (e.g. 24h)
       createDatabaseTable: true,         // auto-create `sessions` table
       clearExpired: true,
       checkExpirationInterval: 30 * 60 * 1000,  // cleanup every 30 min
     }, db.getPool());
     sessionConfig.store = sessionStore;
     ```

**Keep** `saveUninitialized: true` if you need it for CSRF/login; the DB store handles cleanup, so RAM growth is solved.

---

## 2. Stop creating DB rows on every anonymous request (CRITICAL)

**Problem:** Global middleware runs on every request. If it calls “get or create” for a guest cart/session resource, every bot and crawler gets a new row (e.g. in `shopping_carts`), causing thousands of rows per day.

**Fix:** In middleware that runs on every request, **only read** guest resources. Create the row only when the user performs an action (e.g. adds to cart).

**Pattern:**

- **Before:** For anonymous users, call `getOrCreateSessionCart(sessionId)` (which INSERTs if missing).
- **After:** For anonymous users, run a `SELECT` only; if no row exists, treat count as 0. Create the cart only in the “add to cart” handler.

Example for cart count in middleware:

```typescript
if (userId) {
  // Logged-in: get or create as before
  const cart = await cartService.getOrCreateCustomerCart(userId);
  // ...
} else {
  const [rows] = await db.query('SELECT id FROM shopping_carts WHERE session_id = ? LIMIT 1', [sessionId]);
  if (rows.length > 0) {
    const cartItems = await cartService.getCartItems(rows[0].id);
    res.locals.cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  } else {
    res.locals.cartCount = 0;
  }
}
```

Apply the same idea to any “get or create” for anonymous/session-scoped data used in global middleware.

---

## 3. Cache hot data in global middleware (HIGH)

**Problem:** Middleware that runs on every request (categories, featured products, etc.) hits the database every time, causing high load and contention.

**Fix:** Add a short in-memory TTL cache (e.g. 60 seconds) so the query runs at most once per TTL.

**Pattern:**

- Add cache state to the service that owns the middleware:
  ```typescript
  private categoryCache: { data: any[] | null; expires: number } = { data: null, expires: 0 };
  private readonly CACHE_TTL_MS = 60_000;
  ```
- Before querying, check `if (Date.now() >= this.categoryCache.expires)`, then run the query and set `this.categoryCache = { data: result, expires: Date.now() + this.CACHE_TTL_MS }`.
- Use `this.categoryCache.data` for the response (with a fallback for null).

Use the same pattern for any other per-request queries that return slowly changing data (categories, featured items, settings).

---

## 4. Add cleanup for growing tables (HIGH)

**Problem:** Tables like `order_status_history`, `transactions` (e.g. `pending`), or similar append-only/status tables are never pruned, so they grow indefinitely.

**Fix:** In your existing daily (or periodic) cleanup job, add targeted deletes:

- **Order history:** Delete rows linked to old orders (e.g. orders older than 2 years):
  ```sql
  DELETE osh FROM order_status_history osh
  JOIN orders o ON osh.order_id = o.id
  WHERE o.created_at < DATE_SUB(NOW(), INTERVAL 2 YEAR);
  ```
- **Stale pending records:** Delete abandoned records (e.g. `pending` transactions older than 7 days):
  ```sql
  DELETE FROM transactions
  WHERE status = 'pending' AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
  ```

Adjust table names, date columns, and intervals to match your schema and retention policy.

---

## 5. Fix O(n²) dashboard/report queries (MEDIUM)

**Problem:** A correlated subquery (e.g. “first order per customer”) that runs a subquery for every row in the outer table becomes very slow as data grows.

**Fix:** Rewrite using a derived table with `GROUP BY` so the database does one pass (or index-friendly scan) instead of N subqueries.

**Example – “new customers” (count of customers whose first order is in a date range):**

- **Before (correlated, O(n²)):**
  ```sql
  SELECT COUNT(DISTINCT customer_id) AS new_customers
  FROM orders o1
  WHERE o1.customer_id IS NOT NULL
    AND o1.created_at = (SELECT MIN(o2.created_at) FROM orders o2 WHERE o2.customer_id = o1.customer_id)
    AND DATE(o1.created_at) BETWEEN ? AND ?;
  ```
- **After (GROUP BY, O(n log n)):**
  ```sql
  SELECT COUNT(*) AS new_customers
  FROM (
    SELECT customer_id, MIN(created_at) AS first_order
    FROM orders
    WHERE customer_id IS NOT NULL
    GROUP BY customer_id
  ) first_orders
  WHERE DATE(first_order) BETWEEN ? AND ?;
  ```

Apply the same idea to any “per-row subquery” in reports or dashboards.

---

## 6. Non-blocking writes for non-critical updates (MEDIUM)

**Problem:** A synchronous DB write (e.g. “increment view count”) on every product page view blocks the response and holds a connection.

**Fix:** Call the update without `await` and attach `.catch(() => {})` so failures don’t throw. The response is sent immediately; the update runs in the background.

```typescript
// Don't await — fire and forget
productService.incrementViewCount(product.id).catch(() => {});
```

Use for high-volume, non-critical updates (view counts, lightweight analytics). Keep critical path updates awaited.

---

## 7. Orphan records: child table rows whose parent was deleted (MEDIUM)

**Problem:** Child tables (e.g. `page_photos` with `page_id`) can have rows whose parent row (e.g. `pages.id`) no longer exists if parents were deleted outside the app or before FK cascades were in place. This bloats tables and can confuse queries.

**Fix:** Periodically find and optionally delete orphan rows.

**Pattern:**

1. **Detection query** (LEFT JOIN; rows with no matching parent):
   ```sql
   SELECT child.id, child.parent_id, child.filename, ...
   FROM child_table child
   LEFT JOIN parent_table parent ON parent.id = child.parent_id
   WHERE parent.id IS NULL;
   ```

2. **One-off or scripted cleanup:** Run the query; if you want to delete, `DELETE FROM child_table WHERE id IN (list of ids)`.

3. **Script structure** (reusable for any child/parent pair):
   - Load env and DB (same as other scripts in the project).
   - Run the LEFT JOIN query.
   - Log count and optionally first N rows (avoid printing thousands of lines).
   - If `--fix` (or similar) is passed, delete by ID; support `--dry-run` to only report.

4. **Optional:** Add an npm script, e.g. `clean:page-photos` (report) and `clean:page-photos:fix` (delete).

**Prevention:** Prefer `ON DELETE CASCADE` (or application-level deletes that remove children when deleting the parent) so orphans are not created in the first place.

---

## Checklist for a new project

- [ ] Sessions: use DB (or Redis) session store, not MemoryStore.
- [ ] Global middleware: no “get or create” for anonymous/session resources; only SELECT for counts.
- [ ] Global middleware: cache categories/featured/settings with a short TTL.
- [ ] Cleanup job: prune old rows in history/transactions/status tables.
- [ ] Reports/dashboard: replace correlated subqueries with GROUP BY / derived tables.
- [ ] High-volume, non-critical writes: fire-and-forget where appropriate.
- [ ] Orphan check: identify child tables that reference parents; add a script to find (and optionally delete) orphans; consider FK with ON DELETE CASCADE for new tables.

---

## References in this project

- Session store: `src/services/securityService.ts` (configureSession).
- Cart SELECT-only + categories/featured cache: `src/services/middlewareService.ts`.
- Cleanup (carts, wishlists, order_status_history, transactions): `src/services/cleanupService.ts`.
- Dashboard query rewrite: `admin/services/reportsService.ts` (getCustomerAnalytics).
- View count fire-and-forget: `src/controllers/shopController.ts`.
- Orphan page_photos script: `scripts/clean-orphan-page-photos.ts`; npm: `clean:page-photos`, `clean:page-photos:fix`, `clean:page-photos:dry`.
