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