-- Migration: Add assessment platform tables and columns
-- Run: npx wrangler d1 execute ruwt-dev --remote --file=./drizzle/migrations-d1/0001_assessments.sql

-- Modify existing tables
ALTER TABLE `profiles` ADD COLUMN `account_type` text DEFAULT 'individual' NOT NULL;
ALTER TABLE `profiles` ADD COLUMN `assessment_credits` integer DEFAULT 0 NOT NULL;

ALTER TABLE `challenges` ADD COLUMN `category` text DEFAULT 'practice';
ALTER TABLE `challenges` ADD COLUMN `skill_tested` text;

ALTER TABLE `attempts` ADD COLUMN `assessment_session_id` text;

-- New tables: assessments
CREATE TABLE IF NOT EXISTS `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`time_limit` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `profiles`(`id`)
);

-- New tables: assessment_challenges (join table)
CREATE TABLE IF NOT EXISTS `assessment_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`challenge_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`),
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`)
);
CREATE UNIQUE INDEX IF NOT EXISTS `assessment_challenges_unique` ON `assessment_challenges` (`assessment_id`, `challenge_id`);

-- New tables: assessment_invites
CREATE TABLE IF NOT EXISTS `assessment_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`candidate_email` text,
	`token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`)
);
CREATE UNIQUE INDEX IF NOT EXISTS `assessment_invites_token_unique` ON `assessment_invites` (`token`);

-- New tables: assessment_sessions
CREATE TABLE IF NOT EXISTS `assessment_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`invite_id` text,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`current_challenge_index` integer DEFAULT 0 NOT NULL,
	`total_cost` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	`expires_at` text NOT NULL,
	`share_token` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`),
	FOREIGN KEY (`invite_id`) REFERENCES `assessment_invites`(`id`),
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`)
);
CREATE UNIQUE INDEX IF NOT EXISTS `assessment_sessions_share_token_unique` ON `assessment_sessions` (`share_token`);
