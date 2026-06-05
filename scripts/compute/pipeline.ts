import type { TotalPipeline, PipelineStageRow } from './types.js';

// OPEN stages (not terminal) — defines "currently in play"
const OPEN_STAGES = [
  'Call Scheduled',
  'Discovery Call Done',
  'Follow Up Call Done',
  'Following Up',
  'Proposal Sent',
  'Negotiating',
];
const OPEN_STAGE_SET = new Set(OPEN_STAGES);

const CLOSED_WON_STAGE = 'Closed Won';
const CLOSED_LOST_DQ_STAGES = new Set(['Closed Lost', 'Disqualified']);

/**
 * Returns true when a deal's stage_active_from falls within [period.start, period.end]
 * (inclusive, ISO date string comparison).
 * An empty or missing active_from is treated as NOT in window.
 */
function inWindow(stage_active_from: string, period: { start: string; end: string }): boolean {
  if (!stage_active_from) return false;
  const date = stage_active_from.slice(0, 10);
  return date >= period.start && date <= period.end;
}

/**
 * Aggregate an array of deal objects (each with stage + stage_active_from) into a TotalPipeline.
 * - total_all_time: every deal, regardless of stage or date
 * - open_active: deals currently in OPEN stages (live snapshot)
 * - by_stage_open: OPEN stages only, ordered canonically, only stages with count > 0
 * - closed_won_period: Closed Won with stage_active_from in [period.start, period.end]
 * - closed_lost_dq_period: Closed Lost + Disqualified with stage_active_from in window
 * - win_rate_period: closed_won_period / (closed_won_period + closed_lost_dq_period), or 0
 */
export function aggregateTotalPipeline(
  deals: { stage: string; stage_active_from: string }[],
  period: { start: string; end: string },
): TotalPipeline {
  // Count open-stage occurrences per stage
  const openCounts = new Map<string, number>();
  let open_active = 0;
  let closed_won_period = 0;
  let closed_lost_dq_period = 0;

  for (const d of deals) {
    const stage = d.stage.trim();

    if (OPEN_STAGE_SET.has(stage)) {
      open_active++;
      openCounts.set(stage, (openCounts.get(stage) ?? 0) + 1);
    } else if (stage === CLOSED_WON_STAGE) {
      if (inWindow(d.stage_active_from, period)) closed_won_period++;
    } else if (CLOSED_LOST_DQ_STAGES.has(stage)) {
      if (inWindow(d.stage_active_from, period)) closed_lost_dq_period++;
    }
  }

  // Build by_stage_open in canonical OPEN_STAGES order, only include stages with count > 0
  const by_stage_open: PipelineStageRow[] = [];
  for (const stage of OPEN_STAGES) {
    const count = openCounts.get(stage);
    if (count && count > 0) {
      by_stage_open.push({ stage, count });
    }
  }

  const denom = closed_won_period + closed_lost_dq_period;
  const win_rate_period = denom > 0 ? closed_won_period / denom : 0;

  return {
    total_all_time: deals.length,
    open_active,
    by_stage_open,
    closed_won_period,
    closed_lost_dq_period,
    win_rate_period,
    period,
  };
}
