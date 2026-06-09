// scripts/sink-to-bq.ts
//
// Sinks the computed report (the same object that becomes data/report.json) into
// BigQuery so Looker Studio can read the funnel directly — no new Attio sync, no
// re-implemented stage logic. The build already fetches Attio, applies the
// channel + MQL/SQL/Won rules, and computes everything; this just writes the
// result to cpg_marts.* on each run.
//
// Tables (all WRITE_TRUNCATE — each run is the current live view):
//   cpg_marts.report_funnel              1 row   — top-line funnel + conversion rates
//   cpg_marts.report_channels            N rows  — per-channel scorecard (gads_lp, bison_cold)
//   cpg_marts.report_monthly             M rows  — monthly time series (Looker date axis)
//   cpg_marts.report_outreach            1 row   — cold-email outreach totals
//   cpg_marts.report_outreach_campaigns  K rows  — per-campaign outreach
//
// cpg_marts lives in the US multi-region (co-located with kamg_cpg).

import type { BigQuery } from '@google-cloud/bigquery';
import type { ReportData } from './compute/types.js';

const DATASET = 'cpg_marts';

interface Field {
  name: string;
  type: string;
  mode?: string;
}

async function truncateLoad(
  bq: BigQuery,
  table: string,
  rows: Record<string, unknown>[],
  schema: Field[],
): Promise<void> {
  // These are wholesale-refresh reporting tables. WRITE_TRUNCATE replaces rows
  // but NOT the schema of an existing table, so a new/changed column would be
  // rejected ("No such field"). Drop first so the load recreates the table with
  // the current schema every run — keeps the sink resilient to schema evolution.
  // Skips on empty input to avoid clobbering a table with nothing when a section
  // (e.g. outreach) is unavailable this run.
  if (rows.length === 0) return;
  try {
    await bq.dataset(DATASET).table(table).delete();
  } catch {
    // table didn't exist yet — fine, the load below creates it
  }
  const ndjson = rows.map((r) => JSON.stringify(r)).join('\n');
  await new Promise<void>((res, rej) => {
    const stream = bq
      .dataset(DATASET)
      .table(table)
      .createWriteStream({
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        writeDisposition: 'WRITE_TRUNCATE',
        schema: { fields: schema },
      });
    stream.on('error', rej);
    stream.on('complete', () => res());
    stream.end(Buffer.from(ndjson, 'utf8'));
  });
}

