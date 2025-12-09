// Simple configuration for API URL
// In production, this should point to the deployed backend
// In development, it points to localhost

const ENV = {
  dev: {
    apiUrl: 'http://localhost:3000', 
  },
  prod: {
    apiUrl: 'https://ruwt.fly.dev',
  }
};

// Simple logic to choose environment
// In a real Expo app, we might use Updates.releaseChannel or __DEV__
// For this MVP, we default to prod if not explicitly running locally
const isDev = __DEV__; 

export const API_URL = isDev ? ENV.dev.apiUrl : ENV.prod.apiUrl;
