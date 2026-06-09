# CPG Funnel — Looker Studio Build Guide

One-time guide to assemble the client-facing CPG funnel report in Looker Studio on top of `cpg_marts.*`. After this is built once, it is fully autonomous: the cpg-status build refreshes `cpg_marts` on every run, so the report updates itself with zero manual steps.

| | |
|---|---|
| **Audience** | Client-facing (Krik) — no rep names / agency margin in these tables by design |
| **Data** | BigQuery `cpg-data-warehouse.cpg_marts.*` (US), refreshed by the cpg-status build (`sink-to-bq.ts`) |
| **Build time** | ~20–30 min, once |
| **Looker Studio API** | None exists for layout — charts are placed in the web UI. The Linking-API URL in §8 automates only the data-source connections. |

---

## 0. Prerequisites

- A Google account with **BigQuery Data Viewer on `cpg_marts`** + **BigQuery Job User** on project `cpg-data-warehouse`.
- The five tables exist and are populated (run `bq ls cpg-data-warehouse:cpg_marts` to confirm). If empty, repopulate with:
  ```bash
  GOOGLE_ACCESS_TOKEN=$(gcloud auth print-access-token) npx tsx scripts/sink-report.ts
  ```

### The tables

| Table | Grain | Key columns |
|---|---|---|
| `report_funnel` | 1 row (current) | `total_leads, mql, sql, closed_won, cpl, cpa, lead_to_mql, mql_to_sql, sql_to_won, proposal_sent, negotiating` |
| `report_channels` | 1 row per channel | `channel, leads, mql, sql, closed_won, cost, cpl, cost_estimated` |
| `report_monthly` | 1 row per month | `month, month_start (DATE), total_leads, leads_gads_lp, leads_bison_cold, mql, sql, spend_total, cpl, mql_rate, sql_rate` |
| `report_outreach` | 1 row (current) | `emails_sent, total_leads_contacted, replied, interested, bounced, unsubscribed, active_campaigns, campaign_count, reply_rate, positive_reply_rate, bounce_rate` |
| `report_outreach_campaigns` | 1 row per campaign | `name, status, emails_sent, total_leads_contacted, replied, interested, reply_rate` |

All carry `snapshot_date` (the date that run was generated).

---

## 1. Create the five data sources

> Fastest path: use the **§8 Linking-API URL** — it opens a new report with all five connected. Otherwise, per table:

1. lookerstudio.google.com → **Create → Data source → BigQuery**.
2. Authorize → project **cpg-data-warehouse** → dataset **cpg_marts** → pick the table → **Connect** → **Add to report**.
3. Repeat for all five. Name each clearly (e.g. "Funnel", "Channels", "Monthly", "Outreach", "Campaigns").

### Field type fixes (do once per source, in the data source editor)

- `month_start` → **Date** (YYYY-MM-DD)
- `cost`, `cpl`, `cpa`, `spend_total` → **Currency (USD)**
- `lead_to_mql`, `mql_to_sql`, `sql_to_won`, `mql_rate`, `sql_rate`, `reply_rate`, `positive_reply_rate`, `bounce_rate` → **Percent**
- everything else stays Number / Text

---

## 2. Report-level setup

- New report → add all five data sources.
- **Date-range control** (top of report): bind its date dimension to `report_monthly.month_start`. Default range: launch (2026-05) → today.
- **Channel filter control** (optional): drop-down on `report_channels.channel` (`gads_lp`, `bison_cold`).
- Theme: clean / light, client-safe. Add the CPG logo + a title bar "CPG — Lead Funnel".

---

## 3. Page 1 — Funnel Overview  *(source: report_funnel, report_channels)*

- **4 Scorecards** from `report_funnel`: `total_leads` ("Leads"), `mql` ("Meetings / MQL"), `sql` ("Proposals / SQL"), `closed_won` ("Closed Won").
- **Funnel bar** — Bar chart on `report_funnel`, **no dimension**, metrics in order: `total_leads, mql, sql, closed_won`. Renders four descending bars = the funnel.
- **Conversion rates** — 3 Scorecards (Percent): `lead_to_mql` ("Lead→MQL"), `mql_to_sql` ("MQL→SQL"), `sql_to_won` ("SQL→Won").
- **Channel split** — Pie chart on `report_channels`: dimension `channel`, metric `leads`.

