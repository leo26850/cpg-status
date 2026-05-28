// tests/attio.client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { fetchAllRecords } from '../scripts/attio/client';

describe('fetchAllRecords', () => {
  it('paginates until the API returns fewer than limit rows', async () => {
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: Array.from({ length: 500 }, (_, i) => ({ id: { record_id: `r${i}` } })) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: Array.from({ length: 17 }, (_, i) => ({ id: { record_id: `r${500 + i}` } })) }),
      });

    const records = await fetchAllRecords('leads', 'fake-key', { fetchImpl: fakeFetch as any });
    expect(records).toHaveLength(517);
    expect(fakeFetch).toHaveBeenCalledTimes(2);
    const firstCall = fakeFetch.mock.calls[0];
    expect(firstCall[0]).toBe('https://api.attio.com/v2/objects/leads/records/query');
    const firstBody = JSON.parse(firstCall[1].body);
    expect(firstBody.offset).toBe(0);
    expect(firstBody.limit).toBe(500);
  });

  it('throws on non-OK response', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' });
    await expect(fetchAllRecords('leads', 'fake', { fetchImpl: fakeFetch as any })).rejects.toThrow(/401/);
  });
});