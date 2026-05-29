// scripts/bison/client.ts
const DEFAULT_BASE = 'https://bison.chaptersagency.com/api';

export type BisonCampaign = {
  id: number;
  uuid: string;
  name: string;
  status: string;
  type: string;
  sequence_id: number;
  completion_percentage: number;
  emails_sent: number;
  opened: number;
  unique_opens: number;
  replied: number;
  unique_replies: number;
  bounced: number;
  unsubscribed: number;
  interested: number;
  total_leads: number;
  total_leads_contacted: number;
  created_at: string;
  updated_at: string;
};

type FetchImpl = typeof fetch;

export async function fetchAllCampaigns(
  apiKey: string,
  workspaceId: string,
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<BisonCampaign[]> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const base = process.env.BISON_BASE_URL ?? DEFAULT_BASE;
  const all: BisonCampaign[] = [];
  let page = 1;

  while (true) {
    const url = `${base}/campaigns?workspace_id=${encodeURIComponent(workspaceId)}&per_page=100&page=${page}`;
    const resp = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Bison API ${resp.status}: ${body.slice(0, 200)}`);
    }
    const payload = (await resp.json()) as { data: BisonCampaign[]; meta: { current_page: number; last_page: number } };
    all.push(...payload.data);
    if (page >= payload.meta.last_page) break;
    page++;
  }

  return all;
}