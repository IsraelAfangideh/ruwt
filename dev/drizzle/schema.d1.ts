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
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
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
export type Assessment = typeof assessments.$inferSelect;
export type NewAssessment = typeof assessments.$inferInsert;
export type AssessmentChallenge = typeof assessmentChallenges.$inferSelect;
export type NewAssessmentChallenge = typeof assessmentChallenges.$inferInsert;
export type AssessmentInvite = typeof assessmentInvites.$inferSelect;
export type NewAssessmentInvite = typeof assessmentInvites.$inferInsert;
export type AssessmentSession = typeof assessmentSessions.$inferSelect;
export type NewAssessmentSession = typeof assessmentSessions.$inferInsert;
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

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';
export type OrgInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type CustomChallengeStatus = 'draft' | 'active' | 'archived';
export type EmailType = 'candidate_invite' | 'reminder' | 'results_ready' | 'team_invite';

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
