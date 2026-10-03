import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifySearchError,
  providerNameFromError,
  type SearchErrorKind,
} from '../src/lib/search-errors.js';

test('classifies app-level workspace quota errors', () => {
  const cases = [
    'Monthly search quota exceeded (20/500 units used). Please upgrade or wait for the next billing cycle.',
    'Monthly quota of 500 search units exceeded. Used: 500. Upgrade plan or wait for the next monthly cycle.',
    'Monthly search quota exceeded (500/500 units used).',
  ];
  for (const msg of cases) {
    assert.equal(classifySearchError(new Error(msg)), 'workspace-quota', msg);
  }
});

test('classifies upstream provider quota errors', () => {
  const cases = [
    'SerpApi client error (403): Your account has run out of credits.',
    'SerpApi failed with status 429: Quota exceeded, out of credits.',
    'Tavily API responded with HTTP 429: No credit left.',
    'SearchProviderError: Insufficient balance for this search.',
    'Tavily search failed: 429 - credit limit reached',
  ];
  for (const msg of cases) {
    assert.equal(classifySearchError(new Error(msg)), 'provider-quota', msg);
  }
});

test('classifies provider-rate-limit 429s as provider-quota', () => {
  assert.equal(classifySearchError(new Error('SerpApi failed with status 429: Too fast')), 'provider-quota');
});

test('anything else is "other"', () => {
  const cases: Array<[string, SearchErrorKind]> = [
    ['ECONNREFUSED connect 127.0.0.1:3001', 'other'],
    ['Cannot read property of undefined', 'other'],
    ['search query cannot be empty', 'other'],
    ['Unauthorized', 'other'],
    ['', 'other'],
  ];
  for (const [msg, expected] of cases) {
    assert.equal(classifySearchError(new Error(msg)), expected, msg);
  }
});

test('providerNameFromError names the provider when known', () => {
  assert.equal(providerNameFromError(new Error('Tavily API responded with HTTP 429')), 'Tavily');
  assert.equal(providerNameFromError(new Error('SerpApi client error (403)')), 'SerpApi');
  assert.equal(providerNameFromError(new Error('random failure')), 'search provider');
});

test('classifySearchError tolerates non-Error values', () => {
  assert.equal(classifySearchError(null), 'other');
  assert.equal(classifySearchError(undefined), 'other');
  assert.equal(classifySearchError({ message: 'Monthly search quota exceeded' }), 'workspace-quota');
});