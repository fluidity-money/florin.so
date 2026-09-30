import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const requiredEvents = {
  'components/Header.tsx': [
    'wallet_connection_requested',
    'wallet_connection_succeeded',
    'wallet_connection_failed',
    'wallet_disconnected',
    'network_selector_opened',
  ],
  'components/hero.tsx': [
    'product_cta_clicked',
    'faucet_link_clicked',
    'faucet_intro_dismissed',
  ],
  'components/risks-dialog.tsx': ['risk_dialog_opened', 'risk_dialog_closed'],
  'components/open-position-form.tsx': [
    'position_open_requested',
    'position_open_succeeded',
    'position_open_failed',
    'position_open_form_started',
    'max_amount_selected',
  ],
  'components/manage-position.tsx': [
    'position_action_requested',
    'position_action_succeeded',
    'position_action_failed',
    'transaction_mode_changed',
    'max_amount_selected',
  ],
  'components/stability-pool.tsx': [
    'stability_pool_action_requested',
    'stability_pool_action_succeeded',
    'stability_pool_action_failed',
    'transaction_mode_changed',
    'max_amount_selected',
  ],
};

test('meaningful UI interactions emit stable PostHog events', () => {
  for (const [path, events] of Object.entries(requiredEvents)) {
    const source = read(path);
    for (const event of events) assert.match(source, new RegExp(`['\"]${event}['\"]`), `${path} is missing ${event}`);
  }
});

test('custom analytics use the shared consent-aware capture helper', () => {
  const helper = read('lib/analytics.ts');
  assert.match(helper, /isPostHogStarted\(\)/);
  assert.match(helper, /posthog\.capture/);

  for (const path of Object.keys(requiredEvents)) {
    assert.match(read(path), /captureEvent/);
  }
});

test('transaction events do not send wallet addresses, hashes, contracts, or raw errors', () => {
  for (const path of [
    'components/open-position-form.tsx',
    'components/manage-position.tsx',
    'components/stability-pool.tsx',
  ]) {
    const analyticsCalls = [...read(path).matchAll(/captureEvent\([\s\S]*?\}\);/g)].map((match) => match[0]).join('\n');
    assert.doesNotMatch(analyticsCalls, /transaction_hash|wallet_address|contract:|technicalDetails|error_details/);
  }
});
