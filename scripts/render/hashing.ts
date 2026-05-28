// scripts/render/hashing.ts
import { createHash } from 'node:crypto';

export function hashEmail(email: string | null): string {
  if (!email || email.trim() === '') return 'no-email';
  const normalized = email.toLowerCase().trim();
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 8);
  const local = normalized.split('@')[0] ?? '';
  const tail = local.slice(-4);
  return `${hash}-${tail}`;
}