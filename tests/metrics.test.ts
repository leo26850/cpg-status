import { describe, it, expect } from 'vitest';
import { dedupLeads, isJunkEmail, type RawLead } from '../scripts/compute/metrics';

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