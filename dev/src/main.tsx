import { createRoot } from 'react-dom/client';
import App from './App';

const root = document.getElementById('root');
if (root) {
  const Root = () => <App />;
  const rootEl = createRoot(root);
  rootEl.render(<Root />);
}
