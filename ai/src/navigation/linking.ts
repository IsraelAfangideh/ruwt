import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [typeof window !== 'undefined' ? window.location.origin : 'https://ruwt.ai'],
  config: {
    screens: {
      Landing: '',
      Download: 'download',
      Blog: 'blog',
      BlogPost: 'blog/:slug',
      Login: 'login',
      Register: 'register',
      Callback: 'callback',
      Dashboard: 'dashboard',
      OrgSettings: 'settings/org',
    },
  },
};
