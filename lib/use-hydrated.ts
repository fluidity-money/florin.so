'use client';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

// False in the prerendered HTML and during hydration, true from then on.
// The shared layout is prerendered without a reliable pathname on Vercel, so
// anything that depends on the route must wait for this. Rendering it in the
// HTML instead makes the first client render differ, React then rebuilds the
// whole document, and that drops the theme on <html>.
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
