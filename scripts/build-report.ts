// scripts/build-report.ts
import { BigQuery } from '@google-cloud/bigquery';
import { OAuth2Client } from 'google-auth-library';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { aggregateMonthly, dedupLeads, toChannel, classifyMql, classifySql, gadsLeadsFromLp, type RawLead, type LpSubmissionRow } from './compute/metrics.js';
import { computeCohortCpa } from './compute/cohort.js';
import { fetchAllRecords, attioString, attioTimestamp, attioStage } from './attio/client.js';
import { fetchAllCampaigns } from './bison/client.js';
import { aggregateOutreach } from './compute/outreach.js';
import { aggregateCosts } from './compute/costs.js';
import type { Channel, MonthlyCost, ReportData, LeadLogRow, CostLineItem } from './compute/types.js';

const PROJECT = 'cpg-data-warehouse';

// Create BigQuery client.
// If GOOGLE_ACCESS_TOKEN is set, use it directly via OAuth2Client to bypass ADC refresh issues.
// Otherwise fall through to the standard ADC / GOOGLE_APPLICATION_CREDENTIALS flow.
function createBqClient(): BigQuery {
  const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
  if (accessToken) {
    const authClient = new OAuth2Client();
    authClient.setCredentials({ access_token: accessToken });
    return new BigQuery({ projectId: PROJECT, authClient } as ConstructorParameters<typeof BigQuery>[0]);
  }
  return new BigQuery({ projectId: PROJECT });
}

async function runQuery<T>(bq: BigQuery, sqlPath: string, params: Record<string, unknown> = {}, location = 'US'): Promise<T[]> {
  const sql = readFileSync(resolve(sqlPath), 'utf-8');
  // Strip single-line comments so they don't interfere with named parameters
  const cleanSql = sql.replace(/--[^\n]*/g, '').trim();
  const [rows] = await bq.query({ query: cleanSql, params, location });
  return rows as T[];
}

// Inspect a sample Attio record to find the real attribute slug for email.
// Attio workspaces vary — the slug may be 'email_address', 'primary_email_address', 'email', etc.
// Returns the first slug whose values array is non-empty and contains an email-like string.
function detectEmailSlug(sampleRecord: { values?: Record<string, unknown[]> } | undefined): string {
  if (!sampleRecord?.values) return 'email_address';
  const candidates = ['email_address', 'primary_email_address', 'email'];
  for (const slug of candidates) {
    const v = sampleRecord.values[slug];
    if (v && v.length > 0) {
      // Check if it looks like an email value
      const entry = v[0] as Record<string, unknown>;
      const val = entry?.value ?? entry?.email_address ?? entry?.original_email_address;
      if (val && String(val).includes('@')) return slug;
    }
  }
  // Fallback: scan all keys for anything containing "email" that has a value
  for (const key of Object.keys(sampleRecord.values)) {
    if (!key.toLowerCase().includes('email')) continue;
    const v = sampleRecord.values[key];
    if (v && v.length > 0) {
      const entry = v[0] as Record<string, unknown>;
      const val = entry?.value ?? entry?.email_address ?? entry?.original_email_address;
      if (val && String(val).includes('@')) return key;
    }
  }
  return 'email_address'; // last resort
}

// Extract email from an Attio record, trying multiple attribute shapes.
// Attio email attributes can have value at .value, .email_address, or .original_email_address
function extractEmail(record: { values?: Record<string, unknown[]> }, slug: string): string | null {
  const vals = record.values?.[slug];
  if (!vals || vals.length === 0) return null;
  const v = vals[0] as Record<string, unknown>;
  const raw = v?.value ?? v?.email_address ?? v?.original_email_address ?? null;
  return raw ? String(raw).toLowerCase().trim() : null;
}

