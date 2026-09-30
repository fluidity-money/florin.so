'use client';

import posthog from 'posthog-js';

type EventProperties = Record<string, string | number | boolean | null | undefined>;

let posthogStarted = false;

export function startPostHog() {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!posthogKey || posthogStarted) return;

  posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    autocapture: true,
    capture_exceptions: true,
    capture_pageview: 'history_change',
    capture_pageleave: true,
    person_profiles: 'identified_only',
  });
  posthogStarted = true;
}

export function isPostHogStarted() {
  return posthogStarted;
}

export function captureEvent(event: string, properties: EventProperties = {}) {
  if (!isPostHogStarted()) return;
  posthog.capture(event, properties);
}
