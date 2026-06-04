import { describe, it, expect } from "vitest";
import { parseGoogleAdsCsv } from "../scripts/compute/googleAds";

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
