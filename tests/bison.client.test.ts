// tests/bison.client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { fetchAllCampaigns } from '../scripts/bison/client';

describe('fetchAllCampaigns', () => {
  it('paginates until meta.last_page', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `camp${i + 1}` }));
    const page2 = Array.from({ length: 3 }, (_, i) => ({ id: 101 + i, name: `camp${101 + i}` }));

    const fakeFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: page1, meta: { current_page: 1, last_page: 2 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: page2, meta: { current_page: 2, last_page: 2 } }),
      });

    const campaigns = await fetchAllCampaigns('test-key', 'ws-1', { fetchImpl: fakeFetch as any });
    expect(campaigns).toHaveLength(103);
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });

  it('sends Authorization header and workspace_id param on every request', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], meta: { current_page: 1, last_page: 1 } }),
    });

    await fetchAllCampaigns('my-api-key', 'my-workspace', { fetchImpl: fakeFetch as any });

    expect(fakeFetch).toHaveBeenCalledOnce();
    const [url, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('workspace_id=my-workspace');
    expect(url).toContain('/campaigns');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-api-key');
  });

  it('uses BISON_BASE_URL override when set', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], meta: { current_page: 1, last_page: 1 } }),
    });

    const origUrl = process.env.BISON_BASE_URL;
    process.env.BISON_BASE_URL = 'https://test.example.com/api';
    try {
      await fetchAllCampaigns('key', 'ws', { fetchImpl: fakeFetch as any });
      const [url] = fakeFetch.mock.calls[0] as [string];
      expect(url).toContain('https://test.example.com/api');
    } finally {
      if (origUrl === undefined) delete process.env.BISON_BASE_URL;
      else process.env.BISON_BASE_URL = origUrl;
    }
  });

  it('throws on non-OK response including status code', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'forbidden',
    });

    await expect(fetchAllCampaigns('bad-key', 'ws', { fetchImpl: fakeFetch as any })).rejects.toThrow(/403/);
  });

  it('stops after a single page when last_page is 1', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 1 }], meta: { current_page: 1, last_page: 1 } }),
    });

    const result = await fetchAllCampaigns('key', 'ws', { fetchImpl: fakeFetch as any });
    expect(result).toHaveLength(1);
    expect(fakeFetch).toHaveBeenCalledOnce();
  });
});