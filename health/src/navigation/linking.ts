import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'https://ruwt.health',
    'https://ruwt-health.pages.dev',
    'http://localhost:5174',
  ],
  config: {
    screens: {
      Landing: '',
      Login: 'login',
      Register: 'register',
      Callback: 'callback',
      Dashboard: 'dashboard',
      LogMeal: 'log-meal',
      LogWorkout: 'log-workout',
      FoodSearch: 'foods',
      Progress: 'progress',
      Profile: 'profile',
      Coach: 'coach',
      MealHistory: 'meal-history',
    },
  },
};
