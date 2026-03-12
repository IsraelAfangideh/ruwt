/**
 * Ruwt Fit — D1/SQLite schema via Drizzle ORM.
 * Tables: profiles, user_goals, foods, meals, meal_items, exercises,
 *         workouts, workout_sets, body_logs, daily_logs,
 *         ai_logs, food_frequency, streaks
 */
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ---- Profiles (synced from Supabase auth) ----
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),                    // Supabase auth user ID
  email: text('email').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  timezone: text('timezone').default('UTC'),
  unitSystem: text('unit_system').default('imperial'),  // 'imperial' | 'metric'
  heightInches: real('height_inches'),
  birthYear: integer('birth_year'),
  sex: text('sex'),                                     // 'male' | 'female'
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ---- User Goals ----
export const userGoals = sqliteTable('user_goals', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => profiles.id),
  calorieTarget: integer('calorie_target').default(2000),
  proteinTarget: integer('protein_target').default(150),     // grams
  carbsTarget: integer('carbs_target').default(200),         // grams
  fatTarget: integer('fat_target').default(67),              // grams
  waterTarget: integer('water_target').default(8),           // cups
  weightGoal: real('weight_goal'),                           // target weight
  weightGoalUnit: text('weight_goal_unit').default('lbs'),   // 'lbs' | 'kg'
  activityLevel: text('activity_level').default('moderate'), // sedentary, light, moderate, active, very_active
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ---- Foods ----
export const foods = sqliteTable('foods', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  brand: text('brand'),
  servingSize: real('serving_size').notNull(),          // amount
  servingUnit: text('serving_unit').notNull(),          // 'g', 'oz', 'cup', 'piece', etc.
  calories: real('calories').notNull(),                 // per serving
  protein: real('protein').notNull(),                   // grams per serving
  carbs: real('carbs').notNull(),
  fat: real('fat').notNull(),
  fiber: real('fiber').default(0),
  sugar: real('sugar').default(0),
  sodium: real('sodium').default(0),                    // mg
  isCustom: integer('is_custom', { mode: 'boolean' }).default(false),
  createdBy: text('created_by').references(() => profiles.id),  // null = seeded
  category: text('category'),                           // 'fruit', 'meat', 'dairy', 'grain', etc.
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ---- Meals ----
export const meals = sqliteTable('meals', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => profiles.id),
  date: text('date').notNull(),                         // YYYY-MM-DD
  mealType: text('meal_type').notNull(),                // breakfast, lunch, dinner, snack
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ---- Meal Items ----
export const mealItems = sqliteTable('meal_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  mealId: text('meal_id').notNull().references(() => meals.id),
  foodId: text('food_id').notNull().references(() => foods.id),
  quantity: real('quantity').notNull(),                  // number of servings
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ---- Exercises ----
export const exercises = sqliteTable('exercises', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  category: text('category').notNull(),                 // 'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'flexibility'
  type: text('type').notNull(),                         // 'strength' | 'cardio' | 'flexibility'
  muscleGroup: text('muscle_group'),                    // primary muscle group
  isCustom: integer('is_custom', { mode: 'boolean' }).default(false),
  createdBy: text('created_by').references(() => profiles.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ---- Workouts ----
export const workouts = sqliteTable('workouts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => profiles.id),
  name: text('name').notNull(),
  date: text('date').notNull(),                         // YYYY-MM-DD
  durationMinutes: integer('duration_minutes'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ---- Workout Sets ----
export const workoutSets = sqliteTable('workout_sets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workoutId: text('workout_id').notNull().references(() => workouts.id),
  exerciseId: text('exercise_id').notNull().references(() => exercises.id),
  setNumber: integer('set_number').notNull(),
  reps: integer('reps'),                                // for strength
  weight: real('weight'),                               // for strength (lbs or kg)
  weightUnit: text('weight_unit').default('lbs'),
  durationSeconds: integer('duration_seconds'),         // for cardio/flexibility
  distanceMiles: real('distance_miles'),                // for cardio
  caloriesBurned: real('calories_burned'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ---- Body Logs (weight/body fat tracking) ----
export const bodyLogs = sqliteTable('body_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => profiles.id),
  date: text('date').notNull(),                         // YYYY-MM-DD
  weight: real('weight'),                               // lbs or kg
  weightUnit: text('weight_unit').default('lbs'),
  bodyFatPct: real('body_fat_pct'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ---- Daily Logs (auto-aggregated) ----
export const dailyLogs = sqliteTable('daily_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => profiles.id),
  date: text('date').notNull(),                         // YYYY-MM-DD
  totalCalories: real('total_calories').default(0),
  totalProtein: real('total_protein').default(0),
  totalCarbs: real('total_carbs').default(0),
  totalFat: real('total_fat').default(0),
  totalFiber: real('total_fiber').default(0),
  totalSugar: real('total_sugar').default(0),
  totalSodium: real('total_sodium').default(0),
  waterCups: integer('water_cups').default(0),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ---- AI Logs ----
export const aiLogs = sqliteTable('ai_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => profiles.id),
  type: text('type').notNull(),               // 'parse_meal', 'coach', 'suggest', 'insight', 'workout_gen'
  inputText: text('input_text').notNull(),
  outputJson: text('output_json'),
  model: text('model'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ---- Food Frequency (recent/frequent foods per user) ----
export const foodFrequency = sqliteTable('food_frequency', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => profiles.id),
  foodId: text('food_id').notNull().references(() => foods.id),
  useCount: integer('use_count').default(1),
  lastUsed: text('last_used').default(sql`(datetime('now'))`),
});

// ---- Streaks ----
export const streaks = sqliteTable('streaks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => profiles.id),
  currentStreak: integer('current_streak').default(0),
  longestStreak: integer('longest_streak').default(0),
  lastLogDate: text('last_log_date'),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// Type exports
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type UserGoal = typeof userGoals.$inferSelect;
export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;
export type Meal = typeof meals.$inferSelect;
export type MealItem = typeof mealItems.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutSet = typeof workoutSets.$inferSelect;
export type BodyLog = typeof bodyLogs.$inferSelect;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type AiLog = typeof aiLogs.$inferSelect;
export type FoodFreq = typeof foodFrequency.$inferSelect;
export type Streak = typeof streaks.$inferSelect;
