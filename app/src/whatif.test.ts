import { describe, expect, it } from 'vitest';
import type { Scorecard } from '../../contracts.ts';
import { whatIfRows, whatIfSentence } from './whatif.ts';

const card = (timeToClearMin: number | null, dangerMinutes: number, officerMinutesUsed = 100): Scorecard =>
  ({ timeToClearMin, dangerMinutes, officerMinutesUsed, peakDensity: 5, firstOfficerMin: 2 }) as unknown as Scorecard;

describe('what-if', () => {
  it('shows each plan before and after, and which way it moved', () => {
    const rows = whatIfRows([card(20, 1000), card(null, 500), card(10, 300)], [card(16.8, 900), card(12, 500), card(10, 300)]);
    expect(rows[0]!.cells).toEqual([
      { before: '20.0 min', after: '16.8 min', change: '−3.2 min', better: true },
      { before: 'never', after: '12.0 min', change: 'now clears', better: true },
      { before: '10.0 min', after: '10.0 min', change: 'same', better: null },
    ]);
    expect(rows[1]!.cells[0]).toEqual({ before: '1,000', after: '900', change: '−100', better: true });
    expect(rows[1]!.cells[1]!.change).toBe('same');
  });

  it('says what the change did, in a sentence', () => {
    const before = [card(20, 1000), card(15, 500), card(10, 300)];
    expect(whatIfSentence(['A', 'B', 'C'], [0], before, [card(16.8, 900), before[1]!, before[2]!])).toBe(
      'Your change on plan A cleared 3.2 min sooner, with 100 fewer crush-risk minutes.',
    );
    expect(whatIfSentence(['A', 'B', 'C'], [1], before, [before[0]!, card(null, 700), before[2]!])).toBe(
      'Your change on plan B no longer cleared, with 200 more crush-risk minutes.',
    );
    expect(whatIfSentence(['A', 'B', 'C'], [], before, before)).toBe('No new orders after the rewind, so every plan replayed as before.');
  });
});
