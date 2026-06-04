// scripts/render/html.ts
import type { ReportData } from '../compute/types.js';
import type { OutreachData } from '../compute/outreach.js';
import type { CostsData } from '../compute/costs.js';

// ===== FORMAT HELPERS =====
const fmtInt = (n: number | null | undefined): string =>
  n == null ? '—' : Math.round(n).toLocaleString('en-US');

const fmtUsd = (n: number | null | undefined): string =>
  n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US');

const fmtPct = (n: number | null | undefined): string =>
  n == null ? '—' : (n * 100).toFixed(1) + '%';

const fmtDec = (n: number | null | undefined, decimals = 2): string =>
  n == null ? '—' : n.toFixed(decimals);

// ===== KPI TILE & CARD HELPERS =====
const kpi = (value: string, label: string, caption: string, extra = ''): string =>
  `<div class="kpi">${extra}
    <div class="kpi-value">${value}</div>
    <div class="kpi-label">${label}</div>
    <p class="caption">${caption}</p>
  </div>`;

const card = (title: string, body: string, caption = ''): string =>
  `<div class="card">
    <h3>${title}</h3>
    ${body}
    ${caption ? `<p class="card-caption">${caption}</p>` : ''}
  </div>`;

// ===== CHANNEL NAME MAP =====
const channelName = (s: string): string => {
  if (s === 'gads_lp')    return 'Google Ads';
  if (s === 'bison_cold') return 'Cold Email';
  return 'Other';
};

const channelSub = (s: string): string => {
  if (s === 'gads_lp')    return 'Paid search via Google Ads LP';
  if (s === 'bison_cold') return 'Bison cold outreach engine';
  return 'Unattributed / direct';
};

// ===== PANEL: OVERVIEW =====
function overviewPanel(r: ReportData): string {
  const k = r.kpis;
  const c = r.costs as CostsData | undefined;

  // Cost per meeting = blended total cost ÷ mql
  const costPerMeeting = (c && c.total_cost > 0 && k.mql > 0)
    ? c.total_cost / k.mql
    : null;

  const kpis = `<div class="kpi-grid">
    ${kpi(fmtInt(k.total_leads), 'Leads Generated',
      'Total inbound leads our campaigns generated this period.')}
    ${kpi(fmtInt(k.mql), 'Meetings Booked',
      'Prospects who booked a discovery call — our Marketing Qualified Lead.')}
    ${kpi(fmtInt(k.closed_won), 'Deals Closed',
      'Closed-won deals sourced from these campaigns.')}
    ${kpi(fmtUsd(costPerMeeting), 'Cost per Meeting',
      'Total marketing cost ÷ meetings booked. Blended across all channels.')}
  </div>`;

  const funnelCard = card(
    'Lead Funnel',
    `<div style="position:relative;height:200px"><canvas id="chart-funnel"></canvas></div>`,
    'How leads move from first touch to closed deal — each bar is a funnel stage.'
  );

  const sourceCard = card(
    'Channel Split',
    `<div style="position:relative;height:220px"><canvas id="chart-by-source"></canvas></div>`,
    'Share of leads by channel: Google Ads vs cold email outreach.'
  );

  return `<section class="panel is-active" id="panel-overview" data-panel="overview">
  <div class="panel-header">
    <div class="panel-eyebrow">01 · Overview</div>
    <h1>Results at a Glance</h1>
    <p class="panel-desc">What KAMG delivered this period — leads generated, meetings booked, and deals closed across both channels.</p>
    <p class="panel-freshness">Window: ${r.window.start} → ${r.window.end}</p>
  </div>
  ${kpis}
  <div class="grid-2 section-gap">
    ${funnelCard}
    ${sourceCard}
  </div>
</section>`;
}

