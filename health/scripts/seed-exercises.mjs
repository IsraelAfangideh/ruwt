/**
 * Seed 120+ exercises into D1 database.
 * Run: node scripts/seed-exercises.mjs | npx wrangler d1 execute ruwt-health --remote --file=-
 */

const exercises = [
  // ---- Chest (10) ----
  { name: 'Barbell Bench Press', category: 'chest', type: 'strength', muscleGroup: 'chest' },
  { name: 'Incline Barbell Press', category: 'chest', type: 'strength', muscleGroup: 'upper chest' },
  { name: 'Decline Barbell Press', category: 'chest', type: 'strength', muscleGroup: 'lower chest' },
  { name: 'Dumbbell Bench Press', category: 'chest', type: 'strength', muscleGroup: 'chest' },
  { name: 'Incline Dumbbell Press', category: 'chest', type: 'strength', muscleGroup: 'upper chest' },
  { name: 'Dumbbell Fly', category: 'chest', type: 'strength', muscleGroup: 'chest' },
  { name: 'Cable Crossover', category: 'chest', type: 'strength', muscleGroup: 'chest' },
  { name: 'Push-Up', category: 'chest', type: 'strength', muscleGroup: 'chest' },
  { name: 'Chest Dip', category: 'chest', type: 'strength', muscleGroup: 'lower chest' },
  { name: 'Machine Chest Press', category: 'chest', type: 'strength', muscleGroup: 'chest' },

  // ---- Back (10) ----
  { name: 'Deadlift', category: 'back', type: 'strength', muscleGroup: 'lower back' },
  { name: 'Barbell Row', category: 'back', type: 'strength', muscleGroup: 'mid back' },
  { name: 'Dumbbell Row', category: 'back', type: 'strength', muscleGroup: 'mid back' },
  { name: 'Lat Pulldown', category: 'back', type: 'strength', muscleGroup: 'lats' },
  { name: 'Pull-Up', category: 'back', type: 'strength', muscleGroup: 'lats' },
  { name: 'Chin-Up', category: 'back', type: 'strength', muscleGroup: 'lats' },
  { name: 'Seated Cable Row', category: 'back', type: 'strength', muscleGroup: 'mid back' },
  { name: 'T-Bar Row', category: 'back', type: 'strength', muscleGroup: 'mid back' },
  { name: 'Face Pull', category: 'back', type: 'strength', muscleGroup: 'rear delts' },
  { name: 'Hyperextension', category: 'back', type: 'strength', muscleGroup: 'lower back' },

  // ---- Legs (12) ----
  { name: 'Barbell Squat', category: 'legs', type: 'strength', muscleGroup: 'quads' },
  { name: 'Front Squat', category: 'legs', type: 'strength', muscleGroup: 'quads' },
  { name: 'Leg Press', category: 'legs', type: 'strength', muscleGroup: 'quads' },
  { name: 'Leg Extension', category: 'legs', type: 'strength', muscleGroup: 'quads' },
  { name: 'Leg Curl', category: 'legs', type: 'strength', muscleGroup: 'hamstrings' },
  { name: 'Romanian Deadlift', category: 'legs', type: 'strength', muscleGroup: 'hamstrings' },
  { name: 'Walking Lunges', category: 'legs', type: 'strength', muscleGroup: 'quads' },
  { name: 'Bulgarian Split Squat', category: 'legs', type: 'strength', muscleGroup: 'quads' },
  { name: 'Calf Raise', category: 'legs', type: 'strength', muscleGroup: 'calves' },
  { name: 'Goblet Squat', category: 'legs', type: 'strength', muscleGroup: 'quads' },
  { name: 'Hip Thrust', category: 'legs', type: 'strength', muscleGroup: 'glutes' },
  { name: 'Sumo Deadlift', category: 'legs', type: 'strength', muscleGroup: 'glutes' },

  // ---- Shoulders (10) ----
  { name: 'Overhead Press', category: 'shoulders', type: 'strength', muscleGroup: 'front delts' },
  { name: 'Dumbbell Shoulder Press', category: 'shoulders', type: 'strength', muscleGroup: 'front delts' },
  { name: 'Arnold Press', category: 'shoulders', type: 'strength', muscleGroup: 'delts' },
  { name: 'Lateral Raise', category: 'shoulders', type: 'strength', muscleGroup: 'side delts' },
  { name: 'Front Raise', category: 'shoulders', type: 'strength', muscleGroup: 'front delts' },
  { name: 'Reverse Fly', category: 'shoulders', type: 'strength', muscleGroup: 'rear delts' },
  { name: 'Upright Row', category: 'shoulders', type: 'strength', muscleGroup: 'traps' },
  { name: 'Barbell Shrug', category: 'shoulders', type: 'strength', muscleGroup: 'traps' },
  { name: 'Cable Lateral Raise', category: 'shoulders', type: 'strength', muscleGroup: 'side delts' },
  { name: 'Machine Shoulder Press', category: 'shoulders', type: 'strength', muscleGroup: 'front delts' },

  // ---- Arms (12) ----
  { name: 'Barbell Curl', category: 'arms', type: 'strength', muscleGroup: 'biceps' },
  { name: 'Dumbbell Curl', category: 'arms', type: 'strength', muscleGroup: 'biceps' },
  { name: 'Hammer Curl', category: 'arms', type: 'strength', muscleGroup: 'biceps' },
  { name: 'Preacher Curl', category: 'arms', type: 'strength', muscleGroup: 'biceps' },
  { name: 'Concentration Curl', category: 'arms', type: 'strength', muscleGroup: 'biceps' },
  { name: 'Cable Curl', category: 'arms', type: 'strength', muscleGroup: 'biceps' },
  { name: 'Tricep Pushdown', category: 'arms', type: 'strength', muscleGroup: 'triceps' },
  { name: 'Skull Crusher', category: 'arms', type: 'strength', muscleGroup: 'triceps' },
  { name: 'Overhead Tricep Extension', category: 'arms', type: 'strength', muscleGroup: 'triceps' },
  { name: 'Tricep Dip', category: 'arms', type: 'strength', muscleGroup: 'triceps' },
  { name: 'Close-Grip Bench Press', category: 'arms', type: 'strength', muscleGroup: 'triceps' },
  { name: 'Wrist Curl', category: 'arms', type: 'strength', muscleGroup: 'forearms' },

  // ---- Core (10) ----
  { name: 'Plank', category: 'core', type: 'strength', muscleGroup: 'abs' },
  { name: 'Crunch', category: 'core', type: 'strength', muscleGroup: 'abs' },
  { name: 'Hanging Leg Raise', category: 'core', type: 'strength', muscleGroup: 'abs' },
  { name: 'Russian Twist', category: 'core', type: 'strength', muscleGroup: 'obliques' },
  { name: 'Ab Wheel Rollout', category: 'core', type: 'strength', muscleGroup: 'abs' },
  { name: 'Cable Woodchop', category: 'core', type: 'strength', muscleGroup: 'obliques' },
  { name: 'Dead Bug', category: 'core', type: 'strength', muscleGroup: 'abs' },
  { name: 'Mountain Climber', category: 'core', type: 'strength', muscleGroup: 'abs' },
  { name: 'Side Plank', category: 'core', type: 'strength', muscleGroup: 'obliques' },
  { name: 'Bicycle Crunch', category: 'core', type: 'strength', muscleGroup: 'abs' },

  // ---- Cardio (12) ----
  { name: 'Running (Treadmill)', category: 'cardio', type: 'cardio', muscleGroup: 'legs' },
  { name: 'Running (Outdoor)', category: 'cardio', type: 'cardio', muscleGroup: 'legs' },
  { name: 'Cycling (Stationary)', category: 'cardio', type: 'cardio', muscleGroup: 'legs' },
  { name: 'Cycling (Outdoor)', category: 'cardio', type: 'cardio', muscleGroup: 'legs' },
  { name: 'Swimming', category: 'cardio', type: 'cardio', muscleGroup: 'full body' },
  { name: 'Rowing Machine', category: 'cardio', type: 'cardio', muscleGroup: 'full body' },
  { name: 'Elliptical', category: 'cardio', type: 'cardio', muscleGroup: 'legs' },
  { name: 'Stair Climber', category: 'cardio', type: 'cardio', muscleGroup: 'legs' },
  { name: 'Jump Rope', category: 'cardio', type: 'cardio', muscleGroup: 'full body' },
  { name: 'Walking', category: 'cardio', type: 'cardio', muscleGroup: 'legs' },
  { name: 'HIIT Circuit', category: 'cardio', type: 'cardio', muscleGroup: 'full body' },
  { name: 'Battle Ropes', category: 'cardio', type: 'cardio', muscleGroup: 'upper body' },

  // ---- Flexibility (8) ----
  { name: 'Yoga Flow', category: 'flexibility', type: 'flexibility', muscleGroup: 'full body' },
  { name: 'Hamstring Stretch', category: 'flexibility', type: 'flexibility', muscleGroup: 'hamstrings' },
  { name: 'Hip Flexor Stretch', category: 'flexibility', type: 'flexibility', muscleGroup: 'hip flexors' },
  { name: 'Foam Rolling', category: 'flexibility', type: 'flexibility', muscleGroup: 'full body' },
  { name: 'Cat-Cow Stretch', category: 'flexibility', type: 'flexibility', muscleGroup: 'spine' },
  { name: 'Child\'s Pose', category: 'flexibility', type: 'flexibility', muscleGroup: 'back' },
  { name: 'Pigeon Pose', category: 'flexibility', type: 'flexibility', muscleGroup: 'hips' },
  { name: 'Shoulder Stretch', category: 'flexibility', type: 'flexibility', muscleGroup: 'shoulders' },

  // ---- Olympic / Compound (6) ----
  { name: 'Power Clean', category: 'legs', type: 'strength', muscleGroup: 'full body' },
  { name: 'Clean and Jerk', category: 'shoulders', type: 'strength', muscleGroup: 'full body' },
  { name: 'Snatch', category: 'shoulders', type: 'strength', muscleGroup: 'full body' },
  { name: 'Kettlebell Swing', category: 'legs', type: 'strength', muscleGroup: 'glutes' },
  { name: 'Turkish Get-Up', category: 'core', type: 'strength', muscleGroup: 'full body' },
  { name: 'Farmer\'s Walk', category: 'core', type: 'strength', muscleGroup: 'grip' },
];

// Generate INSERT SQL
const lines = exercises.map(e => {
  const id = crypto.randomUUID();
  return `INSERT INTO exercises (id, name, category, type, muscle_group, is_custom) VALUES ('${id}', '${e.name.replace(/'/g, "''")}', '${e.category}', '${e.type}', '${(e.muscleGroup || '').replace(/'/g, "''")}', 0);`;
});

console.log('-- Seed exercises for Ruwt Fit');
console.log(`-- ${exercises.length} exercises`);
console.log('');
console.log(lines.join('\n'));
console.log('');
console.log(`-- Done: ${exercises.length} exercises seeded`);
