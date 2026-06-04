import { describe, it, expect } from "vitest";
import { buildScorecard, computeConversionRates } from "../scripts/compute/scorecard";

const bySource = [
  { source: "gads_lp" as const, leads: 2, mql: 1, sql: 0, closed_won: 0 },
  { source: "bison_cold" as const, leads: 96, mql: 28, sql: 13, closed_won: 3 },
];

describe("buildScorecard", () => {
  it("attributes estimated Ads spend to gads and computes CPL", () => {
    const rows = buildScorecard(bySource, { gadsEstSpend: 250, channelCosts: {} });
    const gads = rows.find((r) => r.source === "gads_lp")!;
    expect(gads.cost).toBe(250);
    expect(gads.cost_estimated).toBe(true);
    expect(gads.cpl).toBe(125); // 250 / 2
  });

  it("leaves cost null for channels without attributable spend", () => {
    const rows = buildScorecard(bySource, { gadsEstSpend: 250, channelCosts: {} });
    const bison = rows.find((r) => r.source === "bison_cold")!;
    expect(bison.cost).toBeNull();
    expect(bison.cpl).toBeNull();
    expect(bison.cost_estimated).toBe(false);
  });

  it("uses a channel-tagged cost when provided", () => {
    const rows = buildScorecard(bySource, { gadsEstSpend: 0, channelCosts: { bison_cold: 960 } });
    const bison = rows.find((r) => r.source === "bison_cold")!;
    expect(bison.cost).toBe(960);
    expect(bison.cpl).toBe(10); // 960 / 96
  });
});

describe("computeConversionRates", () => {
  it("computes stage rates, null on zero denominator", () => {
    expect(computeConversionRates({ leads: 100, mql: 30, sql: 12, closed_won: 3 })).toEqual({
      lead_to_mql: 0.3, mql_to_sql: 0.4, sql_to_won: 0.25,
    });
    expect(computeConversionRates({ leads: 0, mql: 0, sql: 0, closed_won: 0 })).toEqual({
      lead_to_mql: null, mql_to_sql: null, sql_to_won: null,
    });
  });
});