// ===== PANEL: CHANNELS =====
function channelsPanel(r: ReportData): string {
  const rows = (r.scorecard ?? []).map((row) => {
    const cplDisplay = row.cost_estimated
      ? `${fmtUsd(row.cpl)} <span class="tag-estimated">est.</span>`
      : (row.cpl != null ? fmtUsd(row.cpl) : '<span class="tag-muted">—</span>');

    const costDisplay = row.cost_estimated
      ? `${fmtUsd(row.cost)} <span class="tag-estimated">est.</span>`
      : (row.cost != null ? fmtUsd(row.cost) : '<span style="color:var(--faint)">—</span>');

    return `<div class="channel-card">
      <div class="channel-card-name">${channelName(row.source)}</div>
      <div class="channel-card-sub">${channelSub(row.source)}</div>
      <ul class="channel-stat-list">
        <li><span class="channel-stat-label">Leads</span><span class="channel-stat-value">${fmtInt(row.leads)}</span></li>
        <li><span class="channel-stat-label">Meetings (MQL)</span><span class="channel-stat-value">${fmtInt(row.mql)}</span></li>
        <li><span class="channel-stat-label">Proposals (SQL)</span><span class="channel-stat-value">${fmtInt(row.sql)}</span></li>
        <li><span class="channel-stat-label">Deals Closed</span><span class="channel-stat-value">${fmtInt(row.closed_won)}</span></li>
        <li><span class="channel-stat-label">Attributed Cost</span><span class="channel-stat-value">${costDisplay}</span></li>
        <li><span class="channel-stat-label">Cost per Lead</span><span class="channel-stat-value">${cplDisplay}</span></li>
      </ul>
      ${row.cost == null ? '<p class="caption" style="margin-top:12px">Cost not attributed — blended cost shown in Funnel &amp; Conversion.</p>' : ''}
    </div>`;
  }).join('');

  return `<section class="panel" id="panel-channels" data-panel="channels">
  <div class="panel-header">
    <div class="panel-eyebrow">02 · Channels</div>
    <h1>Channel Scorecard</h1>
    <p class="panel-desc">How each acquisition channel is performing side by side — Google Ads (paid search) vs cold email outreach.</p>
    <p class="panel-freshness">Window: ${r.window.start} → ${r.window.end}</p>
  </div>
  <div class="channel-grid section-gap">
    ${rows || '<div class="empty-state">No channel data available.</div>'}
  </div>
</section>`;
}

// ===== PANEL: COLD EMAIL =====
function coldEmailPanel(r: ReportData): string {
  if (!r.outreach) {
    return `<section class="panel" id="panel-coldemail" data-panel="coldemail">
  <div class="panel-header">
    <div class="panel-eyebrow">03 · Cold Email</div>
    <h1>Cold Email Performance</h1>
  </div>
  <div class="empty-state">Outreach data not available.</div>
</section>`;
  }

  const o = r.outreach as OutreachData;

  const kpis = `<div class="kpi-grid">
    ${kpi(fmtInt(o.emails_sent), 'Emails Sent',
      'Total cold emails delivered across all active campaigns.')}
    ${kpi(fmtPct(o.reply_rate), 'Reply Rate',
      'Share of sends that received any reply from the prospect.')}
    ${kpi(fmtInt(o.interested), 'Interested Replies',
      'Replies our team flagged as interested — warm leads.')}
    ${kpi(fmtInt(o.total_leads_contacted), 'Contacts Reached',
      'Unique prospects contacted across all campaigns.')}
  </div>`;

  const campaignRows = o.campaigns.map((c) =>
    `<tr>
      <td>${c.name}</td>
      <td><span class="tag ${c.status === 'active' ? 'tag-green' : 'tag-outline'}">${c.status}</span></td>
      <td>${fmtInt(c.emails_sent)}</td>
      <td>${fmtInt(c.replied)}</td>
      <td>${fmtInt(c.interested)}</td>
      <td>${fmtPct(c.reply_rate)}</td>
    </tr>`
  ).join('');

  const campaignsCard = card(
    'Campaigns by Interest',
    `<div style="overflow-x:auto">
      <table>
        <thead>
          <tr><th>Campaign</th><th>Status</th><th>Sent</th><th>Replied</th><th>Interested</th><th>Reply Rate</th></tr>
        </thead>
        <tbody>${campaignRows}</tbody>
      </table>
    </div>`,
    'Open rate is not tracked — campaigns use plain-text sends with open tracking disabled.'
  );

  return `<section class="panel" id="panel-coldemail" data-panel="coldemail">
  <div class="panel-header">
    <div class="panel-eyebrow">03 · Cold Email</div>
    <h1>Cold Email Performance</h1>
    <p class="panel-desc">Bison-powered outreach — the volume engine driving the majority of CPG leads today.</p>
    <p class="panel-freshness">Window: ${r.window.start} → ${r.window.end}</p>
  </div>
  ${kpis}
  ${campaignsCard}
</section>`;
}

