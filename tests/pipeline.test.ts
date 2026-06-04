import { describe, it, expect } from 'vitest';
import { aggregateTotalPipeline } from '../scripts/compute/pipeline';

// Known snapshot counts (from live Attio data as of spec):
// Call Scheduled 11, Discovery Call Done 68, Follow Up Call Done 51,
// Following Up 15, Proposal Sent 15, Negotiating 18, Closed Won 43,
// Closed Lost 8, Disqualified 6  → total = 235
function buildSnapshot(): string[] {
  const entries: Array<[string, number]> = [
    ['Call Scheduled', 11],
    ['Discovery Call Done', 68],
    ['Follow Up Call Done', 51],
    ['Following Up', 15],
    ['Proposal Sent', 15],
    ['Negotiating', 18],
    ['Closed Won', 43],
    ['Closed Lost', 8],
    ['Disqualified', 6],
  ];
  const out: string[] = [];
  for (const [stage, n] of entries) {
    for (let i = 0; i < n; i++) out.push(stage);
  }
  return out;
}

describe('aggregateTotalPipeline — snapshot', () => {
  const snapshot = buildSnapshot();
  const result = aggregateTotalPipeline(snapshot);

  it('total = 235', () => {
    expect(result.total).toBe(235);
  });

  it('open_active = 178 (all except Closed Won / Closed Lost / Disqualified)', () => {
    expect(result.open_active).toBe(178);
  });

  it('closed_won = 43', () => {
    expect(result.closed_won).toBe(43);
  });

  it('closed_lost_dq = 14 (Closed Lost 8 + Disqualified 6)', () => {
    expect(result.closed_lost_dq).toBe(14);
  });

  it('close_rate ≈ 0.754 (43 / 57)', () => {
    expect(result.close_rate).toBeCloseTo(43 / 57, 3);
  });

  it('by_stage follows canonical order', () => {
    const stageNames = result.by_stage.map((r) => r.stage);
    expect(stageNames).toEqual([
      'Call Scheduled',
      'Discovery Call Done',
      'Follow Up Call Done',
      'Following Up',
      'Proposal Sent',
      'Negotiating',
      'Closed Won',
      'Closed Lost',
      'Disqualified',
    ]);
  });

  it('by_stage counts match snapshot', () => {
    const map = Object.fromEntries(result.by_stage.map((r) => [r.stage, r.count]));
    expect(map['Call Scheduled']).toBe(11);
    expect(map['Discovery Call Done']).toBe(68);
    expect(map['Closed Won']).toBe(43);
    expect(map['Disqualified']).toBe(6);
  });
});

describe('aggregateTotalPipeline — edge cases', () => {
  it('returns 0 close_rate when denominator is 0', () => {
    const result = aggregateTotalPipeline(['Call Scheduled', 'Following Up']);
    expect(result.close_rate).toBe(0);
    expect(result.closed_won).toBe(0);
    expect(result.closed_lost_dq).toBe(0);
  });

  it('handles empty input', () => {
    const result = aggregateTotalPipeline([]);
    expect(result.total).toBe(0);
    expect(result.by_stage).toHaveLength(0);
    expect(result.close_rate).toBe(0);
  });

  it('appends unknown stages after canonical ones', () => {
    const result = aggregateTotalPipeline(['Closed Won', 'Mystery Stage', 'Call Scheduled']);
    const names = result.by_stage.map((r) => r.stage);
    expect(names.indexOf('Call Scheduled')).toBeLessThan(names.indexOf('Closed Won'));
    expect(names[names.length - 1]).toBe('Mystery Stage');
  });

  it('open_active excludes all three terminal stages', () => {
    const stages = ['Closed Won', 'Closed Won', 'Closed Lost', 'Disqualified', 'Negotiating'];
    const result = aggregateTotalPipeline(stages);
    expect(result.open_active).toBe(1); // only Negotiating
  });
});
