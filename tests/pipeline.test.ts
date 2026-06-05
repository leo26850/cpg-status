import { describe, it, expect } from 'vitest';
import { aggregateTotalPipeline } from '../scripts/compute/pipeline';

// Test period matching the CPG launch window
const TEST_PERIOD = { start: '2026-05-11', end: '2026-06-04' };

/**
 * Fixture:
 *  - 6 open deals across stages (Call Scheduled: 2, Discovery Call Done: 2, Proposal Sent: 1, Negotiating: 1)
 *  - 2 Closed Won with active_from IN window (2026-05-19, 2026-06-02)
 *  - 37 Closed Won with active_from 2026-04-29 (OUT of window — April migration cluster)
 *  - 1 Closed Lost with active_from IN window (2026-05-20)
 *  - 1 Disqualified with active_from 2026-04-01 (OUT of window)
 *
 * Total: 6 + 2 + 37 + 1 + 1 = 47
 */
function buildFixture(): { stage: string; stage_active_from: string }[] {
  const deals: { stage: string; stage_active_from: string }[] = [];

  // 6 open deals
  const openEntries: Array<[string, number, string]> = [
    ['Call Scheduled',        2, '2026-05-15'],
    ['Discovery Call Done',   2, '2026-05-18'],
    ['Proposal Sent',         1, '2026-05-25'],
    ['Negotiating',           1, '2026-06-01'],
  ];
  for (const [stage, count, active_from] of openEntries) {
    for (let i = 0; i < count; i++) deals.push({ stage, stage_active_from: active_from });
  }

  // 2 Closed Won IN window
  deals.push({ stage: 'Closed Won', stage_active_from: '2026-05-19' });
  deals.push({ stage: 'Closed Won', stage_active_from: '2026-06-02' });

  // 37 Closed Won OUT of window (April migration)
  for (let i = 0; i < 37; i++) {
    deals.push({ stage: 'Closed Won', stage_active_from: '2026-04-29' });
  }

  // 1 Closed Lost IN window
  deals.push({ stage: 'Closed Lost', stage_active_from: '2026-05-20' });

  // 1 Disqualified OUT of window
  deals.push({ stage: 'Disqualified', stage_active_from: '2026-04-01' });

  return deals;
}

describe('aggregateTotalPipeline — fixture (period-scoped closes)', () => {
  const fixture = buildFixture();
  const result = aggregateTotalPipeline(fixture, TEST_PERIOD);

  it('total_all_time = 47', () => {
    expect(result.total_all_time).toBe(47);
  });

  it('open_active = 6', () => {
    expect(result.open_active).toBe(6);
  });

  it('closed_won_period = 2 (excludes 37 April-migration deals)', () => {
    expect(result.closed_won_period).toBe(2);
  });

  it('closed_lost_dq_period = 1 (only Closed Lost in window; Disqualified out)', () => {
    expect(result.closed_lost_dq_period).toBe(1);
  });

  it('win_rate_period ≈ 0.667 (2 / 3)', () => {
    expect(result.win_rate_period).toBeCloseTo(2 / 3, 3);
  });

  it('by_stage_open sums to 6', () => {
    const sum = result.by_stage_open.reduce((acc, r) => acc + r.count, 0);
    expect(sum).toBe(6);
  });

  it('by_stage_open contains only open stages', () => {
    const stageNames = result.by_stage_open.map((r) => r.stage);
    expect(stageNames).not.toContain('Closed Won');
    expect(stageNames).not.toContain('Closed Lost');
    expect(stageNames).not.toContain('Disqualified');
  });

  it('by_stage_open follows canonical OPEN_STAGES order', () => {
    const names = result.by_stage_open.map((r) => r.stage);
    expect(names).toEqual([
      'Call Scheduled',
      'Discovery Call Done',
      'Proposal Sent',
      'Negotiating',
    ]);
  });

  it('by_stage_open excludes stages with count 0', () => {
    // Follow Up Call Done and Following Up have no deals in fixture
    const names = result.by_stage_open.map((r) => r.stage);
    expect(names).not.toContain('Follow Up Call Done');
    expect(names).not.toContain('Following Up');
  });

  it('period is passed through correctly', () => {
    expect(result.period).toEqual(TEST_PERIOD);
  });
});

describe('aggregateTotalPipeline — edge cases', () => {
  it('returns win_rate_period = 0 when denominator is 0', () => {
    const deals = [
      { stage: 'Call Scheduled', stage_active_from: '2026-05-15' },
      { stage: 'Following Up',   stage_active_from: '2026-05-16' },
    ];
    const result = aggregateTotalPipeline(deals, TEST_PERIOD);
    expect(result.win_rate_period).toBe(0);
    expect(result.closed_won_period).toBe(0);
    expect(result.closed_lost_dq_period).toBe(0);
  });

  it('handles empty input', () => {
    const result = aggregateTotalPipeline([], TEST_PERIOD);
    expect(result.total_all_time).toBe(0);
    expect(result.open_active).toBe(0);
    expect(result.by_stage_open).toHaveLength(0);
    expect(result.win_rate_period).toBe(0);
  });

  it('empty stage_active_from is not counted as in-window', () => {
    const deals = [
      { stage: 'Closed Won', stage_active_from: '' },
      { stage: 'Closed Lost', stage_active_from: '' },
    ];
    const result = aggregateTotalPipeline(deals, TEST_PERIOD);
    expect(result.closed_won_period).toBe(0);
    expect(result.closed_lost_dq_period).toBe(0);
    expect(result.win_rate_period).toBe(0);
    // They still count toward total
    expect(result.total_all_time).toBe(2);
  });

  it('boundary dates: period.start and period.end are inclusive', () => {
    const deals = [
      { stage: 'Closed Won', stage_active_from: '2026-05-11' }, // exactly period.start
      { stage: 'Closed Won', stage_active_from: '2026-06-04' }, // exactly period.end
      { stage: 'Closed Won', stage_active_from: '2026-05-10' }, // one day before
      { stage: 'Closed Won', stage_active_from: '2026-06-05' }, // one day after
    ];
    const result = aggregateTotalPipeline(deals, TEST_PERIOD);
    expect(result.closed_won_period).toBe(2); // only start + end boundaries count
  });

  it('open_active excludes all terminal stages', () => {
    const deals = [
      { stage: 'Closed Won',  stage_active_from: '2026-05-15' },
      { stage: 'Closed Won',  stage_active_from: '2026-05-16' },
      { stage: 'Closed Lost', stage_active_from: '2026-05-17' },
      { stage: 'Disqualified',stage_active_from: '2026-05-18' },
      { stage: 'Negotiating', stage_active_from: '2026-05-19' },
    ];
    const result = aggregateTotalPipeline(deals, TEST_PERIOD);
    expect(result.open_active).toBe(1); // only Negotiating
  });
});