// ===== PANEL: GOOGLE ADS =====
function googleAdsPanel(r: ReportData): string {
  const g = r.google_ads;

  if (!g) {
    return `<section class="panel" id="panel-googleads" data-panel="googleads">
  <div class="panel-header">
    <div class="panel-eyebrow">04 · Google Ads</div>
    <h1>Google Ads Performance</h1>
  </div>
  <div class="empty-state">Google Ads data not loaded.</div>
</section>`;
  }

  const t = g.totals;

  const kpis = `<div class="kpi-grid">
    ${kpi(fmtInt(t.impressions), 'Impressions',
      'Total times our ads were shown to searchers in this window.')}
    ${kpi(fmtInt(t.clicks), 'Clicks',
      'Number of clicks through to the landing page.')}
    ${kpi(fmtPct(t.ctr), 'Click-Through Rate',
      'Clicks ÷ impressions. Measures how compelling our ad copy is.')}
    ${kpi('$' + fmtDec(t.avg_cpc), 'Avg. CPC',
      'Average cost per click — estimated from clicks × avg CPC in export.')}
    ${kpi(fmtInt(t.conversions), 'Conversions',
      'Conversions counted by Google’s own tag (see note above on how this differs from leads).')}
    ${kpi(
      fmtUsd(t.est_spend) + ' <span class="tag-estimated">estimated</span>',
      'Est. Spend',
      'Derived as Σ daily clicks × avg CPC. The export has no exact cost column.'
    )}
    ${kpi(
      (t.est_cost_per_conv != null ? fmtUsd(t.est_cost_per_conv) : '—') + ' <span class="tag-estimated">estimated</span>',
      'Est. Cost / Conversion',
      'Estimated spend ÷ conversions. Will sharpen as volume grows.'
    )}
  </div>`;

  const trendCard = card(
    'Daily Impressions & Clicks',
    `<div style="position:relative;height:260px"><canvas id="chart-gads-trend"></canvas></div>`,
    'Daily impressions (left axis) and clicks (right axis) over the reporting window.'
  );

  const gadsLeads = r.scorecard?.find((s) => s.source === 'gads_lp')?.leads ?? 0;
  const reconcile = `<strong>Conversions vs leads:</strong> Google’s conversion tag fired <strong>${fmtInt(t.conversions)}</strong> ${t.conversions === 1 ? 'time' : 'times'} this period, while Attio attributes <strong>${fmtInt(gadsLeads)}</strong> landing-page form-fills to Google Ads. These count different things — Google’s tag only fires on specific tracked actions, whereas every completed LP form becomes a lead. We report the form-fills (${fmtInt(gadsLeads)}) as the channel’s lead count.`;

  const disclaimerCallout = `<div class="callout info section-gap">
    Google Ads is a new, ramping channel — live since mid-May 2026. ${reconcile} Spend is estimated from clicks × average CPC (the export has no exact cost column); exact spend and per-campaign breakdown arrive once the Google Ads developer token is approved (Phase 2).
  </div>`;

  return `<section class="panel" id="panel-googleads" data-panel="googleads">
  <div class="panel-header">
    <div class="panel-eyebrow">04 · Google Ads</div>
    <h1>Google Ads Performance</h1>
    <p class="panel-desc">Account-level paid search performance for the period ${g.window.start} → ${g.window.end}. This is Phase 1 (CSV-based); live API data arrives in Phase 2.</p>
    <p class="panel-freshness">Ads data window: ${g.window.start} → ${g.window.end}</p>
  </div>
  ${disclaimerCallout}
  ${kpis}
  ${trendCard}
</section>`;
}

