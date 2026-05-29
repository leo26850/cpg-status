// scripts/compute/outreach.ts
import type { BisonCampaign } from '../bison/client.js';

export type OutreachCampaignRow = {
  name: string;
  status: string;
  emails_sent: number;
  total_leads_contacted: number;
  replied: number;
  interested: number;
  reply_rate: number | null;
};

export type OutreachData = {
  emails_sent: number;
  total_leads_contacted: number;
  replied: number;
  interested: number;
  bounced: number;
  unsubscribed: number;
  active_campaigns: number;
  campaign_count: number;
  reply_rate: number | null;
  positive_reply_rate: number | null;
  bounce_rate: number | null;
  campaigns: OutreachCampaignRow[];
};

function safeRate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

export function aggregateOutreach(campaigns: BisonCampaign[]): OutreachData {
  let emails_sent = 0;
  let total_leads_contacted = 0;
  let replied = 0;
  let interested = 0;
  let bounced = 0;
  let unsubscribed = 0;
  let active_campaigns = 0;

  for (const c of campaigns) {
    emails_sent += c.emails_sent;
    total_leads_contacted += c.total_leads_contacted;
    replied += c.replied;
    interested += c.interested;
    bounced += c.bounced;
    unsubscribed += c.unsubscribed;
    if (c.status === 'active') active_campaigns++;
  }

  const rows: OutreachCampaignRow[] = campaigns
    .map((c) => ({
      name: c.name,
      status: c.status,
      emails_sent: c.emails_sent,
      total_leads_contacted: c.total_leads_contacted,
      replied: c.replied,
      interested: c.interested,
      reply_rate: safeRate(c.replied, c.total_leads_contacted),
    }))
    .sort((a, b) => b.emails_sent - a.emails_sent);

  return {
    emails_sent,
    total_leads_contacted,
    replied,
    interested,
    bounced,
    unsubscribed,
    active_campaigns,
    campaign_count: campaigns.length,
    reply_rate: safeRate(replied, total_leads_contacted),
    positive_reply_rate: safeRate(interested, replied),
    bounce_rate: safeRate(bounced, emails_sent),
    campaigns: rows,
  };
}