# cpg-status

Auto-built lead funnel dashboard for CPG Affiliate. Deployed to GitHub Pages.

**URL:** https://leo26850.github.io/cpg-status/ (private repo, public-static site - do not share externally)

## What it does

Weekly (Sunday 06:00 UTC) a GitHub Action fetches Leads + Deals live from the Attio API, augments with historical lead-arrival data from `kamg_cpg.lp_form_submissions` and spend from `cpg.vendor_spend` (BigQuery), computes lead-funnel metrics per the [CPG metrics rubric](https://github.com/kasandzz/kamg-ops/blob/main/clients/cpg-affiliate/metrics-rubric.md), and rebuilds `index.html` + `data/report.json`. The deploy is automatic via GH Pages.

## Manual operations

### Update spend numbers

Edit `data/monthly_costs.json`, commit. The next build (push triggers a rebuild) uses the new numbers. `cpg.vendor_spend` BQ rows take precedence over the JSON for any (month, channel) covered there.

### Trigger a manual build

GitHub UI: Actions -> "Build report" -> "Run workflow".

Or:
```bash
gh workflow run build.yml -R leo26850/cpg-status
```

### Run locally

```bash
npm install
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa-key.json
export ATTIO_API_KEY=$(gcloud secrets versions access latest --secret=attio_api_key --project=cpg-data-warehouse)
npm run build
open index.html
```

## Spec + plan

- Spec: `kamg-ops/clients/cpg-affiliate/prds/sales-report-plan.md`
- Plan: `kamg-ops/clients/cpg-affiliate/prds/sales-report-implementation-plan.md`
- Rubric: `kamg-ops/clients/cpg-affiliate/metrics-rubric.md`
- BQ recon: `kamg-ops/clients/cpg-affiliate/docs/bq-table-recon-2026-05-27.md`