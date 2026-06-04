// scripts/compute/metrics.ts
import type { Channel, MonthlyRow, MonthlyCost as MC } from './types';

export type { MonthlyCost } from './types';

export type RawLead = {
  id: string;
  email: string | null;
  created_at: string;
  lead_source: string;
  stage: string;
};

const JUNK_DOMAINS = new Set(['example.com', 'kasandz.com', 'thecpgaffiliate.com']);
const JUNK_LOCAL_REGEX = /\+test/i;

export function isJunkEmail(email: string | null): boolean {
  if (!email || email.trim() === '') return true;
  const lower = email.toLowerCase().trim();
  if (JUNK_LOCAL_REGEX.test(lower)) return true;
  const domain = lower.split('@')[1];
  if (!domain) return true;
  return JUNK_DOMAINS.has(domain);
}

export function dedupLeads(leads: RawLead[]): RawLead[] {
  const filtered = leads.filter((l) => !isJunkEmail(l.email));
  const byEmail = new Map<string, RawLead>();
  for (const lead of filtered) {
    const key = (lead.email ?? '').toLowerCase().trim();
    const existing = byEmail.get(key);
    if (!existing || lead.created_at < existing.created_at) {
      byEmail.set(key, lead);
    }
  }
  return Array.from(byEmail.values());
}

// ── Real Google Ads leads from BigQuery lp_form_submissions ──────────────────
// The Attio lead_source is unreliable for Google Ads (LP-created gads_lp leads
// get merged into prospects' bison_cold leads, and every LP fill is stamped
// gads_lp). BigQuery lp_form_submissions is the immutable, complete source. A
// "real Google Ads" submission is one with source='Google Ads' OR a gclid.

export type LpSubmissionRow = {
  email: string;
  submitted_at: { value: string } | string;
  source: string;
  gclid: string | null;
};

// Internal/QA test fills, applied on top of isJunkEmail (which already drops
// kasandz.com / example.com / +test). These are the LP-only QA patterns
// (deploy/optionals smoke tests, full-payload test) that would otherwise
// inflate the client-facing Google Ads count.
const GADS_TEST_EMAIL_REGEX = /(\+|-)test|full-payload|smoke|^qa-/i;
const GADS_TEST_DOMAINS = new Set(['kamg-deploytest.com', 'kamg-optionals-test.com']);

function isGadsTestEmail(lowerEmail: string): boolean {
  const [local, domain] = lowerEmail.split('@');
  if (domain && GADS_TEST_DOMAINS.has(domain)) return true;
  return GADS_TEST_EMAIL_REGEX.test(local ?? '');
}

function lpSubmittedIso(ts: { value: string } | string): string {
  return typeof ts === 'string' ? ts : ts.value;
}

export function gadsLeadsFromLp(rows: LpSubmissionRow[]): {
  emails: Set<string>;
  byMonth: Record<string, number>;
  total: number;
} {
  // First-touch month per distinct email: the earliest real-GA submission.
  const firstTouchMonth = new Map<string, string>();
  for (const r of rows) {
    const isRealGads = r.source === 'Google Ads' || !!(r.gclid && r.gclid.trim());
    if (!isRealGads) continue;
    const email = (r.email ?? '').toLowerCase().trim();
    if (!email || isJunkEmail(email) || isGadsTestEmail(email)) continue;
    const month = lpSubmittedIso(r.submitted_at).slice(0, 7); // 'YYYY-MM'
    const prev = firstTouchMonth.get(email);
    if (!prev || month < prev) firstTouchMonth.set(email, month);
  }
  const byMonth: Record<string, number> = {};
  for (const month of firstTouchMonth.values()) {
    byMonth[month] = (byMonth[month] ?? 0) + 1;
  }
  return { emails: new Set(firstTouchMonth.keys()), byMonth, total: firstTouchMonth.size };
}

export type RawDeal = {
  id: string;
  associated_company: string | null;
  associated_lead_email: string | null;
  stage: string;
  stage_updated_at: string;
  created_at: string;
  value: number | null;
};

// Channel normalization rules per metrics-rubric.md.
// Case-insensitive substring matching against loose-typed Attio lead_source.
const GADS_SUBSTRINGS = ['gads', 'google ads', 'google_ads', 'googleads'];
const BISON_SUBSTRINGS = ['bison', 'instantly', 'cold'];

export function toChannel(raw: string | null): Channel {
  if (!raw) return 'other';
  const lower = raw.toLowerCase();
  if (GADS_SUBSTRINGS.some((s) => lower.includes(s))) return 'gads_lp';
  if (BISON_SUBSTRINGS.some((s) => lower.includes(s))) return 'bison_cold';
  return 'other';
}

const MQL_STAGES = new Set(['Booked Call', 'Promoted']);
const SQL_STAGES = new Set(['Proposal Sent', 'Negotiating', 'Closed Won']);

export function classifyMql(stage: string): boolean {
  return MQL_STAGES.has(stage);
}

export function classifySql(stage: string): boolean {
  return SQL_STAGES.has(stage);
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}

export function aggregateMonthly(
  leadsRaw: RawLead[],
  deals: RawDeal[],
  costs: MC[],
): MonthlyRow[] {
  const leads = dedupLeads(leadsRaw);
  const monthsSet = new Set<string>();
  for (const l of leads) monthsSet.add(monthKey(l.created_at));
  for (const c of costs) monthsSet.add(c.month);
  const months = Array.from(monthsSet).sort();

  const emptyChannelCounts = (): Record<Channel, number> => ({ gads_lp: 0, bison_cold: 0, other: 0 });

  const rows: MonthlyRow[] = [];

  for (const month of months) {
    const monthLeads = leads.filter((l) => monthKey(l.created_at) === month);
    const leads_by_source = emptyChannelCounts();
    const mql_by_source = emptyChannelCounts();
    let mql = 0;
    for (const l of monthLeads) {
      const ch = toChannel(l.lead_source);
      leads_by_source[ch]++;
      if (classifyMql(l.stage)) {
        mql++;
        mql_by_source[ch]++;
      }
    }

    const monthDealsSql = deals.filter(
      (d) => monthKey(d.stage_updated_at) === month && classifySql(d.stage),
    );
    const sql = monthDealsSql.length;
    const sql_stage_split = {
      proposal_sent: monthDealsSql.filter((d) => d.stage === 'Proposal Sent').length,
      negotiating: monthDealsSql.filter((d) => d.stage === 'Negotiating').length,
      closed_won: monthDealsSql.filter((d) => d.stage === 'Closed Won').length,
    };

    const monthCosts = costs.filter((c) => c.month === month);
    const spend_by_source = emptyChannelCounts();
    let spend_total = 0;
    for (const c of monthCosts) {
      const ch = c.channel;
      const total = c.media + c.tooling + c.agency;
      spend_by_source[ch] += total;
      spend_total += total;
    }
    const hasCost = monthCosts.length > 0;
    const total_leads = monthLeads.length;

    rows.push({
      month,
      total_leads,
      leads_by_source,
      mql,
      mql_by_source,
      sql,
      sql_stage_split,
      spend_total,
      spend_by_source,
      cpl: hasCost && total_leads > 0 ? spend_total / total_leads : null,
      cpl_to_mql: hasCost && mql > 0 ? spend_total / mql : null,
      mql_rate: total_leads > 0 ? mql / total_leads : null,
      sql_rate: mql > 0 ? sql / mql : null,
    });
  }

  return rows;
}