async function main(): Promise<void> {
  const attioKey = process.env.ATTIO_API_KEY;
  if (!attioKey) throw new Error('ATTIO_API_KEY env var required');

  const bq = createBqClient();
  const today = new Date().toISOString().slice(0, 10);

  console.log('Reading monthly_costs.json...');
  const jsonCosts: MonthlyCost[] = JSON.parse(readFileSync('data/monthly_costs.json', 'utf-8'));

  console.log('Fetching Attio Leads...');
  const attioLeadsRaw = await fetchAllRecords('leads', attioKey);
  console.log(`  → ${attioLeadsRaw.length} raw lead records`);

  console.log('Fetching Attio Deals...');
  const attioDealsRaw = await fetchAllRecords('deals', attioKey);
  console.log(`  → ${attioDealsRaw.length} raw deal records`);

  // Email on Attio Leads lives on the linked People record (record-reference).
  // The lead has values.person[0].target_record_id → look up People to get email.
  // Fetch People records and build personId → email map.
  console.log('Fetching Attio People (for email join)...');
  const attioPeopleRaw = await fetchAllRecords('people', attioKey);
  console.log(`  → ${attioPeopleRaw.length} people records`);

  // Build personId → email map (first non-empty email_addresses entry)
  const personEmailMap = new Map<string, string>();
  for (const p of attioPeopleRaw) {
    const emailEntries = p.values?.email_addresses as Array<Record<string, unknown>> | undefined;
    if (!emailEntries || emailEntries.length === 0) continue;
    const email = emailEntries[0]?.email_address ?? emailEntries[0]?.original_email_address;
    if (email && String(email).includes('@')) {
      personEmailMap.set(p.id.record_id, String(email).toLowerCase().trim());
    }
  }
  console.log(`  → ${personEmailMap.size} people with emails`);

  // Log sample lead attribute slugs
  const sampleLead = attioLeadsRaw.find((r) => r.values && Object.keys(r.values).length > 0);
  if (sampleLead?.values) {
    const slugList = Object.keys(sampleLead.values).slice(0, 20).join(', ');
    console.log(`  → Lead attribute slugs (sample): ${slugList}`);
  }

  // Extract person_id from a lead's 'person' attribute (record-reference)
  function getPersonId(r: { values?: Record<string, unknown[]> }): string | null {
    const v = r.values?.person?.[0] as Record<string, unknown> | undefined;
    return v?.target_record_id ? String(v.target_record_id) : null;
  }

  // Extract person_id from a deal's 'associated_people' attribute (array of record-refs).
  // Falls back to 'person' slug in case the workspace uses a different naming.
  function getDealPersonId(r: { values?: Record<string, unknown[]> }): string | null {
    // Primary: deals use 'associated_people' array
    const arr = r.values?.associated_people as Array<Record<string, unknown>> | undefined;
    if (arr && arr.length > 0) {
      const tid = arr[0]?.target_record_id;
      if (tid) return String(tid);
    }
    // Fallback: try 'person' (same as leads)
    return getPersonId(r);
  }

  const leads = attioLeadsRaw.map((r) => {
    const personId = getPersonId(r);
    const emailFromPerson = personId ? (personEmailMap.get(personId) ?? null) : null;
    return {
      id: r.id.record_id,
      email: emailFromPerson,
      created_at: r.created_at ?? attioTimestamp(r, 'created_at') ?? '',
      lead_source: attioString(r, 'lead_source') ?? '',
      stage: attioStage(r, 'stage') ?? '',
    };
  });

  // Log a sample of lead sources for inspection
  const sourceSet = new Set(leads.slice(0, 50).map((l) => l.lead_source));
  console.log(`  → Lead source values (sample): ${Array.from(sourceSet).join(', ')}`);

  // Deals: use associated_people (array) to resolve person → email, not 'person' slug
  const sampleDeal = attioDealsRaw.find((r) => r.values && Object.keys(r.values).length > 0);
  if (sampleDeal?.values) {
    const slugList = Object.keys(sampleDeal.values).slice(0, 20).join(', ');
    console.log(`  → Deal attribute slugs (sample): ${slugList}`);
    // Log whether associated_people is present on the sample
    const ap = sampleDeal.values?.associated_people as Array<Record<string, unknown>> | undefined;
    console.log(`  → Deal associated_people[0]: ${JSON.stringify(ap?.[0])}`);
  }

  const deals = attioDealsRaw.map((r) => {
    const personId = getDealPersonId(r);
    const emailFromPerson = personId ? (personEmailMap.get(personId) ?? null) : null;
    return {
      id: r.id.record_id,
      associated_company: null,
      associated_lead_email: emailFromPerson,
      stage: attioStage(r, 'stage') ?? '',
      stage_updated_at: attioTimestamp(r, 'stage_updated_at') ?? r.created_at ?? '',
      created_at: r.created_at ?? '',
      value: null,
    };
  });

  // Log how many deals resolved an email via associated_people
  const dealsWithEmail = deals.filter((d) => d.associated_lead_email !== null).length;
  console.log(`  → ${dealsWithEmail}/${deals.length} deals resolved an email via People map`);

  console.log('Querying BQ: lp_form_submissions...');
  const lpSubmissions = await runQuery<LpSubmissionRow>(
    bq,
    'scripts/queries/lp_submissions.sql',
    { start_date: '2026-05-01' },
  );
  console.log(`  → ${lpSubmissions.length} LP submission rows`);

  console.log('Querying BQ: vendor_spend...');
  // vendor_spend schema: month (DATE), vendor (STRING), category, amount_usd (NUMERIC), notes
  // Dataset 'cpg' is in us-central1 (not US) — must pass explicit location.
  // BQ returns DATE as { value: 'YYYY-MM-DD' } object in the Node.js client
  const vendorSpend = await runQuery<{ month: { value: string } | string; vendor: string; category: string | null; amount_usd: number; notes: string | null }>(
    bq,
    'scripts/queries/vendor_spend.sql',
    {},
    'us-central1',
  );
  console.log(`  → ${vendorSpend.length} vendor_spend rows`);

  // Merge spend sources: vendor_spend BQ rows win; monthly_costs.json fills gaps
  // vendor_spend uses 'vendor' (supplier name) and 'amount_usd' columns
  // Vendor-to-channel mapping:
  //   "Vovik" → bison_cold (cold email infra)
  //   "Google"/"gads" → gads_lp
  //   Others → 'other' (skipped in merge)
  const costs: MonthlyCost[] = mergeSpend(vendorSpend, jsonCosts);

  // Determine window
  const launchDate = '2026-05-11'; // per recon; LP form submissions started 2026-05-11
  const windowRange = { start: launchDate, end: today };

  // Scope the funnel to in-scope channels only (gads_lp + bison_cold). Out-of-scope
  // contacts (manual outreach / existing contacts / sales list) are excluded from
  // MQL/SQL/Closed Won per the CPG rubric — 'other' is not part of the funnel.
  const dedupLeadsArr = dedupLeads(leads);

  // Google Ads leads come from BigQuery lp_form_submissions (real GA = source
  // 'Google Ads' OR a gclid present, test fills excluded), NOT from the Attio
  // lead_source: Attio merges gads_lp leads into prospects' bison_cold leads and
  // stamps lead_source=gads_lp on every LP fill, so it is both lossy and
  // over-counting. Bison stays sourced from Attio.
  const gads = gadsLeadsFromLp(lpSubmissions);
  const bisonLeads = dedupLeadsArr.filter((l) => toChannel(l.lead_source) === 'bison_cold');

  // Synthetic gads leads — one per real-GA email in its first-touch month — so
  // aggregateMonthly produces correct leads_by_source / total_leads / CPL in one
  // place. These never enter lead_log (built from Attio leads only) and carry
  // synthetic emails that match no deal (gads deal attribution is handled via
  // sourceByEmail below).
  const gadsSyntheticLeads: RawLead[] = [];
  let gi = 0;
  for (const [month, count] of Object.entries(gads.byMonth)) {
    for (let k = 0; k < count; k++) {
      gadsSyntheticLeads.push({
        id: `gads-bq-${month}-${gi}`,
        email: `gads-bq-${month}-${gi}@gads.synthetic`,
        created_at: `${month}-15T00:00:00.000Z`,
        lead_source: 'gads_lp',
        stage: 'New',
      });
      gi++;
    }
  }

  // Email→channel map: Attio classification, with real-GA emails forced to
  // gads_lp so their Attio deals classify as gads_lp for MQL/SQL.
  const sourceByEmail = new Map(dedupLeadsArr.map((l) => [(l.email ?? '').toLowerCase().trim(), toChannel(l.lead_source)]));
  for (const e of gads.emails) sourceByEmail.set(e, 'gads_lp');

  const isInScope = (ch: Channel): boolean => ch === 'gads_lp' || ch === 'bison_cold';
  const dealChannel = (d: { associated_lead_email: string | null }): Channel =>
    sourceByEmail.get((d.associated_lead_email ?? '').toLowerCase().trim()) ?? 'other';
  const inScopeDeals = deals.filter((d) => isInScope(dealChannel(d)));

  // Funnel leads = bison_cold (Attio) + real Google Ads (BigQuery).
  const funnelLeads: RawLead[] = [...bisonLeads, ...gadsSyntheticLeads];
  const monthly = aggregateMonthly(funnelLeads, inScopeDeals, costs);
  const cohort = computeCohortCpa(monthly, launchDate, today);

  const total_leads = bisonLeads.length + gads.total;
  // gads lead-based MQL is 0 (synthetic leads are stage 'New'); real GA volume
  // is ~1 today and any gads MQL/SQL would surface via the deal path below.
  const mql = bisonLeads.filter((l) => classifyMql(l.stage)).length;
  const sql = inScopeDeals.filter((d) => classifySql(d.stage)).length;
  const closed_won = inScopeDeals.filter((d) => d.stage === 'Closed Won').length;
  const currentMonthRow = monthly[monthly.length - 1];
  const cpl = currentMonthRow?.cpl ?? null;
  const cpa = cohort.find((c) => !c.insufficient_data && c.cpa !== null)?.cpa ?? null;

  const by_source = [
    {
      source: 'gads_lp' as Channel,
      leads: gads.total,
      mql: 0,
      sql: inScopeDeals.filter((d) => dealChannel(d) === 'gads_lp' && classifySql(d.stage)).length,
      closed_won: inScopeDeals.filter((d) => dealChannel(d) === 'gads_lp' && d.stage === 'Closed Won').length,
    },
    {
      source: 'bison_cold' as Channel,
      leads: bisonLeads.length,
      mql: bisonLeads.filter((l) => classifyMql(l.stage)).length,
      sql: inScopeDeals.filter((d) => dealChannel(d) === 'bison_cold' && classifySql(d.stage)).length,
      closed_won: inScopeDeals.filter((d) => dealChannel(d) === 'bison_cold' && d.stage === 'Closed Won').length,
    },
  ];

  const { hashEmail } = await import('./render/hashing.js');
  const recentLeads = dedupLeadsArr
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 50);
  const dealByEmail = new Map(deals.map((d) => [(d.associated_lead_email ?? '').toLowerCase().trim(), d]));
  const lead_log: LeadLogRow[] = recentLeads.map((l) => {
    const key = (l.email ?? '').toLowerCase().trim();
    const deal = dealByEmail.get(key);
    return {
      created_at: l.created_at,
      email_hash: hashEmail(l.email),
      // gads_lp only for real-GA emails (BigQuery); Attio lead_source=gads_lp is
      // unreliable (every LP fill is stamped gads_lp), so non-real-GA falls back
      // to bison_cold or other — consistent with the funnel scoping above.
      source: gads.emails.has(key) ? 'gads_lp' : toChannel(l.lead_source) === 'bison_cold' ? 'bison_cold' : 'other',
      is_mql: classifyMql(l.stage),
      is_sql: deal ? classifySql(deal.stage) : false,
      current_stage: deal?.stage ?? l.stage,
    };
  });

  const sql_stage_split = {
    proposal_sent: inScopeDeals.filter((d) => d.stage === 'Proposal Sent').length,
    negotiating: inScopeDeals.filter((d) => d.stage === 'Negotiating').length,
    closed_won,
  };

  // Resilient Bison fetch — failure must NOT break the funnel report
  let outreach: ReportData['outreach'] = null;
  const bisonKey = process.env.BISON_API_KEY;
  const bisonWorkspace = process.env.BISON_WORKSPACE_ID;
  if (bisonKey && bisonWorkspace) {
    try {
      console.log('Fetching Bison campaigns...');
      const bisonCampaigns = await fetchAllCampaigns(bisonKey, bisonWorkspace);
      outreach = aggregateOutreach(bisonCampaigns);
      console.log(`  → ${bisonCampaigns.length} campaigns | ${outreach.emails_sent} sent | reply rate ${outreach.reply_rate !== null ? (outreach.reply_rate * 100).toFixed(1) + '%' : '—'}`);
    } catch (err) {
      console.warn('[bison] fetch failed — outreach section will be hidden:', String((err as Error)?.message ?? err));
      outreach = null;
    }
  } else {
    console.warn('[bison] BISON_API_KEY or BISON_WORKSPACE_ID not set — skipping outreach section');
  }

  // Resilient marketing cost model — failure must NOT break the funnel report
  let costsData: ReportData['costs'] = null;
  try {
    const costsPath = resolve('data/marketing_costs.json');
    const rawCosts = readFileSync(costsPath, 'utf-8').trim();
    if (!rawCosts) throw new Error('marketing_costs.json is empty');
    const costItems = JSON.parse(rawCosts) as CostLineItem[];
    if (!Array.isArray(costItems)) throw new Error('marketing_costs.json must be a JSON array');
    costsData = aggregateCosts(
      costItems,
      monthly.map((m) => ({ month: m.month, total_leads: m.total_leads })),
      closed_won,
    );
    console.log(`[costs] ${costItems.length} line items | total $${costsData.total_cost} | blended CPL ${costsData.blended_cpl !== null ? '$' + costsData.blended_cpl.toFixed(2) : '—'} | blended CPA ${costsData.blended_cpa !== null ? '$' + costsData.blended_cpa.toFixed(2) : '—'}`);
  } catch (err) {
    console.warn('[costs] marketing_costs.json missing/invalid — cost section will be hidden:', String((err as Error)?.message ?? err));
    costsData = null;
  }

  const report: ReportData = {
    generated_at: new Date().toISOString(),
    window: windowRange,
    launch_date: launchDate,
    kpis: { total_leads, mql, sql, closed_won, cpl, cpa },
    monthly,
    by_source,
    funnel: { leads: total_leads, mql, sql, closed_won },
    sql_stage_split,
    cohort_cpa: cohort,
    lead_log,
    stale: false,
    outreach,
    costs: costsData,
  };

  writeFileSync('data/report.json', JSON.stringify(report, null, 2));
  const monthSnap = `data/${today.slice(0, 7)}.json`;
  writeFileSync(monthSnap, JSON.stringify(report, null, 2));

  // Render HTML
  const { renderHtml } = await import('./render/html.js');
  const html = renderHtml(report);
  writeFileSync('index.html', html);

  // Generate monthly markdown for current month
  const { renderMonthlyMarkdown } = await import('./render/markdown.js');
  const currentMonth = today.slice(0, 7);
  const markdown = renderMonthlyMarkdown(report, currentMonth);
  const mdPath = process.env.KAMG_OPS_PATH
    ? `${process.env.KAMG_OPS_PATH}/clients/cpg-affiliate/reports/${currentMonth}-metrics.md`
    : `reports/${currentMonth}-metrics.md`;
  if (!process.env.KAMG_OPS_PATH) mkdirSync('reports', { recursive: true });
  writeFileSync(mdPath, markdown);
  console.log(`Wrote markdown: ${mdPath}`);

  console.log(`Wrote data/report.json, ${monthSnap}, and index.html`);
  console.log(`Leads: ${attioLeadsRaw.length} raw (deduped ${dedupLeadsArr.length}) | Deals: ${attioDealsRaw.length} | MQL: ${mql} | SQL: ${sql} | Closed Won: ${closed_won}`);
  console.log(`LP submissions: ${lpSubmissions.length} | Vendor spend rows: ${vendorSpend.length}`);
}

