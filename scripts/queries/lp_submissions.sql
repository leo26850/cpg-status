-- LP form submissions: timestamped Google Ads lead arrival.
-- Used for historical monthly lead volume on the gads_lp side.
-- Schema notes:
--   submitted_at TIMESTAMP (not DATE) — cast @start_date to TIMESTAMP for comparison
--   email        STRING  — already lowercased+trimmed by CF, no further normalization needed
--   source       STRING  — computed values: 'Google Ads' | 'Cold Email' | 'Direct' | utm_source titlecased
--                          NOT the Attio lead_source slugs (gads_lp / bison_cold)
SELECT
  request_id,
  LOWER(TRIM(email)) AS email,
  submitted_at,
  source,
  attio_lead_id,
  gads_campaign_id,
  gclid,
  utm_source,
  utm_medium,
  utm_campaign
FROM `cpg-data-warehouse.kamg_cpg.lp_form_submissions`
WHERE submitted_at >= TIMESTAMP(@start_date)
ORDER BY submitted_at ASC