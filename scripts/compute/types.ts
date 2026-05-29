// scripts/compute/types.ts
export type Channel = 'gads_lp' | 'bison_cold' | 'other';

export type MonthlyCost = {
  month: string; // YYYY-MM
  channel: Channel;
  media: number;
  tooling: number;
  agency: number;
};

export type MonthlyRow = {
  month: string;
  total_leads: number;
  leads_by_source: Record<Channel, number>;
  mql: number;
  mql_by_source: Record<Channel, number>;
  sql: number;
  sql_stage_split: { proposal_sent: number; negotiating: number; closed_won: number };
  spend_total: number;
  spend_by_source: Record<Channel, number>;
  cpl: number | null;
  cpl_to_mql: number | null;
  mql_rate: number | null;
  sql_rate: number | null;
};

export type CohortRow = {
  cohort_month: string;
  spend_n_minus_3: number | null;
  wins: number;
  cpa: number | null;
  insufficient_data: boolean;
};

export type LeadLogRow = {
  created_at: string;
  email_hash: string;
  source: Channel;
  is_mql: boolean;
  is_sql: boolean;
  current_stage: string;
};

export type { OutreachData, OutreachCampaignRow } from './outreach.js';

export type ReportData = {
  generated_at: string;
  window: { start: string; end: string };
  launch_date: string;
  kpis: {
    total_leads: number;
    mql: number;
    sql: number;
    closed_won: number;
    cpl: number | null;
    cpa: number | null;
  };
  monthly: MonthlyRow[];
  by_source: Array<{ source: Channel; leads: number; mql: number; sql: number; closed_won: number }>;
  funnel: { leads: number; mql: number; sql: number; closed_won: number };
  sql_stage_split: { proposal_sent: number; negotiating: number; closed_won: number };
  cohort_cpa: CohortRow[];
  lead_log: LeadLogRow[];
  stale: boolean;
  stale_reason?: string;
  outreach?: import('./outreach.js').OutreachData | null;
};
