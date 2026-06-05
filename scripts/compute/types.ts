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
export type { CostsData, CostLineItem, PerMonthCost } from './costs.js';

// --- Total Pipeline (all lead sources, all stages) ---
export type PipelineStageRow = { stage: string; count: number };

export type TotalPipeline = {
  total_all_time: number;            // every deal in Attio (incl migrated legacy)
  open_active: number;               // deals currently in OPEN stages
  by_stage_open: PipelineStageRow[]; // OPEN stages only, current snapshot (for the chart)
  closed_won_period: number;         // Closed Won with active_from within window
  closed_lost_dq_period: number;     // Closed Lost + Disqualified with active_from within window
  win_rate_period: number;           // closed_won_period / (closed_won_period + closed_lost_dq_period), 0 if denom 0
  period: { start: string; end: string };
};

// --- Google Ads (Phase 1: account-level, from CSV; spend is ESTIMATED) ---
export type GoogleAdsDaily = {
  date: string;        // ISO YYYY-MM-DD
  clicks: number;
  impressions: number;
  avg_cpc: number;     // USD, as exported (already an average)
  conversions: number;
  est_cost: number;    // derived: clicks * avg_cpc
};

export type GoogleAdsData = {
  window: { start: string; end: string };
  daily: GoogleAdsDaily[];
  totals: {
    impressions: number;
    clicks: number;
    ctr: number;                       // clicks / impressions (0..1)
    avg_cpc: number;                   // est_spend / clicks
    conversions: number;
    est_spend: number;                 // sum of est_cost
    est_cost_per_conv: number | null;  // est_spend / conversions (null if 0 conv)
  };
  spend_estimated: true;               // always true in Phase 1 (drives the UI label)
};

// --- Per-channel scorecard ---
export type ScorecardRow = {
  source: Channel;
  leads: number;
  mql: number;
  sql: number;
  closed_won: number;
  cost: number | null;            // attributed cost, null if not cleanly attributable
  cpl: number | null;             // cost / leads
  cost_estimated: boolean;        // true when cost came from estimated Ads spend
};

// --- Funnel conversion rates (0..1, null when denominator is 0) ---
export type ConversionRates = {
  lead_to_mql: number | null;
  mql_to_sql: number | null;
  sql_to_won: number | null;
};

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
  costs?: import('./costs.js').CostsData | null;
  google_ads?: GoogleAdsData | null;
  scorecard?: ScorecardRow[];
  conversion_rates?: ConversionRates;
  total_pipeline?: TotalPipeline | null;
};
