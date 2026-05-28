// scripts/attio/client.ts
const API_BASE = 'https://api.attio.com/v2';
const PAGE_SIZE = 500;

export type AttioRecord = {
  id: { record_id: string };
  values: Record<string, any[]>;
  created_at?: string;
};

type FetchImpl = typeof fetch;

export async function fetchAllRecords(
  objectSlug: string,
  apiKey: string,
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<AttioRecord[]> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const all: AttioRecord[] = [];
  let offset = 0;
  while (true) {
    const resp = await fetchImpl(`${API_BASE}/objects/${objectSlug}/records/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ limit: PAGE_SIZE, offset }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Attio API ${resp.status}: ${body.slice(0, 200)}`);
    }
    const { data } = (await resp.json()) as { data: AttioRecord[] };
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (offset > 50000) throw new Error('Attio pagination exceeded safety limit of 50000 records');
  }
  return all;
}

// Helper: extract single string value from Attio's typed-value envelope.
export function attioString(record: AttioRecord, attr: string): string | null {
  const v = record.values?.[attr]?.[0];
  if (!v) return null;
  return v.value ?? v.option?.title ?? null;
}

// Helper: extract single timestamp value.
export function attioTimestamp(record: AttioRecord, attr: string): string | null {
  const v = record.values?.[attr]?.[0];
  return v?.value ?? null;
}

// Helper: extract status/stage option title (e.g. "Booked Call").
export function attioStage(record: AttioRecord, attr: string): string | null {
  const v = record.values?.[attr]?.[0];
  return v?.status?.title ?? v?.option?.title ?? v?.value ?? null;
}