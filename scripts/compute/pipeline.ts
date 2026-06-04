import type { TotalPipeline, PipelineStageRow } from './types.js';

// Canonical stage order for the Total Pipeline panel.
// Stages present in the data that are not in this list are appended at the end.
const CANONICAL_ORDER = [
  'Call Scheduled',
  'Discovery Call Done',
  'Follow Up Call Done',
  'Following Up',
  'Proposal Sent',
  'Negotiating',
  'Closed Won',
  'Closed Lost',
  'Disqualified',
];

const CLOSED_WON_STAGE = 'Closed Won';
const CLOSED_LOST_DQ_STAGES = new Set(['Closed Lost', 'Disqualified']);
// Stages that are NOT open/active (terminal)
const TERMINAL_STAGES = new Set(['Closed Won', 'Closed Lost', 'Disqualified']);

/**
 * Aggregate an array of stage name strings (one per deal) into a TotalPipeline.
 * Includes all stages present in the input; respects canonical order,
 * appending unknown stages at the end.
 */
export function aggregateTotalPipeline(stages: string[]): TotalPipeline {
  // Count occurrences per stage
  const counts = new Map<string, number>();
  for (const s of stages) {
    const key = s.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Build by_stage in canonical order, then append unknowns
  const seen = new Set<string>();
  const by_stage: PipelineStageRow[] = [];

  for (const stage of CANONICAL_ORDER) {
    if (counts.has(stage)) {
      by_stage.push({ stage, count: counts.get(stage)! });
      seen.add(stage);
    }
  }
  // Append any stages not in the canonical list
  for (const [stage, count] of counts.entries()) {
    if (!seen.has(stage)) {
      by_stage.push({ stage, count });
    }
  }

  const total = stages.length;
  const open_active = by_stage
    .filter((r) => !TERMINAL_STAGES.has(r.stage))
    .reduce((sum, r) => sum + r.count, 0);
  const closed_won = counts.get(CLOSED_WON_STAGE) ?? 0;
  const closed_lost_dq = [...CLOSED_LOST_DQ_STAGES].reduce(
    (sum, s) => sum + (counts.get(s) ?? 0),
    0,
  );
  const denom = closed_won + closed_lost_dq;
  const close_rate = denom > 0 ? closed_won / denom : 0;

  return { by_stage, total, open_active, closed_won, closed_lost_dq, close_rate };
}
