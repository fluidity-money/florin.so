'use client';

import { useFeatureFlagEnabled } from 'posthog-js/react';

export function useFeature(key: string, defaultValue = false): boolean {
  return useFeatureFlagEnabled(key, defaultValue);
}

export default useFeature;
