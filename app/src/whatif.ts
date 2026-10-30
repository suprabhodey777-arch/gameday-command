import type { Scorecard } from '../../contracts.ts';

/**
 * What-if: after all three plans finish, the commander goes back to a moment,
 * makes a different call and plays on. The results from before the rewind are
 * kept, so when the plans finish again each one shows what the change did. Only
 * the plan that got new orders changes by design; the others replay the same
 * seed and should come out the same, which is itself a check worth showing.
 */

export interface WhatIfBaseline {
  /** Sim seconds the runs went back to. */
  t: number;
  cards: Scorecard[];
}

export interface WhatIfRow {
  label: string;
  hint: string;
  /** Per plan: before, after, and a short change ("−3.2 min", "same"). */
  cells: { before: string; after: string; change: string; better: boolean | null }[];
}

const n = (x: number) => Math.round(x).toLocaleString('en-US');
const clear = (m: number | null) => (m === null ? 'never' : `${m.toFixed(1)} min`);

function compare(before: number | null, after: number | null, unit: (x: number) => string): { change: string; better: boolean | null } {
  if (before === after) return { change: 'same', better: null };
  if (before === null) return { change: 'now clears', better: true };
  if (after === null) return { change: 'no longer clears', better: false };
  const d = after - before;
  if (Math.abs(d) < 0.05) return { change: 'same', better: null };
  return { change: `${d > 0 ? '+' : '−'}${unit(Math.abs(d))}`, better: d < 0 };
}

export function whatIfRows(before: Scorecard[], after: Scorecard[]): WhatIfRow[] {
  const pairs = before.map((b, i) => [b, after[i]!] as const).filter(([, a]) => a !== undefined);
  return [
    {
      label: 'Time to clear',
      hint: 'Minutes until the zone thinned to safe levels',
      cells: pairs.map(([b, a]) => ({ before: clear(b.timeToClearMin), after: clear(a.timeToClearMin), ...compare(b.timeToClearMin, a.timeToClearMin, (x) => `${x.toFixed(1)} min`) })),
    },
    {
      label: 'Crush-risk minutes',
      hint: 'Cell-minutes over the danger line after the incident',
      cells: pairs.map(([b, a]) => ({ before: n(b.dangerMinutes), after: n(a.dangerMinutes), ...compare(Math.round(b.dangerMinutes), Math.round(a.dangerMinutes), n) })),
    },
    {
      label: 'Officer time',
      hint: 'Officers committed, times how long',
      cells: pairs.map(([b, a]) => ({ before: `${n(b.officerMinutesUsed)} min`, after: `${n(a.officerMinutesUsed)} min`, ...compare(Math.round(b.officerMinutesUsed), Math.round(a.officerMinutesUsed), (x) => `${n(x)} min`) })),
    },
  ];
}

/** One sentence on what the change did to the plans that got new orders. */
export function whatIfSentence(labels: readonly string[], changed: number[], before: Scorecard[], after: Scorecard[]): string {
  if (changed.length === 0) return 'No new orders after the rewind, so every plan replayed as before.';
  return changed
    .map((i) => {
      const b = before[i];
      const a = after[i];
      if (!b || !a) return '';
      const c = compare(b.timeToClearMin, a.timeToClearMin, (x) => `${x.toFixed(1)} min`);
      const d = compare(Math.round(b.dangerMinutes), Math.round(a.dangerMinutes), n);
      const clearPart = c.change === 'same' ? 'cleared in the same time' : c.better ? `cleared ${c.change.replace('−', '')} sooner` : c.change === 'no longer clears' ? 'no longer cleared' : `cleared ${c.change.replace('+', '')} later`;
      const riskPart = d.change === 'same' ? 'with the same crush risk' : d.better ? `with ${d.change.replace('−', '')} fewer crush-risk minutes` : `with ${d.change.replace('+', '')} more crush-risk minutes`;
      return `Your change on plan ${labels[i]} ${clearPart}, ${riskPart}.`;
    })
    .filter(Boolean)
    .join(' ');
}