## 4. Page 2 — Channels  *(source: report_channels)*

- **Table**: dimension `channel`; metrics `leads, mql, sql, closed_won, cost, cpl`. Format `cost`/`cpl` as currency.
- Add a caption: *"gads_lp cost is estimated (clicks × avg CPC) until Google Ads spend lands in BQ."* (`cost_estimated = true` flags this.)

## 5. Page 3 — Funnel Trend  *(source: report_monthly)*

- **Time series**: dimension `month_start`; metrics `total_leads, mql, sql`. This is what the date-range control drives.
- Optional second chart: combo — bars `spend_total`, line `cpl`.

## 6. Page 4 — Cold Email  *(source: report_outreach, report_outreach_campaigns)*

- **Scorecards** from `report_outreach`: `emails_sent`, `replied`, `interested`, `reply_rate` (Percent).
- **Table** from `report_outreach_campaigns`: dimension `name`; metrics `status, emails_sent, replied, interested, reply_rate`. Sort by `emails_sent` desc.

## 7. (Optional) Page 5 — Methodology

Text page: definitions (MQL = Booked Call / Promoted; SQL = Proposal Sent / Negotiating / Closed Won; channels = gads_lp / bison_cold), data sources, refresh cadence.

---

## 8. Linking-API shortcut — auto-connect the data sources

This URL opens Looker Studio and creates a new report with **all five `cpg_marts` tables connected** (ds0–ds4). It does **not** build charts — it removes the tedious connect-five-sources step so you start at §2.

```
https://lookerstudio.google.com/reporting/create?r.reportName=CPG%20Lead%20Funnel&ds.ds0.connector=bigQuery&ds.ds0.type=TABLE&ds.ds0.projectId=cpg-data-warehouse&ds.ds0.billingProjectId=cpg-data-warehouse&ds.ds0.datasetId=cpg_marts&ds.ds0.tableId=report_funnel&ds.ds1.connector=bigQuery&ds.ds1.type=TABLE&ds.ds1.projectId=cpg-data-warehouse&ds.ds1.billingProjectId=cpg-data-warehouse&ds.ds1.datasetId=cpg_marts&ds.ds1.tableId=report_channels&ds.ds2.connector=bigQuery&ds.ds2.type=TABLE&ds.ds2.projectId=cpg-data-warehouse&ds.ds2.billingProjectId=cpg-data-warehouse&ds.ds2.datasetId=cpg_marts&ds.ds2.tableId=report_monthly&ds.ds3.connector=bigQuery&ds.ds3.type=TABLE&ds.ds3.projectId=cpg-data-warehouse&ds.ds3.billingProjectId=cpg-data-warehouse&ds.ds3.datasetId=cpg_marts&ds.ds3.tableId=report_outreach&ds.ds4.connector=bigQuery&ds.ds4.type=TABLE&ds.ds4.projectId=cpg-data-warehouse&ds.ds4.billingProjectId=cpg-data-warehouse&ds.ds4.datasetId=cpg_marts&ds.ds4.tableId=report_outreach_campaigns
```

You'll be asked to authorize the BigQuery connector once. Then proceed from §2.

---

## 9. Sharing & autonomy

- **Client-safe**: these tables contain no owner/rep names or agency margin — safe to share with Krik as-is.
- **Share**: report → Share → add Krik as Viewer, or "anyone with the link → Viewer". Set data freshness to ~12h.
- **Auto-refresh**: the cpg-status build writes `cpg_marts` every run via `sink-to-bq.ts`. For the **deployed** build to refresh it automatically, the build's BigQuery identity (the `GOOGLE_ACCESS_TOKEN` / service account it runs as) needs **BigQuery Data Editor on `cpg_marts`**. Until that grant exists, refresh manually with the `scripts/sink-report.ts` command in §0.