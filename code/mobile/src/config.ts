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

export const ENDPOINTS = {
  runners: `${API_URL}/runners`,
  peacemakerChat: `${API_URL}/runners/peacemaker/chat`,
};
