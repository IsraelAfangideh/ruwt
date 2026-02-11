-- D1 (SQLite) initial schema for ruwt-dev
CREATE TABLE IF NOT EXISTS `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`avatar_url` text,
	`credits` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `profiles_email_unique` ON `profiles` (`email`);
CREATE TABLE IF NOT EXISTS `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`difficulty` text NOT NULL,
	`starter_code` text,
	`test_cases` text NOT NULL,
	`exec_time_limit` integer DEFAULT 5000,
	`exec_memory_limit` integer DEFAULT 256,
	`max_tokens` integer,
	`max_cost` integer,
	`wall_clock_limit` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
CREATE TABLE IF NOT EXISTS `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`challenge_id` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`total_cost` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`final_code` text,
	`passed_tests` integer DEFAULT 0 NOT NULL,
	`total_tests` integer DEFAULT 0 NOT NULL,
	`expires_at` text,
	`violated_constraint` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`submitted_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`),
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`)
);
CREATE TABLE IF NOT EXISTS `ai_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cost` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`)
);
CREATE TABLE IF NOT EXISTS `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`stripe_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`)
);