export async function sinkReportToBQ(
  bq: BigQuery,
  report: ReportData,
  snapshotDate: string,
): Promise<void> {
  const generatedAt = report.generated_at;
  const r = report as unknown as Record<string, any>;

  // ── report_funnel ──────────────────────────────────────────────────────────
  const k = report.kpis;
  const cr = (report as any).conversion_rates ?? {};
  const split = (report as any).sql_stage_split ?? {};
  await truncateLoad(
    bq,
    'report_funnel',
    [
      {
        snapshot_date: snapshotDate,
        window_start: report.window?.start ?? null,
        window_end: report.window?.end ?? null,
        generated_at: generatedAt,
        total_leads: k.total_leads,
        mql: k.mql,
        sql: k.sql,
        closed_won: k.closed_won,
        cpl: k.cpl,
        cpa: k.cpa,
        lead_to_mql: cr.lead_to_mql ?? null,
        mql_to_sql: cr.mql_to_sql ?? null,
        sql_to_won: cr.sql_to_won ?? null,
        proposal_sent: split.proposal_sent ?? null,
        negotiating: split.negotiating ?? null,
      },
    ],
    [
      { name: 'snapshot_date', type: 'DATE', mode: 'REQUIRED' },
      { name: 'window_start', type: 'DATE' },
      { name: 'window_end', type: 'DATE' },
      { name: 'generated_at', type: 'TIMESTAMP' },
      { name: 'total_leads', type: 'INTEGER' },
      { name: 'mql', type: 'INTEGER' },
      { name: 'sql', type: 'INTEGER' },
      { name: 'closed_won', type: 'INTEGER' },
      { name: 'cpl', type: 'NUMERIC' },
      { name: 'cpa', type: 'NUMERIC' },
      { name: 'lead_to_mql', type: 'FLOAT' },
      { name: 'mql_to_sql', type: 'FLOAT' },
      { name: 'sql_to_won', type: 'FLOAT' },
      { name: 'proposal_sent', type: 'INTEGER' },
      { name: 'negotiating', type: 'INTEGER' },
    ],
  );

  // ── report_channels (scorecard already carries cost + cpl per channel) ───────
  const scorecard: any[] = Array.isArray(r.scorecard) ? r.scorecard : [];
  await truncateLoad(
    bq,
    'report_channels',
    scorecard.map((s) => ({
      snapshot_date: snapshotDate,
      channel: s.source,
      leads: s.leads,
      mql: s.mql,
      sql: s.sql,
      closed_won: s.closed_won,
      cost: s.cost ?? null,
      cpl: s.cpl ?? null,
      cost_estimated: s.cost_estimated ?? null,
    })),
    [
      { name: 'snapshot_date', type: 'DATE', mode: 'REQUIRED' },
      { name: 'channel', type: 'STRING' },
      { name: 'leads', type: 'INTEGER' },
      { name: 'mql', type: 'INTEGER' },
      { name: 'sql', type: 'INTEGER' },
      { name: 'closed_won', type: 'INTEGER' },
      { name: 'cost', type: 'NUMERIC' },
      { name: 'cpl', type: 'NUMERIC' },
      { name: 'cost_estimated', type: 'BOOLEAN' },
    ],
  );

  // ── report_monthly (the Looker date axis) ────────────────────────────────────
  const monthly: any[] = Array.isArray(report.monthly) ? (report.monthly as any[]) : [];
  await truncateLoad(
    bq,
    'report_monthly',
    monthly.map((m) => ({
      snapshot_date: snapshotDate,
      month: m.month,
      month_start: m.month ? `${m.month}-01` : null, // DATE for Looker's date axis/range control
      total_leads: m.total_leads,
      leads_gads_lp: m.leads_by_source?.gads_lp ?? 0,
      leads_bison_cold: m.leads_by_source?.bison_cold ?? 0,
      mql: m.mql,
      sql: m.sql,
      spend_total: m.spend_total ?? null,
      cpl: m.cpl ?? null,
      mql_rate: m.mql_rate ?? null,
      sql_rate: m.sql_rate ?? null,
    })),
    [
      { name: 'snapshot_date', type: 'DATE', mode: 'REQUIRED' },
      { name: 'month', type: 'STRING' },
      { name: 'month_start', type: 'DATE' },
      { name: 'total_leads', type: 'INTEGER' },
      { name: 'leads_gads_lp', type: 'INTEGER' },
      { name: 'leads_bison_cold', type: 'INTEGER' },
      { name: 'mql', type: 'INTEGER' },
      { name: 'sql', type: 'INTEGER' },
      { name: 'spend_total', type: 'NUMERIC' },
      { name: 'cpl', type: 'NUMERIC' },
      { name: 'mql_rate', type: 'FLOAT' },
      { name: 'sql_rate', type: 'FLOAT' },
    ],
  );

  // ── report_outreach + per-campaign (cold email; may be null) ─────────────────
  const o: any = report.outreach;
  if (o) {
    await truncateLoad(
      bq,
      'report_outreach',
      [
        {
          snapshot_date: snapshotDate,
          emails_sent: o.emails_sent,
          total_leads_contacted: o.total_leads_contacted,
          replied: o.replied,
          interested: o.interested,
          bounced: o.bounced,
          unsubscribed: o.unsubscribed,
          active_campaigns: o.active_campaigns,
          campaign_count: o.campaign_count,
          reply_rate: o.reply_rate,
          positive_reply_rate: o.positive_reply_rate,
          bounce_rate: o.bounce_rate,
        },
      ],
      [
        { name: 'snapshot_date', type: 'DATE', mode: 'REQUIRED' },
        { name: 'emails_sent', type: 'INTEGER' },
        { name: 'total_leads_contacted', type: 'INTEGER' },
        { name: 'replied', type: 'INTEGER' },
        { name: 'interested', type: 'INTEGER' },
        { name: 'bounced', type: 'INTEGER' },
        { name: 'unsubscribed', type: 'INTEGER' },
        { name: 'active_campaigns', type: 'INTEGER' },
        { name: 'campaign_count', type: 'INTEGER' },
        { name: 'reply_rate', type: 'FLOAT' },
        { name: 'positive_reply_rate', type: 'FLOAT' },
        { name: 'bounce_rate', type: 'FLOAT' },
      ],
    );

    const campaigns: any[] = Array.isArray(o.campaigns) ? o.campaigns : [];
    await truncateLoad(
      bq,
      'report_outreach_campaigns',
      campaigns.map((c) => ({
        snapshot_date: snapshotDate,
        name: c.name,
        status: c.status,
        emails_sent: c.emails_sent,
        total_leads_contacted: c.total_leads_contacted ?? null,
        replied: c.replied,
        interested: c.interested,
        reply_rate: c.reply_rate ?? null,
      })),
      [
        { name: 'snapshot_date', type: 'DATE', mode: 'REQUIRED' },
        { name: 'name', type: 'STRING' },
        { name: 'status', type: 'STRING' },
        { name: 'emails_sent', type: 'INTEGER' },
        { name: 'total_leads_contacted', type: 'INTEGER' },
        { name: 'replied', type: 'INTEGER' },
        { name: 'interested', type: 'INTEGER' },
        { name: 'reply_rate', type: 'FLOAT' },
      ],
    );
  }
}