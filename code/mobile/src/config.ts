const ENV = {
  dev: {
    apiUrl: 'http://localhost:3000', 
  },
  prod: {
    apiUrl: 'https://ruwt.fly.dev',
  }
};

const isDev = __DEV__; 

export const API_URL = isDev ? ENV.dev.apiUrl : ENV.prod.apiUrl;

// Uncomment this when testing on a physical device using expo go
// export const API_URL = ENV.prod.apiUrl;

export const ENDPOINTS = {
  runners: `${API_URL}/runners`,
  rewriteChat: `${API_URL}/runners/rewrite/chat`,
};
