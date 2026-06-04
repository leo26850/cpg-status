// scripts/compute/costs.ts
// Pure cost-model module — no side effects, fully unit-testable.
// Computes blended CPL (cost per lead) and CPA (cost per acquisition)
// from an extensible list of monthly cost line items.

export type CostLineItem = {
  month: string;   // YYYY-MM
  label: string;
  amount: number;
  channel?: import('./types.js').Channel;   // optional: tags a cost to a channel for per-channel CPL
};

export type PerMonthCost = {
  month: string;
  total: number;
  items: Array<{ label: string; amount: number }>;
  leads: number;
  cpl: number | null;
};

export type CostsData = {
  months: PerMonthCost[];
  total_cost: number;
  total_leads: number;
  closed_won: number;
  blended_cpl: number | null;
  blended_cpa: number | null;
  line_labels: string[]; // distinct labels included across all months
};

export function aggregateCosts(
  items: CostLineItem[],
  monthly: Array<{ month: string; total_leads: number }>,
  closedWon: number,
): CostsData {
  // Index monthly lead counts by month string for O(1) lookup
  const leadsByMonth = new Map<string, number>(monthly.map((m) => [m.month, m.total_leads]));

  // Gather all distinct months present in items
  const monthSet = new Set<string>(items.map((i) => i.month));

  // Build per-month rows
  const months: PerMonthCost[] = Array.from(monthSet)
    .sort()
    .map((month) => {
      const monthItems = items.filter((i) => i.month === month);
      const total = monthItems.reduce((s, i) => s + i.amount, 0);
      const leads = leadsByMonth.get(month) ?? 0;
      return {
        month,
        total,
        items: monthItems.map((i) => ({ label: i.label, amount: i.amount })),
        leads,
        cpl: leads > 0 ? total / leads : null,
      };
    });

  // Window totals
  const total_cost = months.reduce((s, m) => s + m.total, 0);
  const total_leads = months.reduce((s, m) => s + m.leads, 0);

  // Distinct labels (preserving first-seen order)
  const labelSeen = new Set<string>();
  const line_labels: string[] = [];
  for (const item of items) {
    if (!labelSeen.has(item.label)) {
      labelSeen.add(item.label);
      line_labels.push(item.label);
    }
  }

  return {
    months,
    total_cost,
    total_leads,
    closed_won: closedWon,
    blended_cpl: total_leads > 0 && total_cost > 0 ? total_cost / total_leads : null,
    blended_cpa: closedWon > 0 && total_cost > 0 ? total_cost / closedWon : null,
    line_labels,
  };
}
