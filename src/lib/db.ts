import { DataAPIClient } from "@datastax/astra-db-ts";

const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN!);
const db = client.db(process.env.ASTRA_DB_ENDPOINT!);
const collection = db.collection('f1gpt');

export async function createCollection() {
  try {
    const res = await db.createCollection("f1gpt", {
      vector: { dimension: 1536, metric: "dot_product" }
    });
    return res;
  } catch (e: any) {
    // Collection already exists — ignore
    if (e?.message?.includes('already exists')) return null;
    throw e;
  }
}

export async function uploadData(data: { $vector: number[], text: string, source?: string }[]) {
  return await collection.insertMany(data as any);
}

export async function queryDatabase(query: number[]) {
  const res = await collection.find(null, {
    sort: { $vector: query },
    limit: 10
  }).toArray();
  return res;
}
