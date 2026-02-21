-- 0024_subscriptions.sql
-- Add subscription fields to organizations for flat-rate monthly billing.
-- Replaces per-assessment credit packs with unlimited subscription model.

ALTER TABLE organizations ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE organizations ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE organizations ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE organizations ADD COLUMN subscription_plan TEXT;
ALTER TABLE organizations ADD COLUMN subscription_ends_at TEXT;

CREATE INDEX IF NOT EXISTS idx_orgs_stripe_customer ON organizations(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_orgs_stripe_subscription ON organizations(stripe_subscription_id);
