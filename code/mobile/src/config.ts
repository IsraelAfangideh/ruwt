import { Platform } from 'react-native';

// Replace 'localhost' with your machine's LAN IP if testing on a physical device
const API_URL = Platform.select({
  android: 'http://10.0.2.2:3000', 
  ios: 'http://localhost:3000',
  default: 'http://localhost:3000',
});

export const ENDPOINTS = {
  runners: `${API_URL}/runners`,
  peacemakerChat: `${API_URL}/runners/peacemaker/chat`,
};
