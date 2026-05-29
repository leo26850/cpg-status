// tests/outreach.test.ts
import { describe, it, expect } from 'vitest';
import { aggregateOutreach } from '../scripts/compute/outreach';
import type { BisonCampaign } from '../scripts/bison/client';

const fixture: BisonCampaign[] = [
  {
    id: 1,
    uuid: 'uuid-1',
    name: 'Amazon Outreach May',
    status: 'active',
    type: 'email',
    sequence_id: 10,
    completion_percentage: 80,
    emails_sent: 1000,
    opened: 0,
    unique_opens: 0,
    replied: 40,
    unique_replies: 38,
    bounced: 20,
    unsubscribed: 5,
    interested: 8,
    total_leads: 1200,
    total_leads_contacted: 950,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-28T00:00:00Z',
  },
  {
    id: 2,
    uuid: 'uuid-2',
    name: 'Shopify Brands Q2',
    status: 'active',
    type: 'email',
    sequence_id: 11,
    completion_percentage: 45,
    emails_sent: 500,
    opened: 0,
    unique_opens: 0,
    replied: 15,
    unique_replies: 14,
    bounced: 8,
    unsubscribed: 2,
    interested: 3,
    total_leads: 600,
    total_leads_contacted: 480,
    created_at: '2026-05-10T00:00:00Z',
    updated_at: '2026-05-28T00:00:00Z',
  },
  {
    id: 3,
    uuid: 'uuid-3',
    name: 'Old Campaign Paused',
    status: 'paused',
    type: 'email',
    sequence_id: 9,
    completion_percentage: 100,
    emails_sent: 300,
    opened: 0,
    unique_opens: 0,
    replied: 10,
    unique_replies: 10,
    bounced: 5,
    unsubscribed: 1,
    interested: 2,
    total_leads: 310,
    total_leads_contacted: 300,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-30T00:00:00Z',
  },
];

describe('aggregateOutreach', () => {
  it('sums totals across all campaigns', () => {
    const result = aggregateOutreach(fixture);
    expect(result.emails_sent).toBe(1800);      // 1000 + 500 + 300
    expect(result.total_leads_contacted).toBe(1730); // 950 + 480 + 300
    expect(result.replied).toBe(65);            // 40 + 15 + 10
    expect(result.interested).toBe(13);         // 8 + 3 + 2
    expect(result.bounced).toBe(33);            // 20 + 8 + 5
    expect(result.unsubscribed).toBe(8);        // 5 + 2 + 1
    expect(result.campaign_count).toBe(3);
  });

  it('counts only active campaigns for active_campaigns', () => {
    const result = aggregateOutreach(fixture);
    expect(result.active_campaigns).toBe(2); // only the two 'active' ones
  });

  it('computes reply_rate as replied / total_leads_contacted', () => {
    const result = aggregateOutreach(fixture);
    // 65 / 1730
    expect(result.reply_rate).toBeCloseTo(65 / 1730, 6);
  });

  it('computes positive_reply_rate as interested / replied', () => {
    const result = aggregateOutreach(fixture);
    // 13 / 65
    expect(result.positive_reply_rate).toBeCloseTo(13 / 65, 6);
  });

  it('computes bounce_rate as bounced / emails_sent', () => {
    const result = aggregateOutreach(fixture);
    // 33 / 1800
    expect(result.bounce_rate).toBeCloseTo(33 / 1800, 6);
  });

  it('returns null for rates when denominator is 0', () => {
    const zeroCampaign: BisonCampaign[] = [
      {
        id: 99, uuid: 'x', name: 'Empty', status: 'active', type: 'email',
        sequence_id: 1, completion_percentage: 0,
        emails_sent: 0, opened: 0, unique_opens: 0,
        replied: 0, unique_replies: 0, bounced: 0,
        unsubscribed: 0, interested: 0,
        total_leads: 0, total_leads_contacted: 0,
        created_at: '', updated_at: '',
      },
    ];
    const result = aggregateOutreach(zeroCampaign);
    expect(result.reply_rate).toBeNull();
    expect(result.positive_reply_rate).toBeNull();
    expect(result.bounce_rate).toBeNull();
  });

  it('returns per-campaign rows sorted by emails_sent descending', () => {
    const result = aggregateOutreach(fixture);
    expect(result.campaigns).toHaveLength(3);
    // Sorted: 1000, 500, 300
    expect(result.campaigns[0].emails_sent).toBe(1000);
    expect(result.campaigns[1].emails_sent).toBe(500);
    expect(result.campaigns[2].emails_sent).toBe(300);
  });

  it('per-campaign rows include reply_rate computed per-campaign', () => {
    const result = aggregateOutreach(fixture);
    const first = result.campaigns[0];
    // Amazon Outreach: 40 / 950
    expect(first.reply_rate).toBeCloseTo(40 / 950, 6);
    expect(first.name).toBe('Amazon Outreach May');
  });

  it('per-campaign reply_rate is null when total_leads_contacted is 0', () => {
    const zeroContacted: BisonCampaign[] = [
      {
        id: 10, uuid: 'z', name: 'Zero', status: 'active', type: 'email',
        sequence_id: 5, completion_percentage: 0,
        emails_sent: 100, opened: 0, unique_opens: 0,
        replied: 5, unique_replies: 5, bounced: 2,
        unsubscribed: 0, interested: 1,
        total_leads: 50, total_leads_contacted: 0,
        created_at: '', updated_at: '',
      },
    ];
    const result = aggregateOutreach(zeroContacted);
    expect(result.campaigns[0].reply_rate).toBeNull();
  });

  it('handles empty campaign list without throwing', () => {
    const result = aggregateOutreach([]);
    expect(result.emails_sent).toBe(0);
    expect(result.reply_rate).toBeNull();
    expect(result.campaigns).toHaveLength(0);
  });
});