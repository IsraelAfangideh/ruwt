-- Record where a signup came from.
--
-- Three people signed up in eight days with no outbound, and nothing in the
-- product could say where any of them came from: no referrer capture, no UTM
-- parsing, and no analytics beacon. These columns close that gap.
--
-- First-touch, not last-touch. The client captures on the first page load and
-- the server writes once, because a GitHub OAuth round trip destroys
-- document.referrer — by the time a profile row exists, the referrer reads
-- github.com for everyone.
--
-- NULL means "signed up before this shipped", not "direct". A direct visit
-- records referrer = 'direct'.

ALTER TABLE profiles ADD COLUMN referrer TEXT;
ALTER TABLE profiles ADD COLUMN utm_source TEXT;
ALTER TABLE profiles ADD COLUMN utm_medium TEXT;
ALTER TABLE profiles ADD COLUMN utm_campaign TEXT;
ALTER TABLE profiles ADD COLUMN landing_path TEXT;
ALTER TABLE profiles ADD COLUMN attributed_at TEXT;
