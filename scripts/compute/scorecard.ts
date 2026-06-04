import type { Channel, ScorecardRow, ConversionRates } from "./types";

type BySourceRow = { source: Channel; leads: number; mql: number; sql: number; closed_won: number };

export function buildScorecard(
  bySource: BySourceRow[],
  opts: { gadsEstSpend: number; channelCosts: Partial<Record<Channel, number>> },
): ScorecardRow[] {
  return bySource.map((r) => {
    const estimated = r.source === "gads_lp" && opts.gadsEstSpend > 0;
    const tagged = opts.channelCosts[r.source];
    const cost = estimated ? opts.gadsEstSpend : (tagged ?? null);
    const cpl = cost != null && r.leads > 0 ? Math.round((cost / r.leads) * 100) / 100 : null;
    return {
      source: r.source,
      leads: r.leads,
      mql: r.mql,
      sql: r.sql,
      closed_won: r.closed_won,
      cost,
      cpl,
      cost_estimated: estimated,
    };
  });
}

export function computeConversionRates(f: {
  leads: number; mql: number; sql: number; closed_won: number;
}): ConversionRates {
  const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 1000 : null);
  return {
    lead_to_mql: rate(f.mql, f.leads),
    mql_to_sql: rate(f.sql, f.mql),
    sql_to_won: rate(f.closed_won, f.sql),
  };
}
