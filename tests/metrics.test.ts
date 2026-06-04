import { describe, it, expect } from 'vitest';
import { dedupLeads, isJunkEmail, type RawLead, toChannel, classifyMql, classifySql, type RawDeal, aggregateMonthly, gadsLeadsFromLp } from '../scripts/compute/metrics';
import type { MonthlyCost } from '../scripts/compute/types';

describe('isJunkEmail', () => {
  it('returns true for +test addresses', () => {
    expect(isJunkEmail('alice+test@gmail.com')).toBe(true);
  });
  it('returns true for example.com', () => {
    expect(isJunkEmail('foo@example.com')).toBe(true);
  });
  it('returns true for internal kasandz.com', () => {
    expect(isJunkEmail('k@kasandz.com')).toBe(true);
  });
  it('returns true for internal thecpgaffiliate.com', () => {
    expect(isJunkEmail('k@thecpgaffiliate.com')).toBe(true);
  });
  it('returns false for legit external addresses', () => {
    expect(isJunkEmail('buyer@acme.io')).toBe(false);
  });
  it('treats empty/null as junk', () => {
    expect(isJunkEmail('')).toBe(true);
    expect(isJunkEmail(null)).toBe(true);
  });
});

describe('dedupLeads', () => {
  it('first-touch wins by created_at', () => {
    const leads: RawLead[] = [
      { email: 'a@acme.io', created_at: '2026-04-10', lead_source: 'bison_cold', stage: 'New', id: '1' },
      { email: 'a@acme.io', created_at: '2026-04-01', lead_source: 'gads_lp', stage: 'New', id: '2' },
    ];
    const out = dedupLeads(leads);
    expect(out).toHaveLength(1);
    expect(out[0].lead_source).toBe('gads_lp');
    expect(out[0].id).toBe('2');
  });
  it('case-insensitive email match', () => {
    const leads: RawLead[] = [
      { email: 'A@Acme.io', created_at: '2026-04-10', lead_source: 'bison_cold', stage: 'New', id: '1' },
      { email: 'a@acme.io', created_at: '2026-04-01', lead_source: 'gads_lp', stage: 'New', id: '2' },
    ];
    expect(dedupLeads(leads)).toHaveLength(1);
  });
  it('filters junk before dedup', () => {
    const leads: RawLead[] = [
      { email: 'k@kasandz.com', created_at: '2026-04-01', lead_source: 'gads_lp', stage: 'New', id: '1' },
      { email: 'real@acme.io', created_at: '2026-04-02', lead_source: 'gads_lp', stage: 'New', id: '2' },
    ];
    const out = dedupLeads(leads);
    expect(out).toHaveLength(1);
    expect(out[0].email).toBe('real@acme.io');
  });
});

describe('toChannel', () => {
  it('maps gads variations', () => {
    expect(toChannel('gads_lp')).toBe('gads_lp');
    expect(toChannel('Gads')).toBe('gads_lp');
    expect(toChannel('Google Ads')).toBe('gads_lp');
    expect(toChannel('googleads')).toBe('gads_lp');
  });
  it('maps bison variations', () => {
    expect(toChannel('bison_cold')).toBe('bison_cold');
    expect(toChannel('Bison')).toBe('bison_cold');
    expect(toChannel('Instantly')).toBe('bison_cold');
    expect(toChannel('cold email')).toBe('bison_cold');
  });
  it('maps anything else to other', () => {
    expect(toChannel('organic')).toBe('other');
    expect(toChannel('Direct')).toBe('other');
    expect(toChannel('Manual')).toBe('other');
    expect(toChannel('')).toBe('other');
    expect(toChannel(null)).toBe('other');
  });
});

describe('classifyMql', () => {
  it('returns true for Booked Call stage', () => {
    expect(classifyMql('Booked Call')).toBe(true);
  });
  it('returns false for upstream stages', () => {
    expect(classifyMql('New')).toBe(false);
    expect(classifyMql('In Conversation')).toBe(false);
  });
  it('returns true for downstream Promoted (already passed MQL gate)', () => {
    expect(classifyMql('Promoted')).toBe(true);
  });
  it('returns false for Disqualified', () => {
    expect(classifyMql('Disqualified')).toBe(false);
  });
});

describe('classifySql', () => {
  it('returns true for Proposal Sent', () => {
    expect(classifySql('Proposal Sent')).toBe(true);
  });
  it('returns true for Negotiating', () => {
    expect(classifySql('Negotiating')).toBe(true);
  });
  it('returns true for Closed Won', () => {
    expect(classifySql('Closed Won')).toBe(true);
  });
  it('returns false for upstream deal stages', () => {
    expect(classifySql('Discovery Call Done')).toBe(false);
    expect(classifySql('Following Up')).toBe(false);
    expect(classifySql('Follow Up Call Done')).toBe(false);
  });
  it('returns false for terminal failure stages', () => {
    expect(classifySql('Closed Lost')).toBe(false);
    expect(classifySql('Gone Cold')).toBe(false);
    expect(classifySql('Disqualified')).toBe(false);
  });
});

