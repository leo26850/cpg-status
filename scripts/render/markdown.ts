// scripts/render/markdown.ts
import type { ReportData, MonthlyRow } from '../compute/types.js';

const $ = (n: number | null, opts?: { currency?: boolean; pct?: boolean }): string => {
  if (n === null || n === undefined) return '—';
  if (opts?.pct) return (n * 100).toFixed(1) + '%';
  if (opts?.currency) return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return String(n);
};

export function renderMonthlyMarkdown(r: ReportData, month: string): string {
  const row: MonthlyRow | undefined = r.monthly.find((m) => m.month === month);
  if (!row) return `# CPG · ${month}\n\nNo data for month.\n`;

  const cohort = r.cohort_cpa.find((c) => c.cohort_month === month);
  const cohortLine = cohort?.insufficient_data
    ? '_Insufficient data — N+90 cohort CPA requires 90 days post-launch._'
    : `CPA (cohort N−3 spend ÷ wins): ${$(cohort?.cpa ?? null, { currency: true })}`;

  return `# CPG Affiliate · ${month} · Lead Funnel

_Generated ${r.generated_at} · Per [KAMG Lead Funnel Metrics SOP v2](https://app.plane.so/project-ares/projects/a2afea6c-b46c-4641-bc25-d3449bab96da/pages/4f189e5d-4d22-4ac5-906e-c83a0139b8ba)_

## Block 1 · Header strip

| Field | Value |
|---|---|
| Client | CPG Affiliate |
| Month | ${month} |
| Window | ${r.window.start} → ${r.window.end} |
| Launch date | ${r.launch_date} |
| Target CPL | — |
| Target CPA | — |
| Pipeline goal $ | — |

## Block 2 · Spend, Leads, CPL

| Metric | Value |
|---|---|
| Total spend (fully-loaded) | ${$(row.spend_total, { currency: true })} |
| Leads (deduped) | ${$(row.total_leads)} |
| CPL | ${$(row.cpl, { currency: true })} |

## Block 3 · Inbound leads by source

| Source | Count |
|---|---|
| gads_lp | ${row.leads_by_source.gads_lp} |
| bison_cold | ${row.leads_by_source.bison_cold} |
| Other | ${row.leads_by_source.other} |
| **Total** | **${row.total_leads}** |

## Block 4 · MQL total

| Metric | Value |
|---|---|
| MQL (Booked Call stage) | ${row.mql} |
| MQL rate | ${$(row.mql_rate, { pct: true })} |
| CPL → MQL | ${$(row.cpl_to_mql, { currency: true })} |

## Block 5 · MQL by source

| Source | MQL count |
|---|---|
| gads_lp | ${row.mql_by_source.gads_lp} |
| bison_cold | ${row.mql_by_source.bison_cold} |

## Block 6 · SQL total + stage split

| Metric | Value |
|---|---|
| SQL total (Proposal Sent + Negotiating + Closed Won) | ${row.sql} |
| Proposal Sent | ${row.sql_stage_split.proposal_sent} |
| Negotiating | ${row.sql_stage_split.negotiating} |
| Closed Won | ${row.sql_stage_split.closed_won} |
| SQL rate (vs MQL) | ${$(row.sql_rate, { pct: true })} |

_SQL rejection reason codes not tracked at CPG — see metrics-rubric.md._

## Block 7 · Deals closed (cohort)

${cohortLine}

| Cohort | Spend N−3 | Wins | CPA |
|---|---|---|---|
| ${month} | ${$(cohort?.spend_n_minus_3 ?? null, { currency: true })} | ${cohort?.wins ?? 0} | ${$(cohort?.cpa ?? null, { currency: true })} |

## Block 8 · CPA by source + Payback

_Per-source CPA pending sufficient cohort data. Payback requires client gross-margin input._

| Channel | CPA | Payback (months) |
|---|---|---|
| gads_lp | — | — |
| bison_cold | — | — |
`;
}