// ===== PANEL: FUNNEL & CONVERSION =====
function funnelPanel(r: ReportData): string {
  const f = r.funnel;
  const cr = r.conversion_rates;
  const c = r.costs as CostsData | undefined;

  const stages: Array<{ name: string; count: number; sub: string; color: string }> = [
    { name: 'Leads',      count: f.leads,      sub: 'All inbound leads from campaigns',   color: 'var(--accent)' },
    { name: 'MQL',        count: f.mql,         sub: 'Booked a discovery call',             color: 'var(--blue)' },
    { name: 'SQL',        count: f.sql,         sub: 'Reached Proposal Sent or later',      color: 'var(--green)' },
    { name: 'Closed Won', count: f.closed_won,  sub: 'Deal closed',                         color: '#a78bfa' },
  ];

  const rates: Array<{ label: string; value: number | null }> = cr ? [
    { label: 'Lead → MQL',         value: cr.lead_to_mql },
    { label: 'MQL → SQL',          value: cr.mql_to_sql  },
    { label: 'SQL → Closed Won',   value: cr.sql_to_won  },
  ] : [];

  const stageRows = stages.map((s, i) => {
    const rateChip = (i < rates.length)
      ? `<div class="funnel-arrow">↓ <span class="funnel-rate-chip">${fmtPct(rates[i].value)} ${rates[i].label}</span></div>`
      : '';
    return `<div class="funnel-stage-row">
      <div class="funnel-stage-num" style="color:${s.color}">${fmtInt(s.count)}</div>
      <div class="funnel-stage-info">
        <div class="funnel-stage-name">${s.name}</div>
        <div class="funnel-stage-sub">${s.sub}</div>
      </div>
    </div>${rateChip}`;
  }).join('');

  const stagesCard = card(
    'Funnel Stages',
    `<div class="funnel-stages">${stageRows}</div>`,
    'Stage-by-stage counts with the conversion rate between each adjacent stage.'
  );

  // Blended efficiency from costs object
  const blendedCpl = c?.blended_cpl ?? null;
  const blendedCpa = c?.blended_cpa ?? null;

  const efficiencyCard = card(
    'Blended Efficiency',
    `<div class="kpi-grid" style="gap:12px;margin-bottom:0">
      <div class="kpi">
        <div class="kpi-value">${fmtUsd(blendedCpl)}</div>
        <div class="kpi-label">Blended CPL</div>
        <p class="caption">Total marketing cost ÷ total leads. Across all channels.</p>
      </div>
      <div class="kpi">
        <div class="kpi-value">${fmtUsd(blendedCpa)}</div>
        <div class="kpi-label">Blended CPA</div>
        <p class="caption">Total marketing cost ÷ closed-won deals.</p>
      </div>
      <div class="kpi">
        <div class="kpi-value">${fmtUsd(c?.total_cost)}</div>
        <div class="kpi-label">Total Spend</div>
        <p class="caption">KAMG service fee included. Google Ads ad spend tracked separately.</p>
      </div>
    </div>`,
    'Blended across all channels — total marketing cost ÷ leads (CPL) and ÷ closed deals (CPA). Google Ads spend is estimated.'
  );

  return `<section class="panel" id="panel-funnel" data-panel="funnel">
  <div class="panel-header">
    <div class="panel-eyebrow">05 · Funnel &amp; Conversion</div>
    <h1>Funnel Breakdown</h1>
    <p class="panel-desc">Full funnel with stage-by-stage conversion rates and blended cost efficiency metrics.</p>
    <p class="panel-freshness">Window: ${r.window.start} → ${r.window.end}</p>
  </div>
  <div class="grid-2 section-gap">
    ${stagesCard}
    ${efficiencyCard}
  </div>
</section>`;
}

