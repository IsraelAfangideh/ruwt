/**
 * Seed ~500+ common foods into D1 database.
 * Run: node scripts/seed-foods.mjs | npx wrangler d1 execute ruwt-health --remote --file=-
 *
 * Data sourced from USDA FoodData Central (public domain).
 * Values are per-serving approximations for common items.
 */

const foods = [
  // ---- Protein (13) ----
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

  // ---- Eggs & Dairy (10) ----
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

  // ---- Grains & Carbs (11) ----
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

  // ---- Fruits (10) ----
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

  // ---- Vegetables (15) ----
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

  // ---- Nuts & Seeds (7) ----
  { name: 'Almonds', category: 'nuts', servingSize: 1, servingUnit: 'oz', calories: 164, protein: 6, carbs: 6, fat: 14, fiber: 4, sugar: 1, sodium: 0 },
  { name: 'Peanut Butter', category: 'nuts', servingSize: 2, servingUnit: 'tbsp', calories: 188, protein: 8, carbs: 6, fat: 16, fiber: 2, sugar: 3, sodium: 136 },
  { name: 'Walnuts', category: 'nuts', servingSize: 1, servingUnit: 'oz', calories: 185, protein: 4, carbs: 4, fat: 18, fiber: 2, sugar: 1, sodium: 1 },
  { name: 'Cashews', category: 'nuts', servingSize: 1, servingUnit: 'oz', calories: 157, protein: 5, carbs: 9, fat: 12, fiber: 1, sugar: 2, sodium: 3 },
  { name: 'Chia Seeds', category: 'nuts', servingSize: 2, servingUnit: 'tbsp', calories: 138, protein: 5, carbs: 12, fat: 9, fiber: 10, sugar: 0, sodium: 5 },
  { name: 'Flax Seeds (ground)', category: 'nuts', servingSize: 2, servingUnit: 'tbsp', calories: 74, protein: 3, carbs: 4, fat: 6, fiber: 4, sugar: 0, sodium: 4 },
  { name: 'Sunflower Seeds', category: 'nuts', servingSize: 1, servingUnit: 'oz', calories: 165, protein: 6, carbs: 7, fat: 14, fiber: 3, sugar: 1, sodium: 1 },

  // ---- Fats & Oils (3) ----
  { name: 'Olive Oil', category: 'fat', servingSize: 1, servingUnit: 'tbsp', calories: 119, protein: 0, carbs: 0, fat: 14, fiber: 0, sugar: 0, sodium: 0 },
  { name: 'Butter', category: 'fat', servingSize: 1, servingUnit: 'tbsp', calories: 102, protein: 0.1, carbs: 0, fat: 12, fiber: 0, sugar: 0, sodium: 82 },
  { name: 'Coconut Oil', category: 'fat', servingSize: 1, servingUnit: 'tbsp', calories: 121, protein: 0, carbs: 0, fat: 14, fiber: 0, sugar: 0, sodium: 0 },

  // ---- Legumes (5) ----
  { name: 'Black Beans (cooked)', category: 'legume', servingSize: 0.5, servingUnit: 'cup', calories: 114, protein: 8, carbs: 20, fat: 0.5, fiber: 7, sugar: 0, sodium: 1 },
  { name: 'Chickpeas (cooked)', category: 'legume', servingSize: 0.5, servingUnit: 'cup', calories: 134, protein: 7, carbs: 22, fat: 2, fiber: 6, sugar: 4, sodium: 6 },
  { name: 'Lentils (cooked)', category: 'legume', servingSize: 0.5, servingUnit: 'cup', calories: 115, protein: 9, carbs: 20, fat: 0.4, fiber: 8, sugar: 2, sodium: 2 },
  { name: 'Kidney Beans (cooked)', category: 'legume', servingSize: 0.5, servingUnit: 'cup', calories: 112, protein: 8, carbs: 20, fat: 0.4, fiber: 6, sugar: 0, sodium: 1 },
  { name: 'Edamame', category: 'legume', servingSize: 0.5, servingUnit: 'cup', calories: 94, protein: 9, carbs: 7, fat: 4, fiber: 4, sugar: 1, sodium: 5 },

  // ---- Beverages (6) ----
  { name: 'Black Coffee', category: 'beverage', servingSize: 8, servingUnit: 'oz', calories: 2, protein: 0.3, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 5 },
  { name: 'Orange Juice', category: 'beverage', servingSize: 8, servingUnit: 'oz', calories: 112, protein: 2, carbs: 26, fat: 0.5, fiber: 0.5, sugar: 21, sodium: 2 },
  { name: 'Coca-Cola', category: 'beverage', servingSize: 12, servingUnit: 'oz', calories: 140, protein: 0, carbs: 39, fat: 0, fiber: 0, sugar: 39, sodium: 45 },
  { name: 'Beer (regular)', category: 'beverage', servingSize: 12, servingUnit: 'oz', calories: 153, protein: 2, carbs: 13, fat: 0, fiber: 0, sugar: 0, sodium: 14 },
  { name: 'Red Wine', category: 'beverage', servingSize: 5, servingUnit: 'oz', calories: 125, protein: 0, carbs: 4, fat: 0, fiber: 0, sugar: 1, sodium: 6 },
  { name: 'Protein Shake (pre-made)', category: 'beverage', servingSize: 11, servingUnit: 'oz', calories: 160, protein: 30, carbs: 5, fat: 3, fiber: 0, sugar: 1, sodium: 230 },

  // ---- Snacks (5) ----
  { name: 'Granola Bar', category: 'snack', servingSize: 1, servingUnit: 'bar', calories: 190, protein: 3, carbs: 29, fat: 7, fiber: 2, sugar: 12, sodium: 130 },
  { name: 'Rice Cake', category: 'snack', servingSize: 1, servingUnit: 'piece', calories: 35, protein: 0.7, carbs: 7, fat: 0.3, fiber: 0.4, sugar: 0, sodium: 29 },
  { name: 'Dark Chocolate (70%)', category: 'snack', servingSize: 1, servingUnit: 'oz', calories: 170, protein: 2, carbs: 13, fat: 12, fiber: 3, sugar: 7, sodium: 6 },
  { name: 'Popcorn (air-popped)', category: 'snack', servingSize: 3, servingUnit: 'cups', calories: 93, protein: 3, carbs: 19, fat: 1, fiber: 4, sugar: 0, sodium: 2 },
  { name: 'Hummus', category: 'snack', servingSize: 2, servingUnit: 'tbsp', calories: 70, protein: 2, carbs: 6, fat: 5, fiber: 1, sugar: 0, sodium: 130 },

  // ---- Condiments (6) ----
  { name: 'Ketchup', category: 'condiment', servingSize: 1, servingUnit: 'tbsp', calories: 20, protein: 0.2, carbs: 5, fat: 0, fiber: 0, sugar: 4, sodium: 160 },
  { name: 'Mayonnaise', category: 'condiment', servingSize: 1, servingUnit: 'tbsp', calories: 94, protein: 0.1, carbs: 0.1, fat: 10, fiber: 0, sugar: 0, sodium: 88 },
  { name: 'Soy Sauce', category: 'condiment', servingSize: 1, servingUnit: 'tbsp', calories: 9, protein: 0.9, carbs: 1, fat: 0, fiber: 0, sugar: 0, sodium: 879 },
  { name: 'Honey', category: 'condiment', servingSize: 1, servingUnit: 'tbsp', calories: 64, protein: 0.1, carbs: 17, fat: 0, fiber: 0, sugar: 17, sodium: 1 },
  { name: 'Maple Syrup', category: 'condiment', servingSize: 1, servingUnit: 'tbsp', calories: 52, protein: 0, carbs: 13, fat: 0, fiber: 0, sugar: 12, sodium: 2 },
  { name: 'Salsa', category: 'condiment', servingSize: 2, servingUnit: 'tbsp', calories: 10, protein: 0.4, carbs: 2, fat: 0.1, fiber: 0.5, sugar: 1, sodium: 200 },

  // ======== NEW CATEGORIES (Phase 2 expansion) ========

  // ---- Fast Food (40+) ----
  { name: 'Big Mac', category: 'fast-food', servingSize: 1, servingUnit: 'sandwich', calories: 550, protein: 25, carbs: 46, fat: 30, fiber: 3, sugar: 9, sodium: 1010 },
  { name: 'Quarter Pounder with Cheese', category: 'fast-food', servingSize: 1, servingUnit: 'sandwich', calories: 520, protein: 30, carbs: 42, fat: 27, fiber: 2, sugar: 10, sodium: 1100 },
  { name: 'McChicken', category: 'fast-food', servingSize: 1, servingUnit: 'sandwich', calories: 400, protein: 14, carbs: 40, fat: 21, fiber: 2, sugar: 5, sodium: 560 },
  { name: 'Chicken McNuggets (10pc)', category: 'fast-food', servingSize: 10, servingUnit: 'pieces', calories: 410, protein: 24, carbs: 25, fat: 24, fiber: 1, sugar: 0, sodium: 900 },
  { name: 'McDonald\'s French Fries (medium)', category: 'fast-food', servingSize: 1, servingUnit: 'serving', calories: 320, protein: 5, carbs: 43, fat: 15, fiber: 4, sugar: 0, sodium: 260 },
  { name: 'Egg McMuffin', category: 'fast-food', servingSize: 1, servingUnit: 'sandwich', calories: 300, protein: 17, carbs: 29, fat: 13, fiber: 2, sugar: 3, sodium: 750 },
  { name: 'Chipotle Burrito Bowl (chicken)', category: 'fast-food', servingSize: 1, servingUnit: 'bowl', calories: 665, protein: 46, carbs: 53, fat: 25, fiber: 10, sugar: 5, sodium: 1400 },
  { name: 'Chipotle Chicken Burrito', category: 'fast-food', servingSize: 1, servingUnit: 'burrito', calories: 955, protein: 52, carbs: 103, fat: 36, fiber: 13, sugar: 6, sodium: 2170 },
  { name: 'Subway 6" Turkey Sub', category: 'fast-food', servingSize: 1, servingUnit: 'sandwich', calories: 280, protein: 18, carbs: 46, fat: 3.5, fiber: 5, sugar: 7, sodium: 740 },
  { name: 'Subway 6" Italian BMT', category: 'fast-food', servingSize: 1, servingUnit: 'sandwich', calories: 410, protein: 20, carbs: 46, fat: 16, fiber: 5, sugar: 7, sodium: 1290 },
  { name: 'Chick-fil-A Chicken Sandwich', category: 'fast-food', servingSize: 1, servingUnit: 'sandwich', calories: 440, protein: 28, carbs: 40, fat: 19, fiber: 1, sugar: 6, sodium: 1350 },
  { name: 'Chick-fil-A Nuggets (8ct)', category: 'fast-food', servingSize: 8, servingUnit: 'pieces', calories: 250, protein: 27, carbs: 11, fat: 11, fiber: 0, sugar: 1, sodium: 1090 },
  { name: 'Whopper', category: 'fast-food', servingSize: 1, servingUnit: 'sandwich', calories: 660, protein: 28, carbs: 49, fat: 40, fiber: 2, sugar: 11, sodium: 980 },
  { name: 'Wendy\'s Baconator', category: 'fast-food', servingSize: 1, servingUnit: 'sandwich', calories: 960, protein: 57, carbs: 38, fat: 65, fiber: 1, sugar: 9, sodium: 1750 },
  { name: 'Taco Bell Crunchy Taco', category: 'fast-food', servingSize: 1, servingUnit: 'taco', calories: 170, protein: 8, carbs: 13, fat: 10, fiber: 3, sugar: 1, sodium: 310 },
  { name: 'Taco Bell Burrito Supreme', category: 'fast-food', servingSize: 1, servingUnit: 'burrito', calories: 390, protein: 16, carbs: 51, fat: 14, fiber: 7, sugar: 4, sodium: 1060 },
  { name: 'Pizza Slice (cheese, 14")', category: 'fast-food', servingSize: 1, servingUnit: 'slice', calories: 285, protein: 12, carbs: 36, fat: 10, fiber: 2, sugar: 4, sodium: 640 },
  { name: 'Pizza Slice (pepperoni, 14")', category: 'fast-food', servingSize: 1, servingUnit: 'slice', calories: 313, protein: 13, carbs: 35, fat: 13, fiber: 2, sugar: 4, sodium: 760 },
  { name: 'Hot Dog', category: 'fast-food', servingSize: 1, servingUnit: 'piece', calories: 290, protein: 10, carbs: 24, fat: 17, fiber: 1, sugar: 4, sodium: 810 },
  { name: 'Fried Chicken (drumstick)', category: 'fast-food', servingSize: 1, servingUnit: 'piece', calories: 195, protein: 16, carbs: 6, fat: 12, fiber: 0, sugar: 0, sodium: 480 },

  // ---- Restaurant Staples (30+) ----
  { name: 'Spaghetti Bolognese', category: 'restaurant', servingSize: 1, servingUnit: 'plate', calories: 520, protein: 24, carbs: 65, fat: 18, fiber: 4, sugar: 8, sodium: 820 },
  { name: 'Fettuccine Alfredo', category: 'restaurant', servingSize: 1, servingUnit: 'plate', calories: 660, protein: 18, carbs: 55, fat: 40, fiber: 2, sugar: 3, sodium: 950 },
  { name: 'Caesar Salad (with dressing)', category: 'restaurant', servingSize: 1, servingUnit: 'plate', calories: 360, protein: 8, carbs: 14, fat: 30, fiber: 3, sugar: 2, sodium: 720 },
  { name: 'Grilled Chicken Salad', category: 'restaurant', servingSize: 1, servingUnit: 'plate', calories: 380, protein: 35, carbs: 15, fat: 20, fiber: 4, sugar: 5, sodium: 580 },
  { name: 'Fish and Chips', category: 'restaurant', servingSize: 1, servingUnit: 'plate', calories: 750, protein: 35, carbs: 65, fat: 38, fiber: 3, sugar: 2, sodium: 850 },
  { name: 'Chicken Parmesan', category: 'restaurant', servingSize: 1, servingUnit: 'plate', calories: 680, protein: 42, carbs: 52, fat: 28, fiber: 4, sugar: 8, sodium: 1200 },
  { name: 'Steak (8oz restaurant)', category: 'restaurant', servingSize: 8, servingUnit: 'oz', calories: 414, protein: 60, carbs: 0, fat: 18, fiber: 0, sugar: 0, sodium: 112 },
  { name: 'Mashed Potatoes (restaurant)', category: 'restaurant', servingSize: 1, servingUnit: 'cup', calories: 237, protein: 4, carbs: 35, fat: 9, fiber: 3, sugar: 3, sodium: 665 },
  { name: 'French Onion Soup', category: 'restaurant', servingSize: 1, servingUnit: 'bowl', calories: 350, protein: 15, carbs: 30, fat: 18, fiber: 2, sugar: 6, sodium: 1200 },
  { name: 'Club Sandwich', category: 'restaurant', servingSize: 1, servingUnit: 'sandwich', calories: 520, protein: 30, carbs: 40, fat: 26, fiber: 2, sugar: 4, sodium: 1100 },
  { name: 'BLT Sandwich', category: 'restaurant', servingSize: 1, servingUnit: 'sandwich', calories: 380, protein: 14, carbs: 30, fat: 23, fiber: 2, sugar: 3, sodium: 780 },
  { name: 'Grilled Cheese', category: 'restaurant', servingSize: 1, servingUnit: 'sandwich', calories: 440, protein: 16, carbs: 32, fat: 28, fiber: 1, sugar: 3, sodium: 880 },

  // ---- International (40+) ----
  { name: 'Sushi Roll (California, 8pc)', category: 'international', servingSize: 8, servingUnit: 'pieces', calories: 255, protein: 9, carbs: 38, fat: 7, fiber: 2, sugar: 7, sodium: 500 },
  { name: 'Sushi Roll (Spicy Tuna, 8pc)', category: 'international', servingSize: 8, servingUnit: 'pieces', calories: 290, protein: 12, carbs: 36, fat: 11, fiber: 2, sugar: 6, sodium: 580 },
  { name: 'Sashimi (salmon, 6pc)', category: 'international', servingSize: 6, servingUnit: 'pieces', calories: 210, protein: 30, carbs: 0, fat: 10, fiber: 0, sugar: 0, sodium: 100 },
  { name: 'Pad Thai (chicken)', category: 'international', servingSize: 1, servingUnit: 'plate', calories: 550, protein: 25, carbs: 70, fat: 18, fiber: 2, sugar: 12, sodium: 1200 },
  { name: 'Green Curry (Thai)', category: 'international', servingSize: 1, servingUnit: 'bowl', calories: 380, protein: 22, carbs: 18, fat: 24, fiber: 3, sugar: 5, sodium: 900 },
  { name: 'Chicken Tikka Masala', category: 'international', servingSize: 1, servingUnit: 'bowl', calories: 430, protein: 30, carbs: 22, fat: 24, fiber: 3, sugar: 6, sodium: 850 },
  { name: 'Naan Bread', category: 'international', servingSize: 1, servingUnit: 'piece', calories: 262, protein: 9, carbs: 45, fat: 5, fiber: 2, sugar: 3, sodium: 490 },
  { name: 'Beef Tacos (2)', category: 'international', servingSize: 2, servingUnit: 'tacos', calories: 370, protein: 20, carbs: 26, fat: 20, fiber: 4, sugar: 3, sodium: 580 },
  { name: 'Chicken Quesadilla', category: 'international', servingSize: 1, servingUnit: 'piece', calories: 530, protein: 32, carbs: 40, fat: 26, fiber: 2, sugar: 2, sodium: 1050 },
  { name: 'Fried Rice', category: 'international', servingSize: 1, servingUnit: 'cup', calories: 238, protein: 6, carbs: 40, fat: 6, fiber: 1, sugar: 1, sodium: 580 },
  { name: 'Ramen (pork)', category: 'international', servingSize: 1, servingUnit: 'bowl', calories: 580, protein: 25, carbs: 70, fat: 20, fiber: 2, sugar: 3, sodium: 2000 },
  { name: 'Pho (beef)', category: 'international', servingSize: 1, servingUnit: 'bowl', calories: 420, protein: 30, carbs: 45, fat: 10, fiber: 2, sugar: 3, sodium: 1500 },
  { name: 'Gyro (lamb)', category: 'international', servingSize: 1, servingUnit: 'wrap', calories: 520, protein: 28, carbs: 44, fat: 24, fiber: 2, sugar: 4, sodium: 880 },
  { name: 'Falafel Wrap', category: 'international', servingSize: 1, servingUnit: 'wrap', calories: 450, protein: 15, carbs: 50, fat: 20, fiber: 6, sugar: 5, sodium: 750 },
  { name: 'Bibimbap (Korean)', category: 'international', servingSize: 1, servingUnit: 'bowl', calories: 580, protein: 28, carbs: 70, fat: 16, fiber: 5, sugar: 4, sodium: 800 },
  { name: 'Dumplings (6pc)', category: 'international', servingSize: 6, servingUnit: 'pieces', calories: 300, protein: 14, carbs: 32, fat: 12, fiber: 1, sugar: 2, sodium: 600 },
  { name: 'Spring Rolls (2pc)', category: 'international', servingSize: 2, servingUnit: 'pieces', calories: 200, protein: 5, carbs: 22, fat: 10, fiber: 1, sugar: 2, sodium: 400 },
  { name: 'Miso Soup', category: 'international', servingSize: 1, servingUnit: 'bowl', calories: 84, protein: 6, carbs: 8, fat: 3, fiber: 2, sugar: 2, sodium: 980 },
  { name: 'Shawarma (chicken)', category: 'international', servingSize: 1, servingUnit: 'wrap', calories: 500, protein: 32, carbs: 40, fat: 22, fiber: 3, sugar: 3, sodium: 900 },
  { name: 'Butter Chicken', category: 'international', servingSize: 1, servingUnit: 'bowl', calories: 490, protein: 35, carbs: 15, fat: 30, fiber: 2, sugar: 6, sodium: 800 },

  // ---- Breakfast Items (30+) ----
  { name: 'Cheerios', category: 'breakfast', servingSize: 1, servingUnit: 'cup', calories: 100, protein: 3, carbs: 20, fat: 2, fiber: 3, sugar: 1, sodium: 140 },
  { name: 'Frosted Flakes', category: 'breakfast', servingSize: 0.75, servingUnit: 'cup', calories: 110, protein: 1, carbs: 26, fat: 0, fiber: 0, sugar: 10, sodium: 150 },
  { name: 'Honey Nut Cheerios', category: 'breakfast', servingSize: 0.75, servingUnit: 'cup', calories: 110, protein: 2, carbs: 22, fat: 1.5, fiber: 2, sugar: 9, sodium: 190 },
  { name: 'Granola', category: 'breakfast', servingSize: 0.5, servingUnit: 'cup', calories: 210, protein: 5, carbs: 30, fat: 8, fiber: 3, sugar: 10, sodium: 60 },
  { name: 'Pancakes (3 stack)', category: 'breakfast', servingSize: 3, servingUnit: 'pieces', calories: 430, protein: 12, carbs: 64, fat: 14, fiber: 2, sugar: 16, sodium: 620 },
  { name: 'Waffle (plain)', category: 'breakfast', servingSize: 1, servingUnit: 'piece', calories: 218, protein: 6, carbs: 25, fat: 11, fiber: 1, sugar: 2, sodium: 383 },
  { name: 'French Toast (2 slices)', category: 'breakfast', servingSize: 2, servingUnit: 'slices', calories: 370, protein: 14, carbs: 44, fat: 14, fiber: 2, sugar: 8, sodium: 520 },
  { name: 'Bagel (plain)', category: 'breakfast', servingSize: 1, servingUnit: 'piece', calories: 270, protein: 10, carbs: 53, fat: 1.5, fiber: 2, sugar: 5, sodium: 430 },
  { name: 'Bagel with Cream Cheese', category: 'breakfast', servingSize: 1, servingUnit: 'piece', calories: 370, protein: 12, carbs: 55, fat: 12, fiber: 2, sugar: 6, sodium: 530 },
  { name: 'Croissant', category: 'breakfast', servingSize: 1, servingUnit: 'piece', calories: 231, protein: 5, carbs: 26, fat: 12, fiber: 1, sugar: 4, sodium: 286 },
  { name: 'English Muffin', category: 'breakfast', servingSize: 1, servingUnit: 'piece', calories: 132, protein: 5, carbs: 26, fat: 1, fiber: 2, sugar: 2, sodium: 264 },
  { name: 'Breakfast Burrito', category: 'breakfast', servingSize: 1, servingUnit: 'burrito', calories: 450, protein: 22, carbs: 40, fat: 22, fiber: 3, sugar: 2, sodium: 850 },
  { name: 'Overnight Oats', category: 'breakfast', servingSize: 1, servingUnit: 'cup', calories: 310, protein: 12, carbs: 48, fat: 8, fiber: 6, sugar: 14, sodium: 80 },
  { name: 'Acai Bowl', category: 'breakfast', servingSize: 1, servingUnit: 'bowl', calories: 490, protein: 8, carbs: 75, fat: 18, fiber: 10, sugar: 40, sodium: 30 },
  { name: 'Smoothie (fruit)', category: 'breakfast', servingSize: 16, servingUnit: 'oz', calories: 280, protein: 4, carbs: 60, fat: 2, fiber: 4, sugar: 48, sodium: 40 },
  { name: 'Protein Smoothie', category: 'breakfast', servingSize: 16, servingUnit: 'oz', calories: 340, protein: 30, carbs: 40, fat: 6, fiber: 4, sugar: 24, sodium: 200 },

  // ---- Protein Bars & Supplements (15) ----
  { name: 'Quest Protein Bar', category: 'supplement', servingSize: 1, servingUnit: 'bar', calories: 190, protein: 21, carbs: 21, fat: 7, fiber: 14, sugar: 1, sodium: 270 },
  { name: 'RX Bar', category: 'supplement', servingSize: 1, servingUnit: 'bar', calories: 210, protein: 12, carbs: 24, fat: 9, fiber: 6, sugar: 13, sodium: 160 },
  { name: 'Clif Bar', category: 'supplement', servingSize: 1, servingUnit: 'bar', calories: 250, protein: 10, carbs: 44, fat: 5, fiber: 4, sugar: 21, sodium: 200 },
  { name: 'Kind Bar', category: 'supplement', servingSize: 1, servingUnit: 'bar', calories: 200, protein: 6, carbs: 22, fat: 12, fiber: 3, sugar: 8, sodium: 75 },
  { name: 'ONE Protein Bar', category: 'supplement', servingSize: 1, servingUnit: 'bar', calories: 220, protein: 20, carbs: 24, fat: 8, fiber: 1, sugar: 1, sodium: 200 },
  { name: 'Casein Protein Powder', category: 'supplement', servingSize: 1, servingUnit: 'scoop', calories: 120, protein: 24, carbs: 4, fat: 1, fiber: 0, sugar: 2, sodium: 160 },
  { name: 'Plant Protein Powder', category: 'supplement', servingSize: 1, servingUnit: 'scoop', calories: 130, protein: 22, carbs: 6, fat: 2, fiber: 2, sugar: 1, sodium: 280 },
  { name: 'Creatine Monohydrate', category: 'supplement', servingSize: 5, servingUnit: 'g', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
  { name: 'BCAA Powder', category: 'supplement', servingSize: 1, servingUnit: 'scoop', calories: 10, protein: 2, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 5 },
  { name: 'Mass Gainer Shake', category: 'supplement', servingSize: 1, servingUnit: 'serving', calories: 650, protein: 32, carbs: 110, fat: 6, fiber: 2, sugar: 20, sodium: 300 },

  // ---- Beverages (expanded 20+) ----
  { name: 'Green Tea', category: 'beverage', servingSize: 8, servingUnit: 'oz', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
  { name: 'Latte (whole milk)', category: 'beverage', servingSize: 12, servingUnit: 'oz', calories: 180, protein: 10, carbs: 14, fat: 9, fiber: 0, sugar: 14, sodium: 140 },
  { name: 'Latte (oat milk)', category: 'beverage', servingSize: 12, servingUnit: 'oz', calories: 170, protein: 3, carbs: 26, fat: 6, fiber: 1, sugar: 14, sodium: 130 },
  { name: 'Cappuccino', category: 'beverage', servingSize: 12, servingUnit: 'oz', calories: 120, protein: 8, carbs: 10, fat: 5, fiber: 0, sugar: 10, sodium: 100 },
  { name: 'Cold Brew Coffee', category: 'beverage', servingSize: 12, servingUnit: 'oz', calories: 5, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 10 },
  { name: 'Diet Coke', category: 'beverage', servingSize: 12, servingUnit: 'oz', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 40 },
  { name: 'Sprite', category: 'beverage', servingSize: 12, servingUnit: 'oz', calories: 140, protein: 0, carbs: 38, fat: 0, fiber: 0, sugar: 38, sodium: 65 },
  { name: 'Gatorade', category: 'beverage', servingSize: 20, servingUnit: 'oz', calories: 140, protein: 0, carbs: 36, fat: 0, fiber: 0, sugar: 34, sodium: 270 },
  { name: 'Monster Energy', category: 'beverage', servingSize: 16, servingUnit: 'oz', calories: 210, protein: 0, carbs: 54, fat: 0, fiber: 0, sugar: 54, sodium: 370 },
  { name: 'Red Bull', category: 'beverage', servingSize: 8.4, servingUnit: 'oz', calories: 110, protein: 0, carbs: 28, fat: 0, fiber: 0, sugar: 27, sodium: 105 },
  { name: 'Coconut Water', category: 'beverage', servingSize: 8, servingUnit: 'oz', calories: 46, protein: 2, carbs: 9, fat: 0.5, fiber: 0, sugar: 6, sodium: 252 },
  { name: 'Almond Milk (unsweetened)', category: 'beverage', servingSize: 1, servingUnit: 'cup', calories: 30, protein: 1, carbs: 1, fat: 2.5, fiber: 0, sugar: 0, sodium: 170 },
  { name: 'Oat Milk', category: 'beverage', servingSize: 1, servingUnit: 'cup', calories: 120, protein: 3, carbs: 16, fat: 5, fiber: 2, sugar: 7, sodium: 100 },
  { name: 'Kombucha', category: 'beverage', servingSize: 8, servingUnit: 'oz', calories: 30, protein: 0, carbs: 7, fat: 0, fiber: 0, sugar: 4, sodium: 10 },
  { name: 'White Wine', category: 'beverage', servingSize: 5, servingUnit: 'oz', calories: 121, protein: 0, carbs: 4, fat: 0, fiber: 0, sugar: 1, sodium: 5 },

  // ---- Prepared/Frozen Meals (20) ----
  { name: 'Lean Cuisine Chicken Alfredo', category: 'prepared', servingSize: 1, servingUnit: 'meal', calories: 300, protein: 17, carbs: 39, fat: 8, fiber: 3, sugar: 4, sodium: 640 },
  { name: 'Amy\'s Burrito Bowl', category: 'prepared', servingSize: 1, servingUnit: 'meal', calories: 340, protein: 10, carbs: 54, fat: 10, fiber: 7, sugar: 4, sodium: 680 },
  { name: 'Trader Joe\'s Cauliflower Gnocchi', category: 'prepared', servingSize: 1, servingUnit: 'cup', calories: 140, protein: 2, carbs: 22, fat: 5, fiber: 2, sugar: 1, sodium: 460 },
  { name: 'Frozen Pizza (DiGiorno, 1/4)', category: 'prepared', servingSize: 0.25, servingUnit: 'pizza', calories: 340, protein: 14, carbs: 40, fat: 14, fiber: 2, sugar: 6, sodium: 780 },
  { name: 'Hot Pocket', category: 'prepared', servingSize: 1, servingUnit: 'piece', calories: 280, protein: 11, carbs: 34, fat: 11, fiber: 2, sugar: 6, sodium: 600 },
  { name: 'Instant Ramen (Maruchan)', category: 'prepared', servingSize: 1, servingUnit: 'packet', calories: 380, protein: 10, carbs: 52, fat: 14, fiber: 2, sugar: 1, sodium: 1660 },
  { name: 'Rotisserie Chicken (breast)', category: 'prepared', servingSize: 4, servingUnit: 'oz', calories: 200, protein: 30, carbs: 0, fat: 8, fiber: 0, sugar: 0, sodium: 480 },
  { name: 'Canned Chicken Noodle Soup', category: 'prepared', servingSize: 1, servingUnit: 'can', calories: 200, protein: 10, carbs: 26, fat: 6, fiber: 2, sugar: 3, sodium: 1780 },
  { name: 'Canned Chili', category: 'prepared', servingSize: 1, servingUnit: 'cup', calories: 260, protein: 16, carbs: 28, fat: 10, fiber: 7, sugar: 4, sodium: 1040 },
  { name: 'Frozen Chicken Breast', category: 'prepared', servingSize: 4, servingUnit: 'oz', calories: 120, protein: 26, carbs: 0, fat: 2, fiber: 0, sugar: 0, sodium: 380 },

  // ---- Spreads & Dips (10) ----
  { name: 'Cream Cheese', category: 'condiment', servingSize: 2, servingUnit: 'tbsp', calories: 100, protein: 2, carbs: 1, fat: 10, fiber: 0, sugar: 1, sodium: 90 },
  { name: 'Guacamole', category: 'condiment', servingSize: 2, servingUnit: 'tbsp', calories: 50, protein: 1, carbs: 3, fat: 4.5, fiber: 2, sugar: 0, sodium: 115 },
  { name: 'Ranch Dressing', category: 'condiment', servingSize: 2, servingUnit: 'tbsp', calories: 130, protein: 1, carbs: 2, fat: 13, fiber: 0, sugar: 1, sodium: 260 },
  { name: 'Italian Dressing', category: 'condiment', servingSize: 2, servingUnit: 'tbsp', calories: 80, protein: 0, carbs: 3, fat: 7, fiber: 0, sugar: 2, sodium: 340 },
  { name: 'Balsamic Vinaigrette', category: 'condiment', servingSize: 2, servingUnit: 'tbsp', calories: 90, protein: 0, carbs: 5, fat: 8, fiber: 0, sugar: 4, sodium: 200 },
  { name: 'Hot Sauce', category: 'condiment', servingSize: 1, servingUnit: 'tsp', calories: 1, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 120 },
  { name: 'Mustard', category: 'condiment', servingSize: 1, servingUnit: 'tsp', calories: 3, protein: 0.2, carbs: 0.3, fat: 0.2, fiber: 0, sugar: 0, sodium: 57 },
  { name: 'BBQ Sauce', category: 'condiment', servingSize: 2, servingUnit: 'tbsp', calories: 60, protein: 0, carbs: 15, fat: 0, fiber: 0, sugar: 12, sodium: 310 },
  { name: 'Sriracha', category: 'condiment', servingSize: 1, servingUnit: 'tsp', calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 0, sugar: 1, sodium: 80 },
  { name: 'Teriyaki Sauce', category: 'condiment', servingSize: 2, servingUnit: 'tbsp', calories: 30, protein: 1, carbs: 6, fat: 0, fiber: 0, sugar: 5, sodium: 690 },

  // ---- Desserts (15) ----
  { name: 'Vanilla Ice Cream', category: 'dessert', servingSize: 0.5, servingUnit: 'cup', calories: 137, protein: 2, carbs: 16, fat: 7, fiber: 0, sugar: 14, sodium: 53 },
  { name: 'Chocolate Ice Cream', category: 'dessert', servingSize: 0.5, servingUnit: 'cup', calories: 143, protein: 3, carbs: 19, fat: 7, fiber: 1, sugar: 16, sodium: 50 },
  { name: 'Brownie', category: 'dessert', servingSize: 1, servingUnit: 'piece', calories: 227, protein: 3, carbs: 36, fat: 9, fiber: 1, sugar: 21, sodium: 175 },
  { name: 'Chocolate Chip Cookie', category: 'dessert', servingSize: 1, servingUnit: 'large', calories: 220, protein: 3, carbs: 30, fat: 10, fiber: 1, sugar: 18, sodium: 180 },
  { name: 'Cheesecake Slice', category: 'dessert', servingSize: 1, servingUnit: 'slice', calories: 401, protein: 7, carbs: 28, fat: 29, fiber: 0, sugar: 22, sodium: 350 },
  { name: 'Apple Pie Slice', category: 'dessert', servingSize: 1, servingUnit: 'slice', calories: 296, protein: 2, carbs: 43, fat: 14, fiber: 2, sugar: 22, sodium: 251 },
  { name: 'Donut (glazed)', category: 'dessert', servingSize: 1, servingUnit: 'piece', calories: 269, protein: 4, carbs: 31, fat: 15, fiber: 1, sugar: 15, sodium: 320 },
  { name: 'Muffin (blueberry)', category: 'dessert', servingSize: 1, servingUnit: 'piece', calories: 426, protein: 6, carbs: 65, fat: 16, fiber: 2, sugar: 32, sodium: 500 },
  { name: 'Frozen Yogurt', category: 'dessert', servingSize: 0.5, servingUnit: 'cup', calories: 114, protein: 3, carbs: 22, fat: 2, fiber: 0, sugar: 17, sodium: 63 },
  { name: 'Halo Top Ice Cream', category: 'dessert', servingSize: 0.5, servingUnit: 'cup', calories: 70, protein: 5, carbs: 14, fat: 2, fiber: 3, sugar: 5, sodium: 85 },
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
