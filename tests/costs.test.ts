// tests/costs.test.ts
import { describe, it, expect } from 'vitest';
import { aggregateCosts } from '../scripts/compute/costs';
import type { CostLineItem } from '../scripts/compute/costs';

// 2-month fixture: April has 40 leads, May has 25 leads; closed_won = 2
const items: CostLineItem[] = [
  { month: '2026-04', label: 'KAMG service fee', amount: 4000 },
  { month: '2026-05', label: 'KAMG service fee', amount: 4000 },
];

const monthly = [
  { month: '2026-04', total_leads: 40 },
  { month: '2026-05', total_leads: 25 },
];

const CLOSED_WON = 2;

describe('aggregateCosts', () => {
  it('builds one PerMonthCost row per month', () => {
    const result = aggregateCosts(items, monthly, CLOSED_WON);
    expect(result.months).toHaveLength(2);
    expect(result.months[0].month).toBe('2026-04');
    expect(result.months[1].month).toBe('2026-05');
  });

  it('sums items correctly within each month', () => {
    const result = aggregateCosts(items, monthly, CLOSED_WON);
    expect(result.months[0].total).toBe(4000);
    expect(result.months[1].total).toBe(4000);
  });

  it('includes item breakdown in each month', () => {
    const result = aggregateCosts(items, monthly, CLOSED_WON);
    expect(result.months[0].items).toHaveLength(1);
    expect(result.months[0].items[0]).toEqual({ label: 'KAMG service fee', amount: 4000 });
  });

  it('assigns correct lead counts from monthly input', () => {
    const result = aggregateCosts(items, monthly, CLOSED_WON);
    expect(result.months[0].leads).toBe(40);
    expect(result.months[1].leads).toBe(25);
  });

  it('computes per-month CPL correctly', () => {
    const result = aggregateCosts(items, monthly, CLOSED_WON);
    // April: 4000 / 40 = 100
    expect(result.months[0].cpl).toBeCloseTo(100, 5);
    // May: 4000 / 25 = 160
    expect(result.months[1].cpl).toBeCloseTo(160, 5);
  });

  it('computes blended CPL correctly', () => {
    const result = aggregateCosts(items, monthly, CLOSED_WON);
    // total_cost=8000, total_leads=65 → 8000/65 ≈ 123.08
    expect(result.blended_cpl).toBeCloseTo(8000 / 65, 5);
  });

  it('computes blended CPA correctly', () => {
    const result = aggregateCosts(items, monthly, CLOSED_WON);
    // 8000 / 2 = 4000
    expect(result.blended_cpa).toBeCloseTo(4000, 5);
  });

  it('returns null CPL when a month has 0 leads', () => {
    const noLeadsMonthly = [
      { month: '2026-04', total_leads: 0 },
      { month: '2026-05', total_leads: 25 },
    ];
    const result = aggregateCosts(items, noLeadsMonthly, CLOSED_WON);
    expect(result.months[0].cpl).toBeNull();
    expect(result.months[1].cpl).toBeCloseTo(4000 / 25, 5);
  });

  it('returns null blended_cpl when total leads across all months is 0', () => {
    const zeroMonthly = [
      { month: '2026-04', total_leads: 0 },
      { month: '2026-05', total_leads: 0 },
    ];
    const result = aggregateCosts(items, zeroMonthly, CLOSED_WON);
    expect(result.blended_cpl).toBeNull();
  });

  it('returns null blended_cpa when closed_won is 0', () => {
    const result = aggregateCosts(items, monthly, 0);
    expect(result.blended_cpa).toBeNull();
  });

  it('collects distinct line_labels in first-seen order', () => {
    const multiLabelItems: CostLineItem[] = [
      { month: '2026-04', label: 'KAMG service fee', amount: 4000 },
      { month: '2026-04', label: 'Attio', amount: 200 },
      { month: '2026-05', label: 'KAMG service fee', amount: 4000 },
    ];
    const result = aggregateCosts(multiLabelItems, monthly, CLOSED_WON);
    expect(result.line_labels).toEqual(['KAMG service fee', 'Attio']);
  });

  it('sums multiple items within the same month', () => {
    const multiItems: CostLineItem[] = [
      { month: '2026-04', label: 'KAMG service fee', amount: 4000 },
      { month: '2026-04', label: 'Attio', amount: 200 },
    ];
    const result = aggregateCosts(multiItems, [{ month: '2026-04', total_leads: 40 }], 1);
    expect(result.months[0].total).toBe(4200);
    expect(result.months[0].cpl).toBeCloseTo(4200 / 40, 5);
    expect(result.total_cost).toBe(4200);
  });

  it('handles empty items array without throwing', () => {
    const result = aggregateCosts([], monthly, CLOSED_WON);
    expect(result.months).toHaveLength(0);
    expect(result.total_cost).toBe(0);
    expect(result.blended_cpl).toBeNull();
    expect(result.blended_cpa).toBeNull();
    expect(result.line_labels).toHaveLength(0);
  });

  it('handles a month in items with no matching monthly row (leads defaults to 0)', () => {
    const orphanItems: CostLineItem[] = [
      { month: '2026-03', label: 'KAMG service fee', amount: 4000 },
    ];
    const result = aggregateCosts(orphanItems, monthly, CLOSED_WON);
    expect(result.months[0].leads).toBe(0);
    expect(result.months[0].cpl).toBeNull();
  });

  it('exposes correct window totals', () => {
    const result = aggregateCosts(items, monthly, CLOSED_WON);
    expect(result.total_cost).toBe(8000);
    expect(result.total_leads).toBe(65);
    expect(result.closed_won).toBe(CLOSED_WON);
  });
});
