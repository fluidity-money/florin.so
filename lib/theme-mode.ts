'use client';
import { useSyncExternalStore } from 'react';
import { THEME_EVENT } from './theme-init';

export type ThemeMode = 'light' | 'dark';

function currentTheme(): ThemeMode {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

// A manual choice, for this visit only. Nothing is saved, so the next visit
// starts from the device setting again.
export function setThemeMode(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, currentTheme, () => 'light');
}
