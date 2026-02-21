-- Add server-side test harness column
-- Contains solve() dispatch code that gets appended to user code at runtime
-- Never exposed to client or AI
ALTER TABLE challenges ADD COLUMN test_harness TEXT;
