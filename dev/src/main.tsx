import * as Sentry from '@sentry/react';
import { createRoot } from 'react-dom/client';
import App from './App';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  tunnel: '/api/sentry-tunnel',
  environment: import.meta.env.DEV ? 'development' : 'production',
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.5,
});

const root = document.getElementById('root');
if (root) {
  const Root = () => <App />;
  const rootEl = createRoot(root);
  rootEl.render(<Root />);
}
