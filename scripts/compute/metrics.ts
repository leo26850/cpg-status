// scripts/compute/metrics.ts
import type { Channel } from './types';

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