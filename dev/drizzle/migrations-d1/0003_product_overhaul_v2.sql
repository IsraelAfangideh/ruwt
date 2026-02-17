-- 0003_product_overhaul_v2.sql
-- Add BYOK tracking, challenge tiers, and public profile usernames.

ALTER TABLE attempts ADD COLUMN used_byok INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE challenges ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE challenges ADD COLUMN tier TEXT DEFAULT 'core';
ALTER TABLE profiles ADD COLUMN username TEXT UNIQUE;
