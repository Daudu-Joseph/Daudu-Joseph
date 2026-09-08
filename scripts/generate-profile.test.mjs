import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from './generate-profile.mjs';
const days = counts => counts.map((contributionCount, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, contributionCount }));
test('sums contributions and distinguishes active days from streaks', () => {
  const result = summarize(days([1, 4, 0, 2, 3, 1]));
  assert.deepEqual([result.total, result.active, result.longest, result.current], [11, 5, 3, 3]);
});
test('today may be empty without breaking yesterday’s streak', () => {
  assert.equal(summarize(days([1, 1, 0])).current, 2);
  assert.equal(summarize(days([1, 0, 0])).current, 0);
  assert.equal(summarize(days([0])).current, 0);
});
test('rejects missing days and invalid counts instead of publishing misleading stats', () => {
  assert.throws(() => summarize([days([1])[0], { date: '2026-09-03', contributionCount: 1 }]), /missing/);
  assert.throws(() => summarize(days([-1])), /Invalid/);
  assert.throws(() => summarize([]), /empty/);
});
