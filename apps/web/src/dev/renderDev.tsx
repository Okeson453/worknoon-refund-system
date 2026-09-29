import { StrictMode } from 'react';
import type { Root } from 'react-dom/client';
import { App } from '../app/App';
import { DevProviders } from './DevProviders';
import './overlay.css';

/**
 * Dev-only entry. Imported dynamically from main.tsx behind `import.meta.env.DEV`, so neither this
 * module, the overlay, nor its stylesheet is reachable from a production build.
 */
export function renderDevApp(root: Root): void {
  root.render(
    <StrictMode>
      <DevProviders>
        <App />
      </DevProviders>
    </StrictMode>,
  );
}

// Vite reloads this module on edit, which would re-render the tree and drop overlay state. Nothing to
// do yet: accept the update so the overlay survives a hot reload of the app during a live rehearsal.
if (import.meta.hot) {
  import.meta.hot.accept();
}
