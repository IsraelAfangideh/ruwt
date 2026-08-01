/**
 * D1 (SQLite) schema for Cloudflare Pages Functions.
 * Use TEXT for UUIDs and enums; JSON stored as TEXT.
 * Timestamps stored as ISO strings for compatibility.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  credits: integer('credits').default(0).notNull(),
  accountType: text('account_type').default('individual').notNull(), // 'individual' | 'team'
  assessmentCredits: integer('assessment_credits').default(0).notNull(),
  username: text('username').unique(),
  bio: text('bio'),
  linkedinUrl: text('linkedin_url'),
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  lastStreakDate: text('last_streak_date'), // YYYY-MM-DD of last daily solve
  streakFreezes: integer('streak_freezes').default(0).notNull(),
  onboardingCompleted: integer('onboarding_completed').default(0).notNull(),
  newsletterSubscribed: integer('newsletter_subscribed').default(1).notNull(),
  timezone: text('timezone'), // IANA timezone (e.g., 'America/New_York'), captured from Cloudflare request.cf
  leaderboardExcluded: integer('leaderboard_excluded').default(0).notNull(), // 1 = hidden from leaderboard (QA/system accounts)
  trialUsed: integer('trial_used').default(0).notNull(), // 1 = user has used their free trial (prevents re-trial after org deletion)
  preferredMode: text('preferred_mode'), // 'practice' | 'hiring' — persists mode switcher state
  afiScore: integer('afi_score').default(0).notNull(), // Cached AFI score (0-850), updated on each solve
  afiTier: text('afi_tier').default('novice').notNull(), // Cached AFI tier label
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const afiHistory = sqliteTable('afi_history', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id),
  score: integer('score').notNull(),
  tier: text('tier').notNull(),
  solveCount: integer('solve_count').default(0).notNull(),
  recordedAt: text('recorded_at').default(sql`(datetime('now'))`).notNull(),
});

export const challenges = sqliteTable('challenges', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  difficulty: text('difficulty').notNull(), // 'easy' | 'medium' | 'hard'
  starterCode: text('starter_code'),
  testCases: text('test_cases').notNull(), // JSON string
  hiddenTestCases: text('hidden_test_cases'), // JSON string, same format as testCases
  testHarness: text('test_harness'), // JS/Python code appended server-side before execution
  readonlyPrefix: text('readonly_prefix'), // Code prepended server-side before execution (not editable by user/AI)
  useStdin: integer('use_stdin').default(0).notNull(), // 1 = stdin/stdout mode, 0 = function-call mode

  execTimeLimit: integer('exec_time_limit').default(5000),
  execMemoryLimit: integer('exec_memory_limit').default(256),

  maxTokens: integer('max_tokens'),
  maxCost: integer('max_cost'),
  wallClockLimit: integer('wall_clock_limit'),

  category: text('category').default('practice'), // 'practice' | 'model_selection' | 'prompt_efficiency' | 'iterative_debugging'
  skillTested: text('skill_tested'),

  sortOrder: integer('sort_order').default(0),
  tier: text('tier').default('core'), // 'onboarding' | 'core' | 'headline'

  language: text('language').default('javascript'), // 'javascript' | 'typescript' | 'python'
  tags: text('tags'), // JSON array: ["backend","async","testing"]

  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const attempts = sqliteTable('attempts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id),
  challengeId: text('challenge_id').notNull().references(() => challenges.id),
  status: text('status').default('in_progress').notNull(),
  totalCost: integer('total_cost').default(0).notNull(),
  inputTokens: integer('input_tokens').default(0).notNull(),
  outputTokens: integer('output_tokens').default(0).notNull(),
  finalCode: text('final_code'),
  passedTests: integer('passed_tests').default(0).notNull(),
  totalTests: integer('total_tests').default(0).notNull(),

  expiresAt: text('expires_at'),
  violatedConstraint: text('violated_constraint'),

  assessmentSessionId: text('assessment_session_id'),
  replayPublic: integer('replay_public').default(1).notNull(),
  usedByok: integer('used_byok').default(0).notNull(),
  usedHosted: integer('used_hosted').default(0).notNull(),

  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  submittedAt: text('submitted_at'),
});

export const aiCalls = sqliteTable('ai_calls', {
  id: text('id').primaryKey(),
  attemptId: text('attempt_id').notNull().references(() => attempts.id),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  cost: integer('cost').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id),
  type: text('type').notNull(), // 'purchase' | 'ai_usage' | 'refund' | 'signup_bonus' | 'assessment_purchase'
  amount: integer('amount').notNull(),
  stripeId: text('stripe_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Organizations ---

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
  domain: text('domain'),
  createdBy: text('created_by').notNull().references(() => profiles.id),
  assessmentCredits: integer('assessment_credits').default(0).notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionStatus: text('subscription_status').default('none').notNull(), // 'none' | 'active' | 'past_due' | 'canceled'
  subscriptionPlan: text('subscription_plan'), // 'monthly' | 'annual'
  subscriptionEndsAt: text('subscription_ends_at'),
  trialStartedAt: text('trial_started_at'),
  trialEndsAt: text('trial_ends_at'),
  trialAssessmentsUsed: integer('trial_assessments_used').default(0).notNull(),
  trialInvitesUsed: integer('trial_invites_used').default(0).notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const orgMembers = sqliteTable('org_members', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  userId: text('user_id').notNull().references(() => profiles.id),
  role: text('role').default('member').notNull(), // 'owner' | 'admin' | 'member' | 'viewer'
  invitedBy: text('invited_by').references(() => profiles.id),
  joinedAt: text('joined_at').default(sql`(datetime('now'))`).notNull(),
});

export const orgInvitations = sqliteTable('org_invitations', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  email: text('email').notNull(),
  role: text('role').default('member').notNull(),
  token: text('token').notNull().unique(),
  status: text('status').default('pending').notNull(), // 'pending' | 'accepted' | 'expired' | 'revoked'
  expiresAt: text('expires_at').notNull(),
  createdBy: text('created_by').notNull().references(() => profiles.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Custom Challenges (org-owned) ---

export const customChallenges = sqliteTable('custom_challenges', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  difficulty: text('difficulty').default('medium').notNull(),
  starterCode: text('starter_code'),
  testCases: text('test_cases').notNull(), // JSON string
  hiddenTestCases: text('hidden_test_cases'), // JSON string
  testHarness: text('test_harness'),
  execTimeLimit: integer('exec_time_limit').default(5000),
  execMemoryLimit: integer('exec_memory_limit').default(256),
  category: text('category').default('practice'),
  skillTested: text('skill_tested'),
  language: text('language').default('javascript'),
  tags: text('tags'), // JSON array
  status: text('status').default('draft').notNull(), // 'draft' | 'active' | 'archived'
  createdBy: text('created_by').notNull().references(() => profiles.id),
  reviewedBy: text('reviewed_by').references(() => profiles.id),
  reviewedAt: text('reviewed_at'),
  aiGenerated: integer('ai_generated').default(0).notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Email & Agent Logs ---

export const emailLogs = sqliteTable('email_logs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'candidate_invite' | 'reminder' | 'results_ready' | 'team_invite'
  recipientEmail: text('recipient_email').notNull(),
  assessmentId: text('assessment_id').references(() => assessments.id),
  inviteId: text('invite_id'),
  subject: text('subject').notNull(),
  status: text('status').notNull(), // 'sent' | 'failed'
  errorMessage: text('error_message'),
  sentAt: text('sent_at').default(sql`(datetime('now'))`).notNull(),
});

export const agentConversations = sqliteTable('agent_conversations', {
  id: text('id').primaryKey(),
  assessmentId: text('assessment_id').references(() => assessments.id),
  orgId: text('org_id').references(() => organizations.id),
  userId: text('user_id').notNull().references(() => profiles.id),
  messages: text('messages').default('[]').notNull(), // JSON array
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Assessment tables ---

export const assessments = sqliteTable('assessments', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  timeLimit: integer('time_limit').notNull(), // seconds
  status: text('status').default('draft').notNull(), // 'draft' | 'active' | 'archived'
  createdBy: text('created_by').notNull().references(() => profiles.id),
  categoryWeights: text('category_weights'), // JSON: { modelSelection: number, promptEfficiency: number, debugging: number, strategy: number, speed: number }
  companyName: text('company_name'),
  companyLogoUrl: text('company_logo_url'),
  welcomeMessage: text('welcome_message'),
  orgId: text('org_id').references(() => organizations.id),
  passThreshold: text('pass_threshold'), // JSON: { enabled, mode, dimensions, minOverall? }
  type: text('type').default('challenge_based').notNull(), // 'challenge_based' | 'takehome'
  repoUrl: text('repo_url'),
  repoToken: text('repo_token'),
  instructions: text('instructions'),
  allowedModels: text('allowed_models'), // JSON array of model IDs
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const assessmentTelemetry = sqliteTable('assessment_telemetry', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => assessmentSessions.id),
  eventType: text('event_type').notNull(), // 'ai_call' | 'file_change' | 'test_run'
  data: text('data').default('{}').notNull(), // JSON
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const assessmentChallenges = sqliteTable('assessment_challenges', {
  id: text('id').primaryKey(),
  assessmentId: text('assessment_id').notNull().references(() => assessments.id),
  challengeId: text('challenge_id').notNull().references(() => challenges.id),
  customChallengeId: text('custom_challenge_id').references(() => customChallenges.id),
  sortOrder: integer('sort_order').default(0).notNull(),
});

export const assessmentInvites = sqliteTable('assessment_invites', {
  id: text('id').primaryKey(),
  assessmentId: text('assessment_id').notNull().references(() => assessments.id),
  candidateEmail: text('candidate_email'),
  candidateName: text('candidate_name'),
  token: text('token').notNull().unique(),
  status: text('status').default('pending').notNull(), // 'pending' | 'started' | 'completed' | 'expired'
  expiresAt: text('expires_at'),
  lastReminderAt: text('last_reminder_at'),
  reminderCount: integer('reminder_count').default(0).notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const assessmentSessions = sqliteTable('assessment_sessions', {
  id: text('id').primaryKey(),
  assessmentId: text('assessment_id').notNull().references(() => assessments.id),
  inviteId: text('invite_id').references(() => assessmentInvites.id),
  userId: text('user_id').notNull().references(() => profiles.id),
  status: text('status').default('in_progress').notNull(), // 'in_progress' | 'completed' | 'expired' | 'abandoned'
  currentChallengeIndex: integer('current_challenge_index').default(0).notNull(),
  totalCost: integer('total_cost').default(0).notNull(),
  totalTokens: integer('total_tokens').default(0).notNull(),
  startedAt: text('started_at').default(sql`(datetime('now'))`).notNull(),
  completedAt: text('completed_at'),
  expiresAt: text('expires_at').notNull(),
  shareToken: text('share_token').unique(),
  replayR2Key: text('replay_r2_key'),
  disclosureAccepted: integer('disclosure_accepted').default(0).notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Replay / message history ---

export const attemptMessages = sqliteTable('attempt_messages', {
  id: text('id').primaryKey(),
  attemptId: text('attempt_id').notNull().references(() => attempts.id),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  model: text('model'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  cost: integer('cost'),
  codeSnapshot: text('code_snapshot'),
  sequence: integer('sequence').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Seasons ---

export const seasons = sqliteTable('seasons', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  startsAt: text('starts_at').notNull(),
  endsAt: text('ends_at').notNull(),
  status: text('status').default('upcoming'), // 'upcoming' | 'active' | 'completed'
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// --- Daily Challenges ---

export const dailyChallenges = sqliteTable('daily_challenges', {
  id: text('id').primaryKey(),
  challengeId: text('challenge_id').notNull().references(() => challenges.id),
  date: text('date').notNull().unique(),
  seasonId: text('season_id').references(() => seasons.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// --- Replay Comments ---

export const replayComments = sqliteTable('replay_comments', {
  id: text('id').primaryKey(),
  attemptId: text('attempt_id').notNull().references(() => attempts.id),
  userId: text('user_id').notNull().references(() => profiles.id),
  content: text('content').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// --- Challenge Comments ---

export const challengeComments = sqliteTable('challenge_comments', {
  id: text('id').primaryKey(),
  challengeId: text('challenge_id').notNull().references(() => challenges.id),
  userId: text('user_id').notNull().references(() => profiles.id),
  content: text('content').notNull(),
  solveCost: integer('solve_cost'),
  parentId: text('parent_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Reactions ---

export const reactions = sqliteTable('reactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id),
  targetType: text('target_type').notNull(), // 'challenge_comment' | 'replay_comment'
  targetId: text('target_id').notNull(),
  emoji: text('emoji').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Certificates ---

export const certificates = sqliteTable('certificates', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id),
  type: text('type').notNull(), // 'track_completion' | 'daily_streak' | 'efficiency_master'
  title: text('title').notNull(),
  metadata: text('metadata'), // JSON
  shareToken: text('share_token').unique(),
  earnedAt: text('earned_at').default(sql`(datetime('now'))`),
});

// --- Badges / Achievements ---

export const badges = sqliteTable('badges', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id),
  badgeType: text('badge_type').notNull(), // e.g. 'first_solve', 'streak_7', 'penny_pincher'
  title: text('title').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(), // emoji or icon key
  metadata: text('metadata'), // JSON — extra context like { streak: 30, challengeId: '...' }
  earnedAt: text('earned_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Error Monitoring ---

export const errorLogs = sqliteTable('error_logs', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').default(sql`(datetime('now'))`).notNull(),
  level: text('level').notNull().default('error'),
  endpoint: text('endpoint'),
  method: text('method'),
  userId: text('user_id'),
  errorMessage: text('error_message').notNull(),
  errorStack: text('error_stack'),
  requestBody: text('request_body'),
  suggestedFix: text('suggested_fix'),
  emailSent: integer('email_sent').notNull().default(0),
  resolved: integer('resolved').notNull().default(0),
  metadata: text('metadata'),
});

// --- Newsletter ---

export const newsletterLogs = sqliteTable('newsletter_logs', {
  id: text('id').primaryKey(),
  recipientEmail: text('recipient_email').notNull(),
  subject: text('subject').notNull(),
  status: text('status').notNull(), // 'sent' | 'failed'
  errorMessage: text('error_message'),
  htmlBody: text('html_body'),
  textBody: text('text_body'),
  resendId: text('resend_id'),
  userId: text('user_id'),
  userState: text('user_state'),
  personalHook: text('personal_hook'),
  digestType: text('digest_type').default('daily'), // 'daily' | 'weekly' | 'streak_nudge' | 'dormant_alert'
  sentAt: text('sent_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Notifications ---

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id),
  type: text('type').notNull(), // 'badge_earned' | 'streak_reminder' | 'leaderboard_change' | 'new_challenge' | 'competitive_nudge'
  title: text('title').notNull(),
  body: text('body').notNull(),
  metadata: text('metadata'), // JSON — link targets, badge IDs, etc.
  read: integer('read').default(0).notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Follows ---

export const follows = sqliteTable('follows', {
  id: text('id').primaryKey(),
  followerId: text('follower_id').notNull().references(() => profiles.id),
  followingId: text('following_id').notNull().references(() => profiles.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Bookmarks ---

export const bookmarks = sqliteTable('bookmarks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id),
  targetType: text('target_type').notNull(), // 'challenge' | 'replay'
  targetId: text('target_id').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Cloud Machines (Cloud Mode) ---

export const cloudMachines = sqliteTable('cloud_machines', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id),
  flyMachineId: text('fly_machine_id').notNull(),
  bridgeToken: text('bridge_token').notNull(),
  spec: text('spec').default('light').notNull(), // 'light' | 'medium' | 'heavy'
  status: text('status').default('stopped').notNull(), // 'running' | 'stopped'
  region: text('region').default('iad').notNull(),
  lastActiveAt: text('last_active_at').default(sql`(datetime('now'))`),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// --- Projects (IDE persistence) ---

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id),
  name: text('name').notNull().default('Untitled Project'),
  description: text('description').default(''),
  r2Key: text('r2_key').notNull(),
  language: text('language').default('javascript'),
  fileCount: integer('file_count').default(0),
  sizeBytes: integer('size_bytes').default(0),
  lastOpenedAt: text('last_opened_at').default(sql`(datetime('now'))`),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// --- Pilot leads (hiring-manager wedge captures) ---

export const pilotLeads = sqliteTable('pilot_leads', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  company: text('company'),
  role: text('role'),
  hiresPerYear: integer('hires_per_year'),
  currentTool: text('current_tool'),
  notes: text('notes'),
  source: text('source').default('for-hiring-managers'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  status: text('status').default('new').notNull(), // 'new' | 'contacted' | 'qualified' | 'rejected'
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Notification Preferences ---

export const notificationPreferences = sqliteTable('notification_preferences', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id),
  badgeEarned: integer('badge_earned').default(1).notNull(),
  streakReminder: integer('streak_reminder').default(1).notNull(),
  leaderboardChange: integer('leaderboard_change').default(1).notNull(),
  newChallenge: integer('new_challenge').default(1).notNull(),
  competitiveNudge: integer('competitive_nudge').default(1).notNull(),
  commentReply: integer('comment_reply').default(1).notNull(),
  commentOnSolved: integer('comment_on_solved').default(1).notNull(),
  replayComment: integer('replay_comment').default(1).notNull(),
  reactionReceived: integer('reaction_received').default(1).notNull(),
  mention: integer('mention').default(1).notNull(),
  newFollower: integer('new_follower').default(1).notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Agentic Engineering Intelligence ---

export const featureFlags = sqliteTable('feature_flags', {
  key: text('key').primaryKey(),
  enabled: integer('enabled').default(0).notNull(),
  description: text('description').notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

export const ingestionApiKeys = sqliteTable('ingestion_api_keys', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  scopes: text('scopes').default('["telemetry:write"]').notNull(),
  expiresAt: text('expires_at'),
  lastUsedAt: text('last_used_at'),
  revokedAt: text('revoked_at'),
  createdBy: text('created_by').notNull().references(() => profiles.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const desktopInstallations = sqliteTable('desktop_installations', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  userId: text('user_id').references(() => profiles.id),
  platform: text('platform').notNull(),
  appVersion: text('app_version').notNull(),
  syncState: text('sync_state').default('unknown').notNull(),
  lastSeenAt: text('last_seen_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const telemetryEvents = sqliteTable('telemetry_events', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  actorId: text('actor_id'),
  sessionId: text('session_id'),
  correlationId: text('correlation_id'),
  desktopInstallationId: text('desktop_installation_id').references(() => desktopInstallations.id),
  eventType: text('event_type').notNull(),
  eventTimestamp: text('event_timestamp').notNull(),
  ingestedAt: text('ingested_at').default(sql`(datetime('now'))`).notNull(),
  integrationSource: text('integration_source').notNull(),
  adapterVersion: text('adapter_version').notNull(),
  agentVendor: text('agent_vendor'),
  modelProvider: text('model_provider'),
  modelName: text('model_name'),
  repository: text('repository'),
  branch: text('branch'),
  taskCategory: text('task_category'),
  fileClassification: text('file_classification'),
  commandClassification: text('command_classification'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  estimatedCostMicros: integer('estimated_cost_micros'),
  durationMs: integer('duration_ms'),
  outcome: text('outcome'),
  testResult: text('test_result'),
  policyResult: text('policy_result'),
  redactionStatus: text('redaction_status').notNull(),
  confidence: text('confidence').notNull(),
  metadata: text('metadata').default('{}').notNull(),
});

export const intelligencePolicies = sqliteTable('intelligence_policies', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description').notNull(),
  ruleType: text('rule_type').notNull(),
  severity: text('severity').notNull(),
  configuration: text('configuration').notNull(),
  mode: text('mode').default('detect').notNull(),
  enabled: integer('enabled').default(1).notNull(),
  createdBy: text('created_by').notNull().references(() => profiles.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

export const policyViolations = sqliteTable('policy_violations', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  policyId: text('policy_id').notNull().references(() => intelligencePolicies.id),
  eventId: text('event_id').notNull().references(() => telemetryEvents.id),
  severity: text('severity').notNull(),
  status: text('status').default('open').notNull(),
  evidence: text('evidence').notNull(),
  detectedAt: text('detected_at').default(sql`(datetime('now'))`).notNull(),
  resolvedAt: text('resolved_at'),
});

export const intelligenceInsights = sqliteTable('intelligence_insights', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  ruleId: text('rule_id').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  evidence: text('evidence').notNull(),
  confidence: text('confidence').notNull(),
  coverage: integer('coverage').notNull(),
  generatedAt: text('generated_at').default(sql`(datetime('now'))`).notNull(),
});

export const intelligenceAuditLogs = sqliteTable('intelligence_audit_logs', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  actorId: text('actor_id'),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  metadata: text('metadata').default('{}').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// --- Type exports ---

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Challenge = typeof challenges.$inferSelect;
export type NewChallenge = typeof challenges.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
export type AiCall = typeof aiCalls.$inferSelect;
export type NewAiCall = typeof aiCalls.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type PilotLead = typeof pilotLeads.$inferSelect;
export type NewPilotLead = typeof pilotLeads.$inferInsert;
export type Assessment = typeof assessments.$inferSelect;
export type NewAssessment = typeof assessments.$inferInsert;
export type AssessmentChallenge = typeof assessmentChallenges.$inferSelect;
export type NewAssessmentChallenge = typeof assessmentChallenges.$inferInsert;
export type AssessmentInvite = typeof assessmentInvites.$inferSelect;
export type NewAssessmentInvite = typeof assessmentInvites.$inferInsert;
export type AssessmentSession = typeof assessmentSessions.$inferSelect;
export type NewAssessmentSession = typeof assessmentSessions.$inferInsert;
export type AssessmentTelemetry = typeof assessmentTelemetry.$inferSelect;
export type NewAssessmentTelemetry = typeof assessmentTelemetry.$inferInsert;
export type AttemptMessage = typeof attemptMessages.$inferSelect;
export type NewAttemptMessage = typeof attemptMessages.$inferInsert;

export type Difficulty = 'sprint' | 'easy' | 'medium' | 'hard' | 'impossible';
export type AttemptStatus = 'in_progress' | 'submitted' | 'passed' | 'failed' | 'constraint_violated';
export type TransactionType = 'purchase' | 'ai_usage' | 'refund' | 'signup_bonus' | 'assessment_purchase';
export type ConstraintType = 'tokens' | 'cost' | 'time';
export type ChallengeCategory = 'practice' | 'model_selection' | 'prompt_efficiency' | 'iterative_debugging' | 'multi_model_strategy' | 'real_world' | 'qa_testing' | 'frontend' | 'backend_api' | 'data_engineering' | 'devops';
export type ChallengeLanguage = 'javascript' | 'typescript' | 'python';
export type CertificateType = 'track_completion' | 'daily_streak' | 'efficiency_master';
export type BadgeType = 'first_solve' | 'streak_3' | 'streak_7' | 'streak_30' | 'streak_100' | 'penny_pincher' | 'speed_demon' | 'model_master' | 'polyglot' | 'clean_sweep_easy' | 'clean_sweep_medium' | 'ten_solves' | 'twenty_five_solves' | 'fifty_solves' | 'daily_warrior';
export type NotificationType = 'badge_earned' | 'streak_reminder' | 'leaderboard_change' | 'new_challenge' | 'competitive_nudge' | 'comment_reply' | 'comment_on_solved' | 'replay_comment' | 'reaction_received' | 'mention' | 'new_follower';
export type AssessmentStatus = 'draft' | 'active' | 'archived';
export type InviteStatus = 'pending' | 'started' | 'completed' | 'expired';
export type SessionStatus = 'in_progress' | 'completed' | 'expired' | 'abandoned';
export type AccountType = 'individual' | 'team';
export type SeasonStatus = 'upcoming' | 'active' | 'completed';
export type ChallengeTier = 'onboarding' | 'core' | 'headline';

export type Season = typeof seasons.$inferSelect;
export type NewSeason = typeof seasons.$inferInsert;
export type DailyChallenge = typeof dailyChallenges.$inferSelect;
export type NewDailyChallenge = typeof dailyChallenges.$inferInsert;
export type ReplayComment = typeof replayComments.$inferSelect;
export type NewReplayComment = typeof replayComments.$inferInsert;
export type Certificate = typeof certificates.$inferSelect;
export type NewCertificate = typeof certificates.$inferInsert;
export type Badge = typeof badges.$inferSelect;
export type NewBadge = typeof badges.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NewsletterLog = typeof newsletterLogs.$inferSelect;
export type NewNewsletterLog = typeof newsletterLogs.$inferInsert;
export type ChallengeComment = typeof challengeComments.$inferSelect;
export type NewChallengeComment = typeof challengeComments.$inferInsert;
export type Reaction = typeof reactions.$inferSelect;
export type NewReaction = typeof reactions.$inferInsert;
export type ReactionEmoji = 'thumbs_up' | 'fire' | 'brain' | 'heart' | 'eyes' | 'rocket';
export type ReactionTargetType = 'challenge_comment' | 'replay_comment';
export type NewsletterStatus = 'sent' | 'failed';
export type ErrorLog = typeof errorLogs.$inferSelect;
export type NewErrorLog = typeof errorLogs.$inferInsert;
export type ErrorLevel = 'error' | 'warn' | 'fatal';

// Org & hiring platform types
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrgMember = typeof orgMembers.$inferSelect;
export type NewOrgMember = typeof orgMembers.$inferInsert;
export type OrgInvitation = typeof orgInvitations.$inferSelect;
export type NewOrgInvitation = typeof orgInvitations.$inferInsert;
export type CustomChallenge = typeof customChallenges.$inferSelect;
export type NewCustomChallenge = typeof customChallenges.$inferInsert;
export type EmailLog = typeof emailLogs.$inferSelect;
export type NewEmailLog = typeof emailLogs.$inferInsert;
export type AgentConversation = typeof agentConversations.$inferSelect;
export type NewAgentConversation = typeof agentConversations.$inferInsert;

export type Follow = typeof follows.$inferSelect;
export type NewFollow = typeof follows.$inferInsert;
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
export type BookmarkTargetType = 'challenge' | 'replay';

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type CloudMachine = typeof cloudMachines.$inferSelect;
export type NewCloudMachine = typeof cloudMachines.$inferInsert;

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';
export type OrgInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type CustomChallengeStatus = 'draft' | 'active' | 'archived';
export type EmailType = 'candidate_invite' | 'reminder' | 'results_ready' | 'team_invite';
export type AssessmentType = 'challenge_based' | 'takehome';
export type TelemetryEventType = 'ai_call' | 'file_change' | 'test_run';
export type MachineSpec = 'light' | 'medium' | 'heavy';
export type MachineStatus = 'running' | 'stopped';
export type IntelligenceEvent = typeof telemetryEvents.$inferSelect;
export type NewIntelligenceEvent = typeof telemetryEvents.$inferInsert;

export interface PassThreshold {
  enabled: boolean;
  mode: 'all_dimensions' | 'weighted_average';
  minOverall?: number;
  dimensions: {
    modelSelection: number;
    promptEfficiency: number;
    debugging: number;
    strategy: number;
    speed: number;
  };
}
