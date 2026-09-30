'use client';

import { useEffect, useState } from 'react';
import { startPostHog } from '../lib/analytics';

const CONSENT_COOKIE = 'florin_analytics_consent';
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

function readConsent() {
  const prefix = `${CONSENT_COOKIE}=`;
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(prefix));

  return cookie?.slice(prefix.length);
}

function saveConsent(value: 'allowed' | 'declined') {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = readConsent();

    if (consent === 'allowed') {
      startPostHog();
    } else if (consent !== 'declined') {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function allowAnalytics() {
    saveConsent('allowed');
    startPostHog();
    setVisible(false);
  }

  function declineAnalytics() {
    saveConsent('declined');
    setVisible(false);
  }

  return (
    <aside
      className="cookie-consent"
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
    >
      <div className="cookie-consent__content">
        <p className="cookie-consent__copy">
          We use analytics cookies to understand how Florin is used. We only
          collect this data to discover and fix errors.{' '}
          <a href="https://florin.so/privacy.pdf">Read our privacy policy.</a>
        </p>
        <div className="cookie-consent__actions">
          <button className="btn btn--ghost" type="button" onClick={declineAnalytics}>
            Decline
          </button>
          <button className="btn btn--primary" type="button" onClick={allowAnalytics}>
            Allow analytics
          </button>
        </div>
      </div>
    </aside>
  );
}
