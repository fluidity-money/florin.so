'use client';
import { useSyncExternalStore } from 'react';
import { THEME_EVENT, THEME_STORAGE_KEY } from './theme-init';

export type ThemeMode = 'light' | 'dark';

function currentTheme(): ThemeMode {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

// A manual choice. One that differs from the device is saved and outlives
// the device setting. Choosing the device's own mode clears it, so the page
// follows the device again.
export function setThemeMode(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  const deviceMode: ThemeMode = window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
  try {
    if (mode === deviceMode) localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Storage can be blocked. The choice still holds for this page view.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, currentTheme, () => 'light');
}
