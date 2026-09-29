import { SessionProvider, type SessionProviderProps } from './providerSwitch';
import { CueOverlay } from './CueOverlaySwitch';

/**
 * Dev-only provider shell.
 *
 * The two switches resolve differently per build:
 *   - `providerSwitch.tsx` exports the real session provider in a dev build and a pass-through in prod.
 *   - `CueOverlaySwitch.tsx` exports the overlay in a dev build and a null component in prod.
 *
 * Vite folds `import.meta.env.DEV` at build time, so in a production bundle these collapse to
 * `<>{children}</>` and not one byte of the overlay reaches the nginx image.
 */
export function DevProviders({ children }: SessionProviderProps): JSX.Element {
  return (
    <SessionProvider>
      {children}
      <CueOverlay />
    </SessionProvider>
  );
}
