/// <reference types="node" />
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Pool, PoolClient } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set. Please add it to server/.env');
  process.exit(1);
}

// Allow relaxed TLS only when NODE_TLS_REJECT_UNAUTHORIZED=0
const ssl =
  process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
    ? { rejectUnauthorized: false }
    : undefined;

const pool = new Pool({ connectionString, ssl });

type BomEntry = {
  category?: string;
  lines: Array<{
    component: string;
    qty: number;
    sourceType?: 'ITEM' | 'BAHAN_BAKU';
  }>;
};

type BomMap = Record<string, BomEntry>;

function loadBom(): BomMap {
  const bomPath = path.resolve(process.cwd(), '../client/src/data/bom.json');
  const raw = fs.readFileSync(bomPath, 'utf-8');
  return JSON.parse(raw);
}

function normalize(text: string | null | undefined) {
  return (text ?? '')
    .toLowerCase()
    .replace(/[`"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadProducts(client: PoolClient) {
  const res = await client.query('SELECT code, name FROM "Product"');
  const byName = new Map<string, { code: string; name: string }>();
  const byCode = new Map<string, { code: string; name: string }>();
  res.rows.forEach((row: { code: string; name: string }) => {
    byName.set(normalize(row.name), { code: row.code, name: row.name });
    byCode.set(normalize(row.code), { code: row.code, name: row.name });
  });
  return { byName, byCode };
}
async function loadItems(client: PoolClient) {
  const res = await client.query('SELECT code, name FROM "Item"');
  const byName = new Map<string, { code: string; name: string }>();
  const byCode = new Map<string, { code: string; name: string }>();
  res.rows.forEach((row: { code: string; name: string }) => {
    byName.set(normalize(row.name), { code: row.code, name: row.name });
    byCode.set(normalize(row.code), { code: row.code, name: row.name });
  });
  return { byName, byCode };
}

async function loadRawMaterials(client: PoolClient) {
  const res = await client.query('SELECT code, name FROM "BahanBaku"');
  const byName = new Map<string, { code: string; name: string }>();
  const byCode = new Map<string, { code: string; name: string }>();
  res.rows.forEach((row: { code: string; name: string }) => {
    byName.set(normalize(row.name), { code: row.code, name: row.name });
    byCode.set(normalize(row.code), { code: row.code, name: row.name });
  });
  return { byName, byCode };
}

function matchComponent(
  component: string,
  items: { byName: Map<string, { code: string; name: string }>; byCode: Map<string, { code: string; name: string }> },
  raws: { byName: Map<string, { code: string; name: string }>; byCode: Map<string, { code: string; name: string }> },
) {
  const norm = normalize(component);
  if (!norm) return null;

  // Prefer exact code match item
  const itemByCode = items.byCode.get(norm);
  if (itemByCode) return { sourceType: 'ITEM' as const, code: itemByCode.code, name: itemByCode.name };

  // Exact name match item
  const itemByName = items.byName.get(norm);
  if (itemByName) return { sourceType: 'ITEM' as const, code: itemByName.code, name: itemByName.name };

  // Exact code match raw
  const rawByCode = raws.byCode.get(norm);
  if (rawByCode) return { sourceType: 'BAHAN_BAKU' as const, code: rawByCode.code, name: rawByCode.name };

  // Exact name match raw
  const rawByName = raws.byName.get(norm);
  if (rawByName) return { sourceType: 'BAHAN_BAKU' as const, code: rawByName.code, name: rawByName.name };

  // Fallback: contains search on items first, then raw
  for (const [key, value] of items.byName.entries()) {
    if (key.includes(norm) || norm.includes(key))
      return { sourceType: 'ITEM' as const, code: value.code, name: value.name };
  }
  for (const [key, value] of raws.byName.entries()) {
    if (key.includes(norm) || norm.includes(key))
      return { sourceType: 'BAHAN_BAKU' as const, code: value.code, name: value.name };
  }

  return null;
}

function matchProduct(
  name: string,
  products: { byName: Map<string, { code: string; name: string }>; byCode: Map<string, { code: string; name: string }> },
) {
  const norm = normalize(name);
  if (!norm) return null;
  const byName = products.byName.get(norm);
  if (byName) return byName;
  const byCode = products.byCode.get(norm);
  if (byCode) return byCode;

  for (const [key, value] of products.byName.entries()) {
    if (key.includes(norm) || norm.includes(key)) return value;
  }
  for (const [key, value] of products.byCode.entries()) {
    if (key.includes(norm) || norm.includes(key)) return value;
  }

  return null;
}

async function main() {
  const bom = loadBom();

  const client = await pool.connect();
  const products = await loadProducts(client);
  const items = await loadItems(client);
  const raws = await loadRawMaterials(client);
  const rows = Object.entries(bom).map(([name, entry]) => {
    const match = matchProduct(name, products);
    return {
      productCode: match?.code ?? name,
      productName: match?.name ?? name,
      category: entry.category ?? 'Produk',
      lines: entry.lines ?? [],
    };
  });

  console.log(`Preparing to upsert ${rows.length} BOM headers...`);

  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE "BomLine", "Bom" RESTART IDENTITY');

    let skippedLines = 0;
    const skippedSamples: Array<{ product: string; component: string }> = [];

    for (const row of rows) {
      const bomRes = await client.query(
        `INSERT INTO "Bom" ("id", "productCode", "productName", "category")
         VALUES (gen_random_uuid(), $1, $2, $3)
         ON CONFLICT ("productCode") DO UPDATE SET
           "productName" = EXCLUDED."productName",
           "category" = EXCLUDED."category"
         RETURNING "id"`,
        [row.productCode, row.productName, row.category],
      );
      const bomId = bomRes.rows[0].id as string;

      if (row.lines.length) {
        const params: string[] = [];
        const values: Array<string | number | null> = [];
        row.lines.forEach((line) => {
          const match = matchComponent(line.component, items, raws);
          if (!match) {
            skippedLines += 1;
            if (skippedSamples.length < 20) {
              skippedSamples.push({ product: row.productName ?? row.productCode, component: line.component });
            }
            return;
          }
          const base = params.length * 5;
          params.push(
            `(gen_random_uuid(), $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`,
          );
          values.push(
            bomId,
            match.sourceType,
            match.code,
            match.name ?? line.component,
            Number.isFinite(line.qty) ? line.qty : 1,
          );
        });

        const sql = `
          INSERT INTO "BomLine" ("id", "bomId", "sourceType", "code", "name", "qty")
          VALUES ${params.join(',')};
        `;
        if (params.length) {
          await client.query(sql, values);
        }
      }
    }

    await client.query('COMMIT');
    console.log('BOM import completed.');
    if (skippedLines) {
      console.warn(`Skipped ${skippedLines} BOM lines not found in Item/BahanBaku tables.`);
      skippedSamples.forEach((sample) => {
        console.warn(`- ${sample.product}: ${sample.component}`);
      });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to import BOM', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
