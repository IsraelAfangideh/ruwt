export type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  Register: undefined;
  Callback: undefined;
  Dashboard: undefined;
  LogMeal: { mealType?: string; date?: string } | undefined;
  LogWorkout: { prefill?: any } | undefined;
  FoodSearch: undefined;
  Progress: undefined;
  Profile: undefined;
  Coach: undefined;
  MealHistory: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
