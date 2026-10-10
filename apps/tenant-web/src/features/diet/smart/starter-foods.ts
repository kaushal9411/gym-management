import type { MealType } from '../types';
import type { Allergen, DietType, FoodRole } from './engine';

export interface StarterFood {
  name: string;
  category: string;
  serving: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  sugar: number;
  sodium: number;
  diet: DietType;
  role: FoodRole;
  meals: MealType[];
  allergens: Allergen[];
}

/**
 * Common Indian foods with the planner tags (diet type, role, meals, allergens) the food table does not store.
 * "Add starter foods" inserts these as normal foods; the planner recognises foods by name, so a tenant's own
 * foods with the same name are tagged too and everything else is ignored by the planner.
 */
export const STARTER_FOODS: StarterFood[] = [
  { name: 'Chicken breast, grilled', category: 'Meat', serving: '100 g', kcal: 165, p: 31, c: 0, f: 3.6, sugar: 0, sodium: 74, diet: 'NON_VEGETARIAN', role: 'PROTEIN', meals: ['LUNCH', 'DINNER', 'POST_WORKOUT'], allergens: [] },
  { name: 'Egg, boiled', category: 'Eggs', serving: '1 egg (50 g)', kcal: 78, p: 6.3, c: 0.6, f: 5.3, sugar: 0.6, sodium: 62, diet: 'EGGETARIAN', role: 'PROTEIN', meals: ['BREAKFAST', 'MORNING_SNACK', 'EVENING_SNACK'], allergens: ['egg'] },
  { name: 'Egg whites, boiled', category: 'Eggs', serving: '3 whites (100 g)', kcal: 52, p: 11, c: 0.7, f: 0.2, sugar: 0.7, sodium: 166, diet: 'EGGETARIAN', role: 'PROTEIN', meals: ['BREAKFAST', 'EVENING_SNACK', 'POST_WORKOUT'], allergens: ['egg'] },
  { name: 'Rohu fish, grilled', category: 'Fish', serving: '100 g', kcal: 120, p: 21, c: 0, f: 3.5, sugar: 0, sodium: 60, diet: 'NON_VEGETARIAN', role: 'PROTEIN', meals: ['LUNCH', 'DINNER'], allergens: ['fish'] },
  { name: 'Paneer', category: 'Dairy', serving: '100 g', kcal: 265, p: 18, c: 1.2, f: 20, sugar: 1.2, sodium: 30, diet: 'VEGETARIAN', role: 'PROTEIN', meals: ['BREAKFAST', 'LUNCH', 'DINNER'], allergens: ['lactose'] },
  { name: 'Tofu, firm', category: 'Soy', serving: '100 g', kcal: 144, p: 17, c: 3, f: 8.7, sugar: 0.6, sodium: 14, diet: 'VEGAN', role: 'PROTEIN', meals: ['BREAKFAST', 'LUNCH', 'DINNER'], allergens: ['soy'] },
  { name: 'Soya chunks, cooked', category: 'Soy', serving: '100 g', kcal: 140, p: 21, c: 13, f: 0.5, sugar: 0, sodium: 20, diet: 'VEGAN', role: 'PROTEIN', meals: ['LUNCH', 'DINNER'], allergens: ['soy'] },
  { name: 'Moong dal, cooked', category: 'Pulses', serving: '150 g', kcal: 158, p: 10.5, c: 28.5, f: 0.6, sugar: 1.5, sodium: 120, diet: 'VEGAN', role: 'PROTEIN', meals: ['LUNCH', 'DINNER'], allergens: [] },
  { name: 'Rajma, cooked', category: 'Pulses', serving: '150 g', kcal: 190, p: 13, c: 34, f: 0.8, sugar: 1.5, sodium: 10, diet: 'VEGAN', role: 'PROTEIN', meals: ['LUNCH', 'DINNER'], allergens: [] },
  { name: 'Chana, boiled', category: 'Pulses', serving: '150 g', kcal: 246, p: 13.5, c: 41, f: 3.9, sugar: 7, sodium: 18, diet: 'VEGAN', role: 'PROTEIN', meals: ['LUNCH', 'DINNER', 'EVENING_SNACK'], allergens: [] },
  { name: 'Besan chilla', category: 'Breakfast', serving: '2 chilla (100 g)', kcal: 185, p: 9, c: 25, f: 5, sugar: 2, sodium: 250, diet: 'VEGAN', role: 'PROTEIN', meals: ['BREAKFAST'], allergens: [] },
  { name: 'Curd, thick (hung)', category: 'Dairy', serving: '100 g', kcal: 97, p: 9, c: 4, f: 5, sugar: 4, sodium: 36, diet: 'VEGETARIAN', role: 'DAIRY', meals: ['BREAKFAST', 'MORNING_SNACK', 'EVENING_SNACK'], allergens: ['lactose'] },
  { name: 'Curd, low fat', category: 'Dairy', serving: '150 g', kcal: 90, p: 5.3, c: 7.5, f: 2.3, sugar: 7, sodium: 70, diet: 'VEGETARIAN', role: 'DAIRY', meals: ['LUNCH', 'DINNER', 'EVENING_SNACK'], allergens: ['lactose'] },
  { name: 'Milk, toned', category: 'Dairy', serving: '250 ml', kcal: 145, p: 8, c: 12, f: 7.5, sugar: 12, sodium: 100, diet: 'VEGETARIAN', role: 'DAIRY', meals: ['BREAKFAST', 'MORNING_SNACK', 'EVENING_SNACK', 'PRE_WORKOUT'], allergens: ['lactose'] },
  { name: 'Soy milk, unsweetened', category: 'Soy', serving: '250 ml', kcal: 80, p: 7, c: 4, f: 4, sugar: 1, sodium: 90, diet: 'VEGAN', role: 'DAIRY', meals: ['BREAKFAST', 'MORNING_SNACK', 'EVENING_SNACK'], allergens: ['soy'] },
  { name: 'Whey protein', category: 'Supplement', serving: '1 scoop (30 g)', kcal: 120, p: 24, c: 3, f: 1.5, sugar: 2, sodium: 50, diet: 'VEGETARIAN', role: 'SUPPLEMENT', meals: ['MORNING_SNACK', 'EVENING_SNACK', 'POST_WORKOUT'], allergens: ['lactose'] },
  { name: 'Plant protein (pea)', category: 'Supplement', serving: '1 scoop (30 g)', kcal: 115, p: 21, c: 4, f: 2, sugar: 1, sodium: 180, diet: 'VEGAN', role: 'SUPPLEMENT', meals: ['MORNING_SNACK', 'EVENING_SNACK', 'POST_WORKOUT'], allergens: [] },
  { name: 'Roti, whole wheat', category: 'Grains', serving: '1 roti (40 g)', kcal: 120, p: 4, c: 22, f: 2, sugar: 0.5, sodium: 120, diet: 'VEGAN', role: 'CARB', meals: ['BREAKFAST', 'LUNCH', 'DINNER'], allergens: ['gluten'] },
  { name: 'Brown rice, cooked', category: 'Grains', serving: '100 g', kcal: 112, p: 2.6, c: 23, f: 0.9, sugar: 0.4, sodium: 5, diet: 'VEGAN', role: 'CARB', meals: ['LUNCH', 'DINNER'], allergens: [] },
  { name: 'White rice, steamed', category: 'Grains', serving: '100 g', kcal: 130, p: 2.7, c: 28, f: 0.3, sugar: 0, sodium: 1, diet: 'VEGAN', role: 'CARB', meals: ['LUNCH', 'DINNER', 'POST_WORKOUT'], allergens: [] },
  { name: 'Oats', category: 'Grains', serving: '40 g dry', kcal: 150, p: 5, c: 27, f: 2.7, sugar: 0.5, sodium: 2, diet: 'VEGAN', role: 'CARB', meals: ['BREAKFAST', 'PRE_WORKOUT'], allergens: ['gluten'] },
  { name: 'Poha', category: 'Breakfast', serving: '150 g plate', kcal: 200, p: 4, c: 37, f: 5, sugar: 2, sodium: 250, diet: 'VEGAN', role: 'CARB', meals: ['BREAKFAST', 'PRE_WORKOUT', 'EVENING_SNACK'], allergens: [] },
  { name: 'Upma', category: 'Breakfast', serving: '150 g plate', kcal: 190, p: 4.5, c: 30, f: 6, sugar: 2, sodium: 300, diet: 'VEGAN', role: 'CARB', meals: ['BREAKFAST'], allergens: ['gluten'] },
  { name: 'Idli', category: 'Breakfast', serving: '2 idlis (100 g)', kcal: 130, p: 4, c: 26, f: 0.5, sugar: 0.5, sodium: 200, diet: 'VEGAN', role: 'CARB', meals: ['BREAKFAST'], allergens: [] },
  { name: 'Dosa, plain', category: 'Breakfast', serving: '1 dosa (80 g)', kcal: 120, p: 3, c: 22, f: 3, sugar: 0.5, sodium: 150, diet: 'VEGAN', role: 'CARB', meals: ['BREAKFAST'], allergens: [] },
  { name: 'Sweet potato, boiled', category: 'Vegetables', serving: '100 g', kcal: 86, p: 1.6, c: 20, f: 0.1, sugar: 4, sodium: 36, diet: 'VEGAN', role: 'CARB', meals: ['PRE_WORKOUT', 'EVENING_SNACK'], allergens: [] },
  { name: 'Whole wheat bread', category: 'Grains', serving: '2 slices (60 g)', kcal: 150, p: 6, c: 28, f: 2, sugar: 3, sodium: 300, diet: 'VEGAN', role: 'CARB', meals: ['BREAKFAST', 'PRE_WORKOUT', 'EVENING_SNACK'], allergens: ['gluten'] },
  { name: 'Banana', category: 'Fruit', serving: '1 medium', kcal: 105, p: 1.3, c: 27, f: 0.4, sugar: 14, sodium: 1, diet: 'VEGAN', role: 'FRUIT', meals: ['BREAKFAST', 'PRE_WORKOUT', 'MORNING_SNACK', 'EVENING_SNACK', 'POST_WORKOUT'], allergens: [] },
  { name: 'Apple', category: 'Fruit', serving: '1 medium', kcal: 95, p: 0.5, c: 25, f: 0.3, sugar: 19, sodium: 2, diet: 'VEGAN', role: 'FRUIT', meals: ['MORNING_SNACK', 'EVENING_SNACK'], allergens: [] },
  { name: 'Papaya', category: 'Fruit', serving: '150 g', kcal: 65, p: 0.7, c: 16, f: 0.2, sugar: 11, sodium: 12, diet: 'VEGAN', role: 'FRUIT', meals: ['BREAKFAST', 'MORNING_SNACK'], allergens: [] },
  { name: 'Orange', category: 'Fruit', serving: '1 medium', kcal: 62, p: 1.2, c: 15, f: 0.2, sugar: 12, sodium: 0, diet: 'VEGAN', role: 'FRUIT', meals: ['MORNING_SNACK', 'EVENING_SNACK', 'POST_WORKOUT'], allergens: [] },
  { name: 'Dates', category: 'Fruit', serving: '3 dates', kcal: 85, p: 0.6, c: 22, f: 0.1, sugar: 20, sodium: 1, diet: 'VEGAN', role: 'FRUIT', meals: ['PRE_WORKOUT'], allergens: [] },
  { name: 'Almonds', category: 'Nuts', serving: '10 nuts (12 g)', kcal: 70, p: 2.5, c: 2.6, f: 6, sugar: 0.5, sodium: 0, diet: 'VEGAN', role: 'FAT', meals: ['BREAKFAST', 'MORNING_SNACK', 'EVENING_SNACK'], allergens: ['nuts'] },
  { name: 'Peanut butter, natural', category: 'Nuts', serving: '1 tbsp (16 g)', kcal: 95, p: 4, c: 3, f: 8, sugar: 1, sodium: 75, diet: 'VEGAN', role: 'FAT', meals: ['BREAKFAST', 'EVENING_SNACK', 'PRE_WORKOUT'], allergens: ['nuts'] },
  { name: 'Roasted peanuts', category: 'Nuts', serving: '20 g', kcal: 115, p: 5, c: 3, f: 10, sugar: 0.8, sodium: 2, diet: 'VEGAN', role: 'FAT', meals: ['MORNING_SNACK', 'EVENING_SNACK'], allergens: ['nuts'] },
  { name: 'Ghee', category: 'Fats', serving: '1 tsp (5 g)', kcal: 45, p: 0, c: 0, f: 5, sugar: 0, sodium: 0, diet: 'VEGETARIAN', role: 'FAT', meals: ['LUNCH', 'DINNER'], allergens: ['lactose'] },
  { name: 'Olive oil', category: 'Fats', serving: '1 tsp (5 ml)', kcal: 40, p: 0, c: 0, f: 4.5, sugar: 0, sodium: 0, diet: 'VEGAN', role: 'FAT', meals: ['LUNCH', 'DINNER'], allergens: [] },
  { name: 'Chia seeds', category: 'Seeds', serving: '1 tbsp (12 g)', kcal: 58, p: 2, c: 5, f: 3.7, sugar: 0, sodium: 2, diet: 'VEGAN', role: 'FAT', meals: ['BREAKFAST', 'MORNING_SNACK'], allergens: [] },
  { name: 'Mixed vegetable sabzi', category: 'Vegetables', serving: '100 g', kcal: 60, p: 2, c: 9, f: 2, sugar: 3, sodium: 220, diet: 'VEGAN', role: 'VEGETABLE', meals: ['LUNCH', 'DINNER'], allergens: [] },
  { name: 'Palak sabzi', category: 'Vegetables', serving: '100 g', kcal: 55, p: 3, c: 4, f: 3.5, sugar: 1, sodium: 180, diet: 'VEGAN', role: 'VEGETABLE', meals: ['LUNCH', 'DINNER'], allergens: [] },
  { name: 'Cucumber and tomato salad', category: 'Vegetables', serving: '100 g', kcal: 20, p: 0.8, c: 4, f: 0.2, sugar: 2.5, sodium: 8, diet: 'VEGAN', role: 'VEGETABLE', meals: ['LUNCH', 'DINNER', 'EVENING_SNACK'], allergens: [] },
  { name: 'Broccoli, steamed', category: 'Vegetables', serving: '100 g', kcal: 35, p: 2.8, c: 7, f: 0.4, sugar: 1.7, sodium: 33, diet: 'VEGAN', role: 'VEGETABLE', meals: ['LUNCH', 'DINNER'], allergens: [] },
  { name: 'Lauki sabzi', category: 'Vegetables', serving: '100 g', kcal: 55, p: 1.5, c: 7, f: 2.5, sugar: 3, sodium: 200, diet: 'VEGAN', role: 'VEGETABLE', meals: ['LUNCH', 'DINNER'], allergens: [] },
  { name: 'Sprouts chaat', category: 'Snacks', serving: '100 g', kcal: 100, p: 7, c: 16, f: 1, sugar: 3, sodium: 120, diet: 'VEGAN', role: 'SNACK', meals: ['MORNING_SNACK', 'EVENING_SNACK'], allergens: [] },
  { name: 'Roasted chana', category: 'Snacks', serving: '30 g', kcal: 110, p: 6, c: 18, f: 2, sugar: 2, sodium: 5, diet: 'VEGAN', role: 'SNACK', meals: ['MORNING_SNACK', 'EVENING_SNACK'], allergens: [] },
  { name: 'Makhana, roasted', category: 'Snacks', serving: '30 g', kcal: 105, p: 3, c: 22, f: 0.5, sugar: 0.3, sodium: 1, diet: 'VEGAN', role: 'SNACK', meals: ['MORNING_SNACK', 'EVENING_SNACK'], allergens: [] },
];