// ===== PANEL: METHODOLOGY =====
function methodologyPanel(r: ReportData): string {
  const genDate = r.generated_at.slice(0, 10);

  return `<section class="panel" id="panel-methodology" data-panel="methodology">
  <div class="panel-header">
    <div class="panel-eyebrow">06 · Methodology</div>
    <h1>How We Measure</h1>
    <p class="panel-desc">Definitions, channel rules, data sources, and refresh cadence — so every number in this report is auditable.</p>
    <p class="panel-freshness">Generated: ${r.generated_at}</p>
  </div>

  <div class="card section-gap">
    <h3>Definitions</h3>
    <div class="method-grid">
      <div class="method-item">
        <h4>Lead</h4>
        <p>Any contact who submitted the CPG landing-page form or was created in the Attio Leads object via the Bison reply webhook. Raw count, no qualification filter.</p>
      </div>
      <div class="method-item">
        <h4>MQL — Marketing Qualified Lead</h4>
        <p>Lead has reached Attio Leads stage <code>Booked Call</code>. Represents a booked discovery call with the CPG sales team.</p>
      </div>
      <div class="method-item">
        <h4>SQL — Sales Qualified Lead</h4>
        <p>Deal object has reached <code>Proposal Sent</code>, <code>Negotiating</code>, or <code>Closed Won</code> stage in Attio Deals.</p>
      </div>
      <div class="method-item">
        <h4>Closed Won</h4>
        <p>Deal at <code>Closed Won</code> stage. Counts only deals whose linked person matches a known lead source.</p>
      </div>
    </div>
  </div>

  <div class="card section-gap">
    <h3>Channel Attribution Rules</h3>
    <ul class="source-list">
      <li><strong>gads_lp</strong> — lead_source = <code>gads_lp</code> in Attio. Set by the LP webhook when UTM source contains "google" or medium is "cpc".</li>
      <li><strong>bison_cold</strong> — lead_source = <code>bison_cold</code>. Set when a Bison reply triggers lead creation via webhook.</li>
      <li><strong>other</strong> — all remaining leads not matching the two above rules. Excluded from channel scorecard CPL.</li>
    </ul>
  </div>

  <div class="card section-gap">
    <h3>Data Sources</h3>
    <ul class="source-list">
      <li><strong>Leads &amp; Deals</strong> — Attio live API (workspace: cpg-affiliate-partners). Pulled at build time via authenticated REST calls.</li>
      <li><strong>Cold Email Metrics</strong> — Bison <code>/campaigns</code> endpoint. Sends, replied, interested per campaign. Open-rate not tracked (plain-text sends).</li>
      <li><strong>Google Ads (Phase 1)</strong> — Account-level daily CSV export (<code>data/google_ads_export.csv</code>). Columns: Date, Clicks, Impressions, Avg. CPC, Conversions. Spend is derived (Σ clicks × avg CPC) and labeled <span class="tag-estimated">estimated</span>. No campaign-level breakdown in Phase 1.</li>
      <li><strong>Cost Model</strong> — <code>data/marketing_costs.json</code> line items. Currently includes KAMG service fee. Google Ads exact spend will be added in Phase 2.</li>
    </ul>
  </div>

  <div class="card section-gap">
    <h3>Refresh Cadence</h3>
    <p style="margin-bottom:8px">This report rebuilds automatically on a <strong>weekly schedule</strong> via a GitHub Actions workflow. The compute layer fetches live data from Attio and Bison at build time — no manual HTML editing required.</p>
    <p>Report as of: <code>${genDate}</code></p>
  </div>

  <div class="callout info section-gap">
    <strong>Honest omissions:</strong> Pipeline revenue and deal value are not shown — the Attio Deals value field is unpopulated (0/200 deals have a value). Revenue metrics will be added once CPG's sales team records deal values at close. Google Ads exact spend and per-campaign detail arrive in Phase 2 when the Google Ads developer token is approved.
  </div>
</section>`;
}

// ===== MAIN RENDER =====
export function renderHtml(r: ReportData): string {
  const staleBanner = r.stale
    ? `<div class="banner-stale"><strong>Stale</strong> — last refresh failed ${(r as { stale_reason?: string }).stale_reason ?? ''}</div>`
    : '';

  // Determine report month label from window
  const windowEnd = r.window?.end ?? r.generated_at.slice(0, 7);
  const reportMonth = windowEnd.slice(0, 7); // YYYY-MM

  const navItems = [
    { id: 'overview',     label: 'Overview',          num: '01' },
    { id: 'channels',     label: 'Channels',           num: '02' },
    { id: 'coldemail',    label: 'Cold Email',         num: '03' },
    { id: 'googleads',    label: 'Google Ads',         num: '04' },
    { id: 'funnel',       label: 'Funnel & Conversion', num: '05' },
    { id: 'methodology',  label: 'Methodology',        num: '06' },
  ];

  const navButtons = navItems.map(({ id, label, num }) =>
    `<button data-panel="${id}"><span class="nav-num">${num}</span>${label}</button>`
  ).join('\n      ');

  const genDate = r.generated_at.slice(0, 10);

  const sidebar = `<aside class="sidebar">
  <div class="sidebar-brand">
    <div class="brand-mark">CPG <span>×</span> KAMG</div>
    <div class="report-month">${reportMonth}</div>
  </div>
  <nav>
    ${navButtons}
  </nav>
  <div class="sidebar-footer">
    Generated ${genDate}
  </div>
</aside>`;

  const stage = `<main class="stage">
  ${overviewPanel(r)}
  ${channelsPanel(r)}
  ${coldEmailPanel(r)}
  ${googleAdsPanel(r)}
  ${funnelPanel(r)}
  ${methodologyPanel(r)}
</main>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CPG Affiliate — ROI Report</title>
  <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
${staleBanner}
${sidebar}
${stage}
<script id="report-data" type="application/json">${JSON.stringify(r)}</script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="assets/charts.js"></script>
<script src="assets/nav.js"></script>
</body>
</html>`;
}

// Keep these exports to suppress "unused" warnings — they may be imported by tests or other render paths
export { renderHtml as default };
