import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AppProviders } from './providers';

export function App(): JSX.Element {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
