// scripts/sink-report.ts
//
// Manually push the latest data/report.json into BigQuery (cpg_marts.*) without
// running the full Attio/Bison build. Useful for backfills or after a schema
// change to the sink. The scheduled build already calls sinkReportToBQ itself.
//
// Auth: set GOOGLE_ACCESS_TOKEN=$(gcloud auth print-access-token) to bypass the
// ADC refresh issue (same pattern as build-report.ts createBqClient).
//
//   GOOGLE_ACCESS_TOKEN=$(gcloud auth print-access-token) npx tsx scripts/sink-report.ts
import { BigQuery } from '@google-cloud/bigquery';
import { OAuth2Client } from 'google-auth-library';
import { readFileSync } from 'node:fs';
import type { ReportData } from './compute/types.js';
import { sinkReportToBQ } from './sink-to-bq.js';

const PROJECT = 'cpg-data-warehouse';

function createBqClient(): BigQuery {
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (token) {
    const authClient = new OAuth2Client();
    authClient.setCredentials({ access_token: token });
    return new BigQuery({ projectId: PROJECT, authClient } as ConstructorParameters<typeof BigQuery>[0]);
  }
  return new BigQuery({ projectId: PROJECT });
}

const report = JSON.parse(readFileSync('data/report.json', 'utf-8')) as ReportData;
const today = new Date().toISOString().slice(0, 10);
await sinkReportToBQ(createBqClient(), report, today);
console.log(`Sunk data/report.json → cpg_marts.* (snapshot_date ${today})`);