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

// A manual choice. Saved, so it outlives the device setting from here on.
export function setThemeMode(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Storage can be blocked. The choice still holds for this page view.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, currentTheme, () => 'light');
}
