import { describe, it, expect } from 'vitest';
import type { ReportData, MonthlyRow, CohortRow, LeadLogRow } from '../scripts/compute/types';

describe('types smoke', () => {
  it('ReportData accepts a minimum shape', () => {
    const r: ReportData = {
      generated_at: '2026-05-27T00:00:00Z',
      window: { start: '2026-03-01', end: '2026-05-27' },
      launch_date: '2026-03-15',
      kpis: { total_leads: 0, mql: 0, sql: 0, closed_won: 0, cpl: null, cpa: null },
      monthly: [],
      by_source: [],
      funnel: { leads: 0, mql: 0, sql: 0, closed_won: 0 },
      sql_stage_split: { proposal_sent: 0, negotiating: 0, closed_won: 0 },
      cohort_cpa: [],
      lead_log: [],
      stale: false,
    };
    expect(r.kpis.cpl).toBe(null);
  });
});
