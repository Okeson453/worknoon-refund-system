import { CueOverlay as PresenterOverlay } from './CueOverlay';

/**
 * Dev build: show the presenter overlay.
 *
 * The production replacement lives in the same path with a `.prod.tsx` extension and is selected by
 * Vite's `resolve.conditions`, so a production build never even parses the overlay code.
 */
export const CueOverlay = PresenterOverlay;
