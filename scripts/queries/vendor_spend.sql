-- Monthly fully-loaded spend per vendor from cpg.vendor_spend (primary).
-- DATASET LOCATION: us-central1 (NOT US) — must use location='us-central1' in runQuery.
-- Actual schema (confirmed 2026-05-27):
--   month       DATE     REQUIRED  -- stored as first day of month (e.g. 2026-04-01)
--   vendor      STRING   REQUIRED  -- vendor/supplier name (e.g. "Vovik", "Google", etc.)
--   category    STRING   NULLABLE  -- email_infra | tooling | headcount | other
--   amount_usd  NUMERIC  REQUIRED  -- spend amount in USD
--   notes       STRING   NULLABLE  -- free-text notes
--   created_at  TIMESTAMP REQUIRED
--   _synced_at  TIMESTAMP REQUIRED
--   _source     STRING   REQUIRED
--
-- NOTE: The 'vendor' column contains supplier names (e.g. "Vovik"), NOT channel slugs.
-- mergeSpend() in build-report.ts maps vendor → channel (gads_lp / bison_cold) by
-- checking vendor name substrings: "google"/"gads" → gads_lp, "vovik"/"bison" → bison_cold.
SELECT
  *
FROM `cpg-data-warehouse.cpg.vendor_spend`
ORDER BY 1 ASC