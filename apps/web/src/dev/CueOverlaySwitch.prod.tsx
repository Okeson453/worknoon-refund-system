/**
 * Production stand-in for the presenter overlay.
 *
 * Selected by the `production` resolve condition in vite.config.ts, so `npm run build` tree-shakes
 * CueOverlay.tsx, cues.ts and overlay.css out entirely. Reviewers never see the overlay.
 */
export function CueOverlay(): null {
  return null;
}
