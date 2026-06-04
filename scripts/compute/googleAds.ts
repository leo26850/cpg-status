import type { GoogleAdsDaily } from "./types";

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/** Split one CSV line into fields, respecting double-quoted segments. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === "," && !inQuotes) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

/** "Sat, May 16, 2026" -> "2026-05-16" */
function parseAdsDate(raw: string): string {
  // After CSV unquoting the inner commas remain: "Sat, May 16, 2026"
  const m = raw.match(/([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})/);
  if (!m) throw new Error(`Unparseable Google Ads date: "${raw}"`);
  const mon = MONTHS[m[1]];
  if (!mon) throw new Error(`Unknown month in Google Ads date: "${raw}"`);
  return `${m[3]}-${mon}-${String(m[2]).padStart(2, "0")}`;
}

function num(raw: string): number {
  const cleaned = raw.replace(/[$,"\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

import type { GoogleAdsData } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function aggregateGoogleAds(daily: GoogleAdsDaily[]): GoogleAdsData {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const impressions = sorted.reduce((s, d) => s + d.impressions, 0);
  const clicks = sorted.reduce((s, d) => s + d.clicks, 0);
  const conversions = sorted.reduce((s, d) => s + d.conversions, 0);
  const est_spend = round2(sorted.reduce((s, d) => s + d.est_cost, 0));
  return {
    window: {
      start: sorted[0]?.date ?? "",
      end: sorted[sorted.length - 1]?.date ?? "",
    },
    daily: sorted,
    totals: {
      impressions,
      clicks,
      ctr: impressions > 0 ? clicks / impressions : 0,
      avg_cpc: clicks > 0 ? round2(est_spend / clicks) : 0,
      conversions,
      est_spend,
      est_cost_per_conv: conversions > 0 ? round2(est_spend / conversions) : null,
    },
    spend_estimated: true,
  };
}

/** Parse the Google Ads "Time series" CSV export into daily rows. */
export function parseGoogleAdsCsv(csv: string): GoogleAdsDaily[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const body = lines.slice(1); // drop header
  return body.map((line) => {
    const f = splitCsvLine(line);
    // f[0] = date, f[1] = clicks, f[2] = impressions, f[3] = avg cpc, f[4] = conversions
    const clicks = num(f[1]);
    const avg_cpc = num(f[3]);
    const est_cost = Math.round(clicks * avg_cpc * 100) / 100;
    return {
      date: parseAdsDate(f[0]),
      clicks,
      impressions: num(f[2]),
      avg_cpc,
      conversions: num(f[4]),
      est_cost,
    };
  });
}