// Hybrid spend merge: vendor_spend BQ rows win over monthly_costs.json for the same (month, channel).
// vendor_spend actual schema: month (DATE as {value: 'YYYY-MM-DD'}), vendor (STRING), amount_usd (NUMERIC)
// Vendor-to-channel mapping: "Vovik" → bison_cold, "Google"/"gads" → gads_lp
function mergeSpend(
  vendorRows: Array<{ month: { value: string } | string; vendor: string; category: string | null; amount_usd: number; notes: string | null }>,
  jsonCosts: MonthlyCost[],
): MonthlyCost[] {
  const out = new Map<string, MonthlyCost>();
  // JSON costs as baseline
  for (const c of jsonCosts) out.set(`${c.month}|${c.channel}`, c);

  for (const v of vendorRows) {
    // BQ DATE columns come back as { value: 'YYYY-MM-DD' } objects via the Node.js BQ client
    const rawMonth = typeof v.month === 'object' && v.month !== null ? (v.month as { value: string }).value : String(v.month);
    const month = rawMonth.slice(0, 7); // 'YYYY-MM'
    const vendorLower = v.vendor.toLowerCase();

    // Map vendor name to channel slug
    let channel: Channel | null = null;
    if (vendorLower.includes('vovik') || vendorLower.includes('bison') || vendorLower.includes('cold')) {
      channel = 'bison_cold';
    } else if (vendorLower.includes('google') || vendorLower.includes('gads') || vendorLower.includes('ads')) {
      channel = 'gads_lp';
    }
    // Unknown vendor → skip (don't pollute with 'other')
    if (!channel || !month) continue;

    const media = Number(v.amount_usd ?? 0);
    // BQ rows win: upsert into the map (may overwrite JSON placeholder)
    const existing = out.get(`${month}|${channel}`);
    if (existing) {
      // Add amounts from multiple rows for the same month+channel
      out.set(`${month}|${channel}`, { ...existing, media: existing.media + media });
    } else {
      out.set(`${month}|${channel}`, { month, channel, media, tooling: 0, agency: 0 });
    }
  }

  return Array.from(out.values()).sort((a, b) => `${a.month}|${a.channel}`.localeCompare(`${b.month}|${b.channel}`));
}

main().catch((err) => {
  console.error('Build failed:', err);
  if (existsSync('data/report.json')) {
    writeFileSync('data/.stale', `Failed: ${new Date().toISOString()}: ${String(err.message)}\n`);
  }
  process.exit(1);
});