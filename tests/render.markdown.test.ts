// tests/render.markdown.test.ts
import { describe, it, expect } from 'vitest';
import { renderMonthlyMarkdown } from '../scripts/render/markdown';
import type { ReportData } from '../scripts/compute/types';

describe('renderMonthlyMarkdown', () => {
  it('produces 8 SOP blocks for a typical month', () => {
    const r: ReportData = {
      generated_at: '2026-05-27T00:00:00Z',
      window: { start: '2026-03-01', end: '2026-05-27' },
      launch_date: '2026-03-15',
      kpis: { total_leads: 40, mql: 12, sql: 4, closed_won: 1, cpl: 250, cpa: null },
      monthly: [{
        month: '2026-04',
        total_leads: 40,
        leads_by_source: { gads_lp: 25, bison_cold: 15, other: 0 },
        mql: 12, mql_by_source: { gads_lp: 8, bison_cold: 4, other: 0 },
        sql: 4, sql_stage_split: { proposal_sent: 2, negotiating: 1, closed_won: 1 },
        spend_total: 10000, spend_by_source: { gads_lp: 5000, bison_cold: 5000, other: 0 },
        cpl: 250, cpl_to_mql: 833.33, mql_rate: 0.3, sql_rate: 0.333,
      }],
      by_source: [],
      funnel: { leads: 40, mql: 12, sql: 4, closed_won: 1 },
      sql_stage_split: { proposal_sent: 2, negotiating: 1, closed_won: 1 },
      cohort_cpa: [{ cohort_month: '2026-04', spend_n_minus_3: null, wins: 1, cpa: null, insufficient_data: true }],
      lead_log: [],
      stale: false,
    };
    const md = renderMonthlyMarkdown(r, '2026-04');
    expect(md).toMatch(/Block 1.*Header strip/);
    expect(md).toMatch(/Block 2.*Spend.*CPL/);
    expect(md).toMatch(/Block 8.*CPA/);
    expect(md).toContain('| gads_lp | 25 |');
    expect(md).toContain('Insufficient data');
  });
});