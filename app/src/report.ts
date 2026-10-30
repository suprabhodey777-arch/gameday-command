import type { TimelineEntry } from './after-action.ts';
import type { ScoreRow } from './scoreboard.ts';

/**
 * The whole comparison on one printable page, for whoever was not in the room:
 * what happened, the three plans and their steps, the results side by side,
 * the verdict, the early warnings each plan raised, and every live order. Every
 * number comes from the scorecards, the plans or the run logs; this file only
 * lays them out. The browser's print dialog turns it into a PDF.
 */

export interface ReportPlan {
  label: string;
  name: string;
  steps: string[];
  timeline: TimelineEntry[];
  warnings: { clock: string; text: string }[];
}

export interface ReportInput {
  stadium: string;
  situation: string;
  /** One sentence on what the situation is. */
  summary: string;
  /** When the report was made, as the reader would write it. */
  made: string;
  conditions: string;
  plans: ReportPlan[];
  /** The results table, `resultRows` of the scorecards; empty while the plans still run. */
  rows: ScoreRow[];
  verdict: string | null;
}

const escape = (text: string) => text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

function resultsTable(labels: string[], rows: ScoreRow[]): string {
  if (rows.length === 0) return '<p class="muted">The plans have not all finished, so there are no results yet.</p>';
  const head = `<tr><th></th>${labels.map((l) => `<th>Plan ${escape(l)}</th>`).join('')}</tr>`;
  const body = rows
    .map((r) => `<tr><th title="${escape(r.hint)}">${escape(r.label)}</th>${r.cells.map((c, i) => `<td${r.best === i ? ' class="best"' : ''}>${escape(c)}${r.best === i ? ' <span class="tag">best</span>' : ''}</td>`).join('')}</tr>`)
    .join('');
  return `<table class="results"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function planSection(p: ReportPlan): string {
  const steps = p.steps.length ? `<ol>${p.steps.map((s) => `<li>${escape(s)}</li>`).join('')}</ol>` : '<p class="muted">No steps: the crowd is left to itself.</p>';
  const warnings = p.warnings.length
    ? `<h4>Early warnings</h4><ul class="log">${p.warnings.map((w) => `<li><time>${escape(w.clock)}</time>${escape(w.text)}</li>`).join('')}</ul>`
    : '';
  const orders = p.timeline.length
    ? `<h4>Live orders and arrivals</h4><ul class="log">${p.timeline.map((e) => `<li><time>${escape(e.clock)}</time><span class="kind">${escape(e.kind)}</span> ${escape(e.text)}</li>`).join('')}</ul>`
    : '<p class="muted">No live orders: the plan ran as written.</p>';
  return `<section class="plan"><h3><span class="letter">${escape(p.label)}</span> ${escape(p.name)}</h3><h4>Plan steps</h4>${steps}${warnings}${orders}</section>`;
}

export function reportHtml(r: ReportInput): string {
  const title = `After-action report: ${r.stadium}, ${r.situation.toLowerCase()}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title>
<style>
:root{--ink:#14202b;--ink-2:#3b4a58;--rule:#cfd6dc;--go:#00704a;--paper:#fff}
*{box-sizing:border-box}body{font:14px/1.5 "Public Sans",system-ui,sans-serif;color:var(--ink);background:var(--paper);margin:0 auto;padding:32px 24px;max-width:860px}
h1,h2,h3{font-family:Overpass,"Public Sans",system-ui,sans-serif;line-height:1.2}h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px;border-bottom:2px solid var(--ink);padding-bottom:4px}
h3{font-size:16px;margin:0 0 6px}h4{font-size:13px;margin:12px 0 4px;color:var(--ink-2)}.muted{color:var(--ink-2)}
.meta{color:var(--ink-2);margin:0 0 16px}.verdict{font-size:16px;font-weight:600;border-left:5px solid var(--go);padding:8px 12px;background:#eef6f1}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid var(--rule);padding:6px 8px;text-align:left;vertical-align:top}thead th{font-family:Overpass,system-ui,sans-serif}
td.best{font-weight:700}.tag{font-size:11px;color:var(--go);border:1px solid var(--go);border-radius:3px;padding:0 4px;margin-left:4px}
.plan{border:1px solid var(--rule);border-radius:6px;padding:12px 14px;margin:0 0 12px;break-inside:avoid}.letter{display:inline-block;min-width:24px;text-align:center;background:var(--ink);color:#fff;border-radius:3px;margin-right:6px}
ol{margin:0;padding-left:20px}.log{list-style:none;margin:0;padding:0}.log li{padding:3px 0;border-bottom:1px dotted var(--rule)}time{display:inline-block;min-width:150px;color:var(--ink-2);font-variant-numeric:tabular-nums}
.kind{font-size:12px;color:var(--ink-2)}.foot{margin-top:28px;font-size:12px;color:var(--ink-2)}
.print{position:fixed;top:16px;right:16px;font:600 14px system-ui;padding:8px 14px;border-radius:6px;border:0;background:var(--go);color:#fff;cursor:pointer}
@media print{.print{display:none}body{padding:0}}
</style></head><body>
<button class="print" onclick="window.print()">Print or save as PDF</button>
<h1>${escape(title)}</h1>
<p class="meta">Made ${escape(r.made)}. ${escape(r.conditions)}</p>
<p>${escape(r.summary)}</p>
<h2>Verdict</h2>${r.verdict ? `<p class="verdict">${escape(r.verdict)}</p>` : '<p class="muted">Appears when all three plans finish.</p>'}
<h2>Results</h2>${resultsTable(r.plans.map((p) => p.label), r.rows)}
<h2>The plans</h2>${r.plans.map(planSection).join('')}
<p class="foot">Simulated crowd and traffic: an assumption, not a forecast. Every number is from the simulation's own scorecards and logs. The commander makes the call.</p>
</body></html>`;
}
