import type { CohortRow, MonthlyRow } from './types';

function addMonths(iso: string, n: number): string {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + (a.length === 7 ? '-01' : ''));
  const db = new Date(b + (b.length === 7 ? '-01' : ''));
  return Math.floor((db.getTime() - da.getTime()) / 86400000);
}

export function computeCohortCpa(
  rows: MonthlyRow[],
  launchDate: string,
  todayIso: string,
): CohortRow[] {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const out: CohortRow[] = [];
  for (const row of rows) {
    const cohort = row.month;
    const insufficient = daysBetween(cohort + '-01', todayIso) < 90;
    const nMinus3 = addMonths(cohort, -3);
    const spend_n_minus_3 = byMonth.get(nMinus3)?.spend_total ?? null;
    const wins = row.sql_stage_split.closed_won;
    const cpa = !insufficient && wins > 0 && spend_n_minus_3 !== null && spend_n_minus_3 > 0
      ? spend_n_minus_3 / wins
      : null;
    out.push({
      cohort_month: cohort,
      spend_n_minus_3,
      wins,
      cpa,
      insufficient_data: insufficient,
    });
  }
  return out;
}