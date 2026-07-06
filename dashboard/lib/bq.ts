import { BigQuery } from "@google-cloud/bigquery";

export const DATASET = "civic_pulse";
export const CATEGORIES = [
  "pothole", "garbage", "streetlight", "water_supply",
  "drainage", "traffic", "stray_animals", "noise", "other",
] as const;

let client: BigQuery | null = null;

/**
 * BigQuery client. Auth order:
 * 1. GCP_SA_KEY_BASE64 — base64-encoded service-account JSON (Render).
 * 2. Application Default Credentials — `gcloud auth application-default login` (local dev).
 */
export function bq(): BigQuery {
  if (client) return client;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT env var is not set");
  }

  const b64 = process.env.GCP_SA_KEY_BASE64;
  if (b64) {
    let key: { client_email: string; private_key: string };
    try {
      key = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
    } catch {
      throw new Error("GCP_SA_KEY_BASE64 is not valid base64-encoded JSON");
    }
    client = new BigQuery({
      projectId,
      credentials: {
        client_email: key.client_email,
        private_key: key.private_key,
      },
    });
  } else {
    client = new BigQuery({ projectId });
  }
  return client;
}

export function table(name: string): string {
  return `\`${process.env.GOOGLE_CLOUD_PROJECT}.${DATASET}.${name}\``;
}

export async function query<T>(
  sql: string,
  params?: Record<string, string | number>,
): Promise<T[]> {
  const [rows] = await bq().query({ query: sql, params });
  return rows as T[];
}