describe('aggregateMonthly', () => {
  const costs: MonthlyCost[] = [
    { month: '2026-04', channel: 'gads_lp', media: 5000, tooling: 0, agency: 0 },
    { month: '2026-04', channel: 'bison_cold', media: 5000, tooling: 0, agency: 0 },
  ];
  const leads: RawLead[] = [
    { id: '1', email: 'a@x.io', created_at: '2026-04-01', lead_source: 'gads_lp', stage: 'Booked Call' },
    { id: '2', email: 'b@x.io', created_at: '2026-04-05', lead_source: 'gads_lp', stage: 'New' },
    { id: '3', email: 'c@x.io', created_at: '2026-04-10', lead_source: 'bison_cold', stage: 'Booked Call' },
    { id: '4', email: 'd@x.io', created_at: '2026-04-11', lead_source: 'bison_cold', stage: 'Disqualified' },
  ];
  const deals: RawDeal[] = [
    { id: 'd1', associated_company: 'c1', associated_lead_email: 'a@x.io', stage: 'Proposal Sent', stage_updated_at: '2026-04-20', created_at: '2026-04-15', value: 10000 },
  ];

  it('computes 4 leads, 2 MQL, 1 SQL for April', () => {
    const rows = aggregateMonthly(leads, deals, costs);
    const apr = rows.find((r) => r.month === '2026-04');
    expect(apr).toBeDefined();
    expect(apr!.total_leads).toBe(4);
    expect(apr!.mql).toBe(2);
    expect(apr!.sql).toBe(1);
  });

  it('computes CPL = total_spend / total_leads', () => {
    const rows = aggregateMonthly(leads, deals, costs);
    const apr = rows.find((r) => r.month === '2026-04')!;
    expect(apr.spend_total).toBe(10000);
    expect(apr.cpl).toBe(2500); // 10000 / 4
  });

  it('CPL is null when monthly_costs missing the month', () => {
    const rows = aggregateMonthly(leads, deals, []);
    const apr = rows.find((r) => r.month === '2026-04')!;
    expect(apr.cpl).toBe(null);
  });

  it('groups leads_by_source correctly', () => {
    const rows = aggregateMonthly(leads, deals, costs);
    const apr = rows.find((r) => r.month === '2026-04')!;
    expect(apr.leads_by_source.gads_lp).toBe(2);
    expect(apr.leads_by_source.bison_cold).toBe(2);
    expect(apr.leads_by_source.other).toBe(0);
  });
});

describe('gadsLeadsFromLp', () => {
  type Row = { email: string; submitted_at: { value: string } | string; source: string; gclid: string | null };
  const row = (o: Partial<Row> & { email: string }): Row => ({
    submitted_at: '2026-05-15T00:00:00Z',
    source: 'Direct',
    gclid: null,
    ...o,
  });

  it('keeps rows with source=Google Ads or a gclid; drops the rest', () => {
    const out = gadsLeadsFromLp([
      row({ email: 'ga@acme.io', source: 'Google Ads' }),
      row({ email: 'click@acme.io', source: 'Direct', gclid: 'Cj0abc' }),
      row({ email: 'organic@acme.io', source: 'Direct', gclid: null }),
    ]);
    expect(out.emails.has('ga@acme.io')).toBe(true);
    expect(out.emails.has('click@acme.io')).toBe(true);
    expect(out.emails.has('organic@acme.io')).toBe(false);
    expect(out.total).toBe(2);
  });

  it('excludes internal test/QA fills, keeps the one real external lead', () => {
    const out = gadsLeadsFromLp([
      row({ email: 'lp-attio-test-1@kasandz.com', source: 'Google Ads', gclid: 'x' }),
      row({ email: 'team+ecom@kasandz.com', source: 'Google Ads' }),
      row({ email: 'leoandre50+full-payload-test@gmail.com', source: 'Google Ads', gclid: 'x' }),
      row({ email: 'qa-deploy-smoke@kamg-deploytest.com', source: 'Google Ads', gclid: 'x' }),
      row({ email: 'qa-optionals-smoke@kamg-optionals-test.com', source: 'Google Ads', gclid: 'x' }),
      row({ email: 'chiefjones@safesecureworldwide.com', source: 'Google Ads', gclid: 'Cj0real' }),
    ]);
    expect(out.total).toBe(1);
    expect([...out.emails]).toEqual(['chiefjones@safesecureworldwide.com']);
  });

  it('dedups by email and buckets in the first-touch month', () => {
    const out = gadsLeadsFromLp([
      row({ email: 'repeat@acme.io', source: 'Google Ads', submitted_at: { value: '2026-06-02T10:00:00Z' } }),
      row({ email: 'repeat@acme.io', source: 'Google Ads', submitted_at: { value: '2026-05-20T10:00:00Z' } }),
    ]);
    expect(out.total).toBe(1);
    expect(out.byMonth['2026-05']).toBe(1);
    expect(out.byMonth['2026-06']).toBeUndefined();
  });

  it('byMonth sums to total', () => {
    const out = gadsLeadsFromLp([
      row({ email: 'a@acme.io', source: 'Google Ads', submitted_at: '2026-05-01T00:00:00Z' }),
      row({ email: 'b@acme.io', source: 'Google Ads', submitted_at: '2026-06-01T00:00:00Z' }),
    ]);
    const sum = Object.values(out.byMonth).reduce((s, n) => s + n, 0);
    expect(sum).toBe(out.total);
  });
});