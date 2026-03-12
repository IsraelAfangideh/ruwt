-- Add missing indexes for foreign key lookups
CREATE INDEX IF NOT EXISTS idx_meal_items_food_id ON meal_items(food_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise_id ON workout_sets(exercise_id);
