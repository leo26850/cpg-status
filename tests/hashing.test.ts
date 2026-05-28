// tests/hashing.test.ts
import { describe, it, expect } from 'vitest';
import { hashEmail } from '../scripts/render/hashing';

describe('hashEmail', () => {
  it('is deterministic for the same input', () => {
    expect(hashEmail('alice@acme.io')).toBe(hashEmail('alice@acme.io'));
  });
  it('changes when input changes', () => {
    expect(hashEmail('alice@acme.io')).not.toBe(hashEmail('bob@acme.io'));
  });
  it('is case-insensitive', () => {
    expect(hashEmail('Alice@Acme.io')).toBe(hashEmail('alice@acme.io'));
  });
  it('format is 8-char hash + dash + last 4 chars of local-part', () => {
    const h = hashEmail('alice@acme.io');
    expect(h).toMatch(/^[a-f0-9]{8}-[a-z0-9]{1,4}$/);
    expect(h.endsWith('-lice')).toBe(true);
  });
  it('handles short local-parts', () => {
    expect(hashEmail('ab@acme.io')).toMatch(/-ab$/);
  });
  it('returns "no-email" for empty/null', () => {
    expect(hashEmail(null)).toBe('no-email');
    expect(hashEmail('')).toBe('no-email');
  });
});