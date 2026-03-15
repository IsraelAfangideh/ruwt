import * as Sentry from '@sentry/react';
import { createRoot } from 'react-dom/client';
import App from './App';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  tunnel: '/api/sentry-tunnel',
  environment: /* istanbul ignore next -- @preserve */ import.meta.env.DEV ? 'development' : 'production',
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 0.5,
});

const root = document.getElementById('root');
if (root) {
  /* istanbul ignore next -- @preserve */
  const Root = () => <App />;
  const rootEl = createRoot(root);
  rootEl.render(<Root />);
}
