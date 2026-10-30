import { describe, expect, it } from 'vitest';
import { reportHtml, type ReportInput } from './report.ts';

const input: ReportInput = {
  stadium: 'Ohio Stadium',
  situation: 'Gate surge',
  summary: 'A late rush piles up at Gate 2 right at kickoff.',
  made: 'Oct 30, 3:12 PM',
  conditions: 'Clear, 12°C, vehicles on.',
  plans: [
    { label: 'A', name: 'Six officers to Gate 2', steps: ['Send 6 officers to Gate 2 at kickoff'], timeline: [{ t: 120, clock: '2 min after kickoff', kind: 'order', text: 'Closed Gate 2 <door>' }], warnings: [{ clock: '1 min after kickoff', text: 'Gate 2 queue passes 15 minutes in about 3 min.' }] },
    { label: 'B', name: 'Open Gate 1, PA', steps: [], timeline: [], warnings: [] },
  ],
  rows: [{ label: 'Time to clear', hint: 'Minutes', cells: ['17.3 min', '26.9 min'], best: 0 }],
  verdict: 'Plan A clears the zone fastest.',
};

describe('the after-action report', () => {
  it('has the verdict, the results with the best marked, each plan, its warnings and its orders', () => {
    const html = reportHtml(input);
    expect(html).toContain('<title>After-action report: Ohio Stadium, gate surge</title>');
    expect(html).toContain('<p class="verdict">Plan A clears the zone fastest.</p>');
    expect(html).toContain('<td class="best">17.3 min <span class="tag">best</span></td><td>26.9 min</td>');
    expect(html).toContain('Gate 2 queue passes 15 minutes in about 3 min.');
    expect(html).toContain('No steps: the crowd is left to itself.');
    expect(html).toContain('No live orders: the plan ran as written.');
  });

  it('escapes what it is given', () => {
    expect(reportHtml(input)).toContain('Closed Gate 2 &lt;door&gt;');
  });

  it('says when there are no results yet', () => {
    const html = reportHtml({ ...input, rows: [], verdict: null });
    expect(html).toContain('there are no results yet');
    expect(html).toContain('Appears when all three plans finish.');
  });
});
