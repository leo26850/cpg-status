import { describe, it, expect } from 'vitest';
import { computeCohortCpa } from '../scripts/compute/cohort';
import type { MonthlyRow } from '../scripts/compute/types';

const baseRow = (month: string, opts: Partial<MonthlyRow> = {}): MonthlyRow => ({
  month,
  total_leads: 0,
  leads_by_source: { gads_lp: 0, bison_cold: 0, other: 0 },
  mql: 0,
  mql_by_source: { gads_lp: 0, bison_cold: 0, other: 0 },
  sql: 0,
  sql_stage_split: { proposal_sent: 0, negotiating: 0, closed_won: 0 },
  spend_total: 0,
  spend_by_source: { gads_lp: 0, bison_cold: 0, other: 0 },
  cpl: null,
  cpl_to_mql: null,
  mql_rate: null,
  sql_rate: null,
  ...opts,
});

describe('computeCohortCpa', () => {
  it('marks cohort insufficient_data when <90 days from launch', () => {
    const rows = [baseRow('2026-04', { spend_total: 10000 })];
    const today = '2026-05-15';
    const cohorts = computeCohortCpa(rows, '2026-04-01', today);
    expect(cohorts).toHaveLength(1);
    expect(cohorts[0].insufficient_data).toBe(true);
    expect(cohorts[0].cpa).toBe(null);
  });

  it('computes CPA = N-3 spend / cohort wins when window reached', () => {
    const rows = [
      baseRow('2026-01', { spend_total: 12000 }),
      baseRow('2026-04', { spend_total: 5000, sql_stage_split: { proposal_sent: 0, negotiating: 0, closed_won: 4 } }),
    ];
    const today = '2026-08-01';
    const cohorts = computeCohortCpa(rows, '2026-01-01', today);
    const apr = cohorts.find((c) => c.cohort_month === '2026-04')!;
    expect(apr.insufficient_data).toBe(false);
    expect(apr.spend_n_minus_3).toBe(12000);
    expect(apr.wins).toBe(4);
    expect(apr.cpa).toBe(3000); // 12000 / 4
  });

  it('CPA is null when zero wins, even with sufficient time', () => {
    const rows = [
      baseRow('2026-01', { spend_total: 12000 }),
      baseRow('2026-04', { spend_total: 5000 }),
    ];
    const today = '2026-08-01';
    const cohorts = computeCohortCpa(rows, '2026-01-01', today);
    const apr = cohorts.find((c) => c.cohort_month === '2026-04')!;
    expect(apr.cpa).toBe(null);
    expect(apr.wins).toBe(0);
  });
});
