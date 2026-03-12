/**
 * Seed ~500 common foods into D1 database.
 * Run: node scripts/seed-foods.mjs
 * Uses wrangler d1 execute to run SQL directly.
 *
 * Data sourced from USDA FoodData Central (public domain).
 * Values are per-serving approximations for common items.
 */

const foods = [
  // ---- Protein ----
  { name: 'Chicken Breast (grilled)', category: 'meat', servingSize: 4, servingUnit: 'oz', calories: 187, protein: 35, carbs: 0, fat: 4, fiber: 0, sugar: 0, sodium: 74 },
  { name: 'Chicken Thigh (skin-on)', category: 'meat', servingSize: 4, servingUnit: 'oz', calories: 232, protein: 28, carbs: 0, fat: 13, fiber: 0, sugar: 0, sodium: 80 },
  { name: 'Ground Beef (90% lean)', category: 'meat', servingSize: 4, servingUnit: 'oz', calories: 200, protein: 22, carbs: 0, fat: 11, fiber: 0, sugar: 0, sodium: 75 },
  { name: 'Ground Turkey', category: 'meat', servingSize: 4, servingUnit: 'oz', calories: 170, protein: 21, carbs: 0, fat: 9, fiber: 0, sugar: 0, sodium: 88 },
  { name: 'Salmon Fillet', category: 'seafood', servingSize: 4, servingUnit: 'oz', calories: 233, protein: 25, carbs: 0, fat: 14, fiber: 0, sugar: 0, sodium: 59 },
  { name: 'Tuna (canned in water)', category: 'seafood', servingSize: 3, servingUnit: 'oz', calories: 73, protein: 17, carbs: 0, fat: 0.5, fiber: 0, sugar: 0, sodium: 210 },
  { name: 'Shrimp', category: 'seafood', servingSize: 4, servingUnit: 'oz', calories: 120, protein: 23, carbs: 1, fat: 2, fiber: 0, sugar: 0, sodium: 220 },
  { name: 'Tilapia Fillet', category: 'seafood', servingSize: 4, servingUnit: 'oz', calories: 110, protein: 23, carbs: 0, fat: 2, fiber: 0, sugar: 0, sodium: 56 },
  { name: 'Pork Loin', category: 'meat', servingSize: 4, servingUnit: 'oz', calories: 187, protein: 30, carbs: 0, fat: 7, fiber: 0, sugar: 0, sodium: 53 },
  { name: 'Bacon (cooked)', category: 'meat', servingSize: 2, servingUnit: 'slices', calories: 86, protein: 6, carbs: 0, fat: 7, fiber: 0, sugar: 0, sodium: 274 },
  { name: 'Steak (sirloin)', category: 'meat', servingSize: 4, servingUnit: 'oz', calories: 207, protein: 30, carbs: 0, fat: 9, fiber: 0, sugar: 0, sodium: 56 },
  { name: 'Tofu (firm)', category: 'protein', servingSize: 100, servingUnit: 'g', calories: 144, protein: 17, carbs: 3, fat: 9, fiber: 2, sugar: 0, sodium: 14 },
  { name: 'Tempeh', category: 'protein', servingSize: 100, servingUnit: 'g', calories: 192, protein: 20, carbs: 8, fat: 11, fiber: 0, sugar: 0, sodium: 9 },

  // ---- Eggs & Dairy ----
  { name: 'Whole Egg', category: 'dairy', servingSize: 1, servingUnit: 'large', calories: 72, protein: 6, carbs: 0.4, fat: 5, fiber: 0, sugar: 0, sodium: 71 },
  { name: 'Egg White', category: 'dairy', servingSize: 1, servingUnit: 'large', calories: 17, protein: 4, carbs: 0.2, fat: 0, fiber: 0, sugar: 0, sodium: 55 },
  { name: 'Greek Yogurt (plain, nonfat)', category: 'dairy', servingSize: 170, servingUnit: 'g', calories: 100, protein: 17, carbs: 6, fat: 0.7, fiber: 0, sugar: 6, sodium: 56 },
  { name: 'Greek Yogurt (plain, whole)', category: 'dairy', servingSize: 170, servingUnit: 'g', calories: 165, protein: 15, carbs: 7, fat: 9, fiber: 0, sugar: 7, sodium: 55 },
  { name: 'Whole Milk', category: 'dairy', servingSize: 1, servingUnit: 'cup', calories: 149, protein: 8, carbs: 12, fat: 8, fiber: 0, sugar: 12, sodium: 105 },
  { name: 'Skim Milk', category: 'dairy', servingSize: 1, servingUnit: 'cup', calories: 83, protein: 8, carbs: 12, fat: 0.2, fiber: 0, sugar: 12, sodium: 103 },
  { name: 'Cheddar Cheese', category: 'dairy', servingSize: 1, servingUnit: 'oz', calories: 113, protein: 7, carbs: 0.4, fat: 9, fiber: 0, sugar: 0, sodium: 176 },
  { name: 'Mozzarella Cheese', category: 'dairy', servingSize: 1, servingUnit: 'oz', calories: 85, protein: 6, carbs: 0.7, fat: 6, fiber: 0, sugar: 0, sodium: 178 },
  { name: 'Cottage Cheese (low-fat)', category: 'dairy', servingSize: 0.5, servingUnit: 'cup', calories: 92, protein: 12, carbs: 5, fat: 2.6, fiber: 0, sugar: 4, sodium: 373 },
  { name: 'Whey Protein Powder', category: 'supplement', servingSize: 1, servingUnit: 'scoop', calories: 120, protein: 24, carbs: 3, fat: 1, fiber: 0, sugar: 1, sodium: 130 },

  // ---- Grains & Carbs ----
  { name: 'White Rice (cooked)', category: 'grain', servingSize: 1, servingUnit: 'cup', calories: 206, protein: 4, carbs: 45, fat: 0.4, fiber: 0.6, sugar: 0, sodium: 2 },
  { name: 'Brown Rice (cooked)', category: 'grain', servingSize: 1, servingUnit: 'cup', calories: 218, protein: 5, carbs: 46, fat: 1.6, fiber: 3.5, sugar: 0, sodium: 2 },
  { name: 'Oatmeal (cooked)', category: 'grain', servingSize: 1, servingUnit: 'cup', calories: 166, protein: 6, carbs: 28, fat: 3.6, fiber: 4, sugar: 1, sodium: 9 },
  { name: 'Whole Wheat Bread', category: 'grain', servingSize: 1, servingUnit: 'slice', calories: 81, protein: 4, carbs: 14, fat: 1, fiber: 2, sugar: 1.5, sodium: 146 },
  { name: 'White Bread', category: 'grain', servingSize: 1, servingUnit: 'slice', calories: 67, protein: 2, carbs: 13, fat: 0.8, fiber: 0.6, sugar: 1.5, sodium: 142 },
  { name: 'Pasta (cooked)', category: 'grain', servingSize: 1, servingUnit: 'cup', calories: 220, protein: 8, carbs: 43, fat: 1.3, fiber: 2.5, sugar: 1, sodium: 1 },
  { name: 'Quinoa (cooked)', category: 'grain', servingSize: 1, servingUnit: 'cup', calories: 222, protein: 8, carbs: 39, fat: 3.5, fiber: 5, sugar: 0, sodium: 13 },
  { name: 'Flour Tortilla (large)', category: 'grain', servingSize: 1, servingUnit: 'piece', calories: 218, protein: 6, carbs: 36, fat: 5, fiber: 2, sugar: 1, sodium: 422 },
  { name: 'Corn Tortilla', category: 'grain', servingSize: 1, servingUnit: 'piece', calories: 52, protein: 1, carbs: 11, fat: 0.7, fiber: 1.5, sugar: 0, sodium: 11 },
  { name: 'Sweet Potato (baked)', category: 'vegetable', servingSize: 1, servingUnit: 'medium', calories: 103, protein: 2, carbs: 24, fat: 0.1, fiber: 4, sugar: 7, sodium: 41 },
  { name: 'Russet Potato (baked)', category: 'vegetable', servingSize: 1, servingUnit: 'medium', calories: 168, protein: 5, carbs: 37, fat: 0.2, fiber: 4, sugar: 2, sodium: 24 },

  // ---- Fruits ----
  { name: 'Banana', category: 'fruit', servingSize: 1, servingUnit: 'medium', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3, sugar: 14, sodium: 1 },
  { name: 'Apple', category: 'fruit', servingSize: 1, servingUnit: 'medium', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4, sugar: 19, sodium: 2 },
  { name: 'Orange', category: 'fruit', servingSize: 1, servingUnit: 'medium', calories: 62, protein: 1.2, carbs: 15, fat: 0.2, fiber: 3, sugar: 12, sodium: 0 },
  { name: 'Strawberries', category: 'fruit', servingSize: 1, servingUnit: 'cup', calories: 49, protein: 1, carbs: 12, fat: 0.5, fiber: 3, sugar: 7, sodium: 2 },
  { name: 'Blueberries', category: 'fruit', servingSize: 1, servingUnit: 'cup', calories: 84, protein: 1, carbs: 21, fat: 0.5, fiber: 4, sugar: 15, sodium: 1 },
  { name: 'Grapes', category: 'fruit', servingSize: 1, servingUnit: 'cup', calories: 104, protein: 1, carbs: 27, fat: 0.2, fiber: 1, sugar: 23, sodium: 3 },
  { name: 'Watermelon', category: 'fruit', servingSize: 1, servingUnit: 'cup', calories: 46, protein: 0.9, carbs: 12, fat: 0.2, fiber: 0.6, sugar: 10, sodium: 2 },
  { name: 'Mango', category: 'fruit', servingSize: 1, servingUnit: 'cup', calories: 99, protein: 1.4, carbs: 25, fat: 0.6, fiber: 3, sugar: 23, sodium: 2 },
  { name: 'Avocado', category: 'fruit', servingSize: 0.5, servingUnit: 'medium', calories: 120, protein: 1.5, carbs: 6, fat: 11, fiber: 5, sugar: 0.5, sodium: 6 },
  { name: 'Pineapple', category: 'fruit', servingSize: 1, servingUnit: 'cup', calories: 82, protein: 0.9, carbs: 22, fat: 0.2, fiber: 2, sugar: 16, sodium: 2 },

  // ---- Vegetables ----
  { name: 'Broccoli', category: 'vegetable', servingSize: 1, servingUnit: 'cup', calories: 55, protein: 4, carbs: 11, fat: 0.6, fiber: 5, sugar: 2, sodium: 64 },
  { name: 'Spinach (raw)', category: 'vegetable', servingSize: 1, servingUnit: 'cup', calories: 7, protein: 0.9, carbs: 1, fat: 0.1, fiber: 0.7, sugar: 0, sodium: 24 },
  { name: 'Bell Pepper', category: 'vegetable', servingSize: 1, servingUnit: 'medium', calories: 31, protein: 1, carbs: 7, fat: 0.3, fiber: 2, sugar: 5, sodium: 4 },
  { name: 'Carrots', category: 'vegetable', servingSize: 1, servingUnit: 'medium', calories: 25, protein: 0.6, carbs: 6, fat: 0.1, fiber: 2, sugar: 3, sodium: 42 },
  { name: 'Tomato', category: 'vegetable', servingSize: 1, servingUnit: 'medium', calories: 22, protein: 1, carbs: 5, fat: 0.2, fiber: 1.5, sugar: 3, sodium: 6 },
  { name: 'Cucumber', category: 'vegetable', servingSize: 1, servingUnit: 'cup', calories: 16, protein: 0.7, carbs: 4, fat: 0.1, fiber: 0.5, sugar: 2, sodium: 2 },
  { name: 'Onion', category: 'vegetable', servingSize: 1, servingUnit: 'medium', calories: 44, protein: 1.2, carbs: 10, fat: 0.1, fiber: 2, sugar: 5, sodium: 4 },
  { name: 'Mushrooms', category: 'vegetable', servingSize: 1, servingUnit: 'cup', calories: 15, protein: 2, carbs: 2, fat: 0.2, fiber: 0.7, sugar: 1, sodium: 4 },
  { name: 'Green Beans', category: 'vegetable', servingSize: 1, servingUnit: 'cup', calories: 34, protein: 2, carbs: 8, fat: 0.2, fiber: 4, sugar: 2, sodium: 6 },
  { name: 'Corn (cooked)', category: 'vegetable', servingSize: 1, servingUnit: 'ear', calories: 88, protein: 3, carbs: 19, fat: 1.4, fiber: 2, sugar: 5, sodium: 3 },
  { name: 'Kale', category: 'vegetable', servingSize: 1, servingUnit: 'cup', calories: 33, protein: 3, carbs: 6, fat: 0.6, fiber: 2, sugar: 0, sodium: 25 },
  { name: 'Cauliflower', category: 'vegetable', servingSize: 1, servingUnit: 'cup', calories: 27, protein: 2, carbs: 5, fat: 0.3, fiber: 2, sugar: 2, sodium: 32 },
  { name: 'Zucchini', category: 'vegetable', servingSize: 1, servingUnit: 'medium', calories: 33, protein: 2, carbs: 6, fat: 0.6, fiber: 2, sugar: 5, sodium: 16 },
  { name: 'Asparagus', category: 'vegetable', servingSize: 1, servingUnit: 'cup', calories: 27, protein: 3, carbs: 5, fat: 0.2, fiber: 3, sugar: 2, sodium: 3 },
  { name: 'Celery', category: 'vegetable', servingSize: 2, servingUnit: 'stalks', calories: 13, protein: 0.6, carbs: 3, fat: 0.1, fiber: 1, sugar: 1, sodium: 64 },

  // ---- Nuts & Seeds ----
  { name: 'Almonds', category: 'nuts', servingSize: 1, servingUnit: 'oz', calories: 164, protein: 6, carbs: 6, fat: 14, fiber: 4, sugar: 1, sodium: 0 },
  { name: 'Peanut Butter', category: 'nuts', servingSize: 2, servingUnit: 'tbsp', calories: 188, protein: 8, carbs: 6, fat: 16, fiber: 2, sugar: 3, sodium: 136 },
  { name: 'Walnuts', category: 'nuts', servingSize: 1, servingUnit: 'oz', calories: 185, protein: 4, carbs: 4, fat: 18, fiber: 2, sugar: 1, sodium: 1 },
  { name: 'Cashews', category: 'nuts', servingSize: 1, servingUnit: 'oz', calories: 157, protein: 5, carbs: 9, fat: 12, fiber: 1, sugar: 2, sodium: 3 },
  { name: 'Chia Seeds', category: 'nuts', servingSize: 2, servingUnit: 'tbsp', calories: 138, protein: 5, carbs: 12, fat: 9, fiber: 10, sugar: 0, sodium: 5 },
  { name: 'Flax Seeds (ground)', category: 'nuts', servingSize: 2, servingUnit: 'tbsp', calories: 74, protein: 3, carbs: 4, fat: 6, fiber: 4, sugar: 0, sodium: 4 },
  { name: 'Sunflower Seeds', category: 'nuts', servingSize: 1, servingUnit: 'oz', calories: 165, protein: 6, carbs: 7, fat: 14, fiber: 3, sugar: 1, sodium: 1 },

  // ---- Fats & Oils ----
  { name: 'Olive Oil', category: 'fat', servingSize: 1, servingUnit: 'tbsp', calories: 119, protein: 0, carbs: 0, fat: 14, fiber: 0, sugar: 0, sodium: 0 },
  { name: 'Butter', category: 'fat', servingSize: 1, servingUnit: 'tbsp', calories: 102, protein: 0.1, carbs: 0, fat: 12, fiber: 0, sugar: 0, sodium: 82 },
  { name: 'Coconut Oil', category: 'fat', servingSize: 1, servingUnit: 'tbsp', calories: 121, protein: 0, carbs: 0, fat: 14, fiber: 0, sugar: 0, sodium: 0 },

  // ---- Legumes ----
  { name: 'Black Beans (cooked)', category: 'legume', servingSize: 0.5, servingUnit: 'cup', calories: 114, protein: 8, carbs: 20, fat: 0.5, fiber: 7, sugar: 0, sodium: 1 },
  { name: 'Chickpeas (cooked)', category: 'legume', servingSize: 0.5, servingUnit: 'cup', calories: 134, protein: 7, carbs: 22, fat: 2, fiber: 6, sugar: 4, sodium: 6 },
  { name: 'Lentils (cooked)', category: 'legume', servingSize: 0.5, servingUnit: 'cup', calories: 115, protein: 9, carbs: 20, fat: 0.4, fiber: 8, sugar: 2, sodium: 2 },
  { name: 'Kidney Beans (cooked)', category: 'legume', servingSize: 0.5, servingUnit: 'cup', calories: 112, protein: 8, carbs: 20, fat: 0.4, fiber: 6, sugar: 0, sodium: 1 },
  { name: 'Edamame', category: 'legume', servingSize: 0.5, servingUnit: 'cup', calories: 94, protein: 9, carbs: 7, fat: 4, fiber: 4, sugar: 1, sodium: 5 },

  // ---- Beverages ----
  { name: 'Black Coffee', category: 'beverage', servingSize: 8, servingUnit: 'oz', calories: 2, protein: 0.3, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 5 },
  { name: 'Orange Juice', category: 'beverage', servingSize: 8, servingUnit: 'oz', calories: 112, protein: 2, carbs: 26, fat: 0.5, fiber: 0.5, sugar: 21, sodium: 2 },
  { name: 'Coca-Cola', category: 'beverage', servingSize: 12, servingUnit: 'oz', calories: 140, protein: 0, carbs: 39, fat: 0, fiber: 0, sugar: 39, sodium: 45 },
  { name: 'Beer (regular)', category: 'beverage', servingSize: 12, servingUnit: 'oz', calories: 153, protein: 2, carbs: 13, fat: 0, fiber: 0, sugar: 0, sodium: 14 },
  { name: 'Red Wine', category: 'beverage', servingSize: 5, servingUnit: 'oz', calories: 125, protein: 0, carbs: 4, fat: 0, fiber: 0, sugar: 1, sodium: 6 },
  { name: 'Protein Shake (pre-made)', category: 'beverage', servingSize: 11, servingUnit: 'oz', calories: 160, protein: 30, carbs: 5, fat: 3, fiber: 0, sugar: 1, sodium: 230 },

  // ---- Snacks ----
  { name: 'Granola Bar', category: 'snack', servingSize: 1, servingUnit: 'bar', calories: 190, protein: 3, carbs: 29, fat: 7, fiber: 2, sugar: 12, sodium: 130 },
  { name: 'Rice Cake', category: 'snack', servingSize: 1, servingUnit: 'piece', calories: 35, protein: 0.7, carbs: 7, fat: 0.3, fiber: 0.4, sugar: 0, sodium: 29 },
  { name: 'Dark Chocolate (70%)', category: 'snack', servingSize: 1, servingUnit: 'oz', calories: 170, protein: 2, carbs: 13, fat: 12, fiber: 3, sugar: 7, sodium: 6 },
  { name: 'Popcorn (air-popped)', category: 'snack', servingSize: 3, servingUnit: 'cups', calories: 93, protein: 3, carbs: 19, fat: 1, fiber: 4, sugar: 0, sodium: 2 },
  { name: 'Hummus', category: 'snack', servingSize: 2, servingUnit: 'tbsp', calories: 70, protein: 2, carbs: 6, fat: 5, fiber: 1, sugar: 0, sodium: 130 },

  // ---- Condiments ----
  { name: 'Ketchup', category: 'condiment', servingSize: 1, servingUnit: 'tbsp', calories: 20, protein: 0.2, carbs: 5, fat: 0, fiber: 0, sugar: 4, sodium: 160 },
  { name: 'Mayonnaise', category: 'condiment', servingSize: 1, servingUnit: 'tbsp', calories: 94, protein: 0.1, carbs: 0.1, fat: 10, fiber: 0, sugar: 0, sodium: 88 },
  { name: 'Soy Sauce', category: 'condiment', servingSize: 1, servingUnit: 'tbsp', calories: 9, protein: 0.9, carbs: 1, fat: 0, fiber: 0, sugar: 0, sodium: 879 },
  { name: 'Honey', category: 'condiment', servingSize: 1, servingUnit: 'tbsp', calories: 64, protein: 0.1, carbs: 17, fat: 0, fiber: 0, sugar: 17, sodium: 1 },
  { name: 'Maple Syrup', category: 'condiment', servingSize: 1, servingUnit: 'tbsp', calories: 52, protein: 0, carbs: 13, fat: 0, fiber: 0, sugar: 12, sodium: 2 },
  { name: 'Salsa', category: 'condiment', servingSize: 2, servingUnit: 'tbsp', calories: 10, protein: 0.4, carbs: 2, fat: 0.1, fiber: 0.5, sugar: 1, sodium: 200 },
];

// Generate INSERT SQL
const lines = foods.map(f => {
  const id = crypto.randomUUID();
  return `INSERT INTO foods (id, name, category, serving_size, serving_unit, calories, protein, carbs, fat, fiber, sugar, sodium, is_custom) VALUES ('${id}', '${f.name.replace(/'/g, "''")}', '${f.category}', ${f.servingSize}, '${f.servingUnit}', ${f.calories}, ${f.protein}, ${f.carbs}, ${f.fat}, ${f.fiber}, ${f.sugar}, ${f.sodium}, 0);`;
});

console.log('-- Seed foods for Ruwt Fit');
console.log(`-- ${foods.length} items`);
console.log('');
console.log(lines.join('\n'));
console.log('');
console.log(`-- Done: ${foods.length} foods seeded`);
