CREATE TABLE IF NOT EXISTS "anonymous_users" (
	"anonymous_user_id" text PRIMARY KEY NOT NULL,
	"first_seen_at" timestamp DEFAULT now(),
	"last_seen_at" timestamp DEFAULT now(),
	"first_runner_name" text,
	"first_ip_address" text,
	"first_user_agent" text,
	"platform" text,
	"app_version" text,
	"locale" text,
	"timezone" text
);
