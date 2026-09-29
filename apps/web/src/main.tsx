import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/index.css';

const container = document.getElementById('root');
if (container === null) throw new Error('Root container #root is missing from index.html');

const root = createRoot(container);

// In a dev build the app is wrapped in the presenter overlay; in `vite build` the dev module is dropped
// entirely (Vite folds `import.meta.env.DEV`) and this becomes a plain <App /> render.
if (import.meta.env.DEV) {
  void import('./dev/renderDev').then(({ renderDevApp }) => renderDevApp(root));
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

