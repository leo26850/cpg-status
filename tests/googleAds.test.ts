import { describe, it, expect } from "vitest";
import { parseGoogleAdsCsv, aggregateGoogleAds } from "../scripts/compute/googleAds";

const SAMPLE = `Date,Clicks,Impressions,Avg. CPC,Conversions
"Sat, May 16, 2026",0,0,$0.00,0.00
"Wed, May 20, 2026",90,"1,075",$2.69,0.00
"Fri, May 22, 2026",66,698,$2.27,1.00
`;

describe("parseGoogleAdsCsv", () => {
  it("parses quoted dates, thousands separators, and $ values", () => {
    const rows = parseGoogleAdsCsv(SAMPLE);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      date: "2026-05-16", clicks: 0, impressions: 0, avg_cpc: 0, conversions: 0, est_cost: 0,
    });
    expect(rows[1]).toEqual({
      date: "2026-05-20", clicks: 90, impressions: 1075, avg_cpc: 2.69, conversions: 0,
      est_cost: Math.round(90 * 2.69 * 100) / 100,
    });
    expect(rows[2].conversions).toBe(1);
    expect(rows[2].est_cost).toBeCloseTo(149.82, 2);
  });

  it("ignores trailing blank lines", () => {
    expect(parseGoogleAdsCsv(SAMPLE + "\n\n")).toHaveLength(3);
  });
});

describe("aggregateGoogleAds", () => {
  const daily = parseGoogleAdsCsv(`Date,Clicks,Impressions,Avg. CPC,Conversions
"Wed, May 20, 2026",90,"1,075",$2.69,0.00
"Fri, May 22, 2026",66,698,$2.27,1.00
"Sat, May 30, 2026",84,"3,211",$1.86,1.00
`);

  it("rolls up totals and rates with estimated spend", () => {
    const g = aggregateGoogleAds(daily);
    expect(g.window).toEqual({ start: "2026-05-20", end: "2026-05-30" });
    expect(g.totals.impressions).toBe(1075 + 698 + 3211);
    expect(g.totals.clicks).toBe(90 + 66 + 84);
    expect(g.totals.conversions).toBe(2);
    expect(g.totals.ctr).toBeCloseTo(240 / 4984, 4);
    const estSpend = Math.round((90 * 2.69 + 66 * 2.27 + 84 * 1.86) * 100) / 100;
    expect(g.totals.est_spend).toBeCloseTo(estSpend, 2);
    expect(g.totals.avg_cpc).toBeCloseTo(estSpend / 240, 2);
    expect(g.totals.est_cost_per_conv).toBeCloseTo(estSpend / 2, 2);
    expect(g.spend_estimated).toBe(true);
  });

  it("returns null cost-per-conv when zero conversions", () => {
    const d2 = parseGoogleAdsCsv(`Date,Clicks,Impressions,Avg. CPC,Conversions
"Wed, May 20, 2026",10,100,$1.00,0.00
`);
    expect(aggregateGoogleAds(d2).totals.est_cost_per_conv).toBeNull();
  });
});
