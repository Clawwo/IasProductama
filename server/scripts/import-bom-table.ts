/// <reference types="node" />
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Pool, PoolClient } from 'pg';
import { inventoryItems } from '../../client/src/components/inventory/items';

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

const inventoryByName = new Map(
  inventoryItems.map((it) => [
    normalize(it.name),
    { code: it.code, name: it.name },
  ]),
);

async function loadProducts(client: PoolClient) {
  const res = await client.query('SELECT code, name FROM "Product"');
  const map = new Map<string, { code: string; name: string }>();
  res.rows.forEach((row: { code: string; name: string }) => {
    map.set(normalize(row.name), { code: row.code, name: row.name });
  });
  return map;
}

function matchInventory(component: string) {
  const norm = normalize(component);
  if (!norm) return null;
  const exact = inventoryByName.get(norm);
  if (exact) return exact;
  // Try contains search if no exact match
  for (const [key, value] of inventoryByName.entries()) {
    if (key.includes(norm) || norm.includes(key)) return value;
  }
  return null;
}

async function main() {
  const bom = loadBom();

  const client = await pool.connect();
  const productMap = await loadProducts(client);

  const rows = Object.entries(bom).map(([name, entry]) => {
    const match = productMap.get(normalize(name));
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
        row.lines.forEach((line, idx) => {
          const base = idx * 5;
          params.push(
            `(gen_random_uuid(), $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`,
          );
          const match = matchInventory(line.component);
          values.push(
            bomId,
            match ? 'ITEM' : (line.sourceType ?? 'BAHAN_BAKU'),
            match?.code ?? null,
            match?.name ?? line.component,
            Number.isFinite(line.qty) ? line.qty : 1,
          );
        });

        const sql = `
          INSERT INTO "BomLine" ("id", "bomId", "sourceType", "code", "name", "qty")
          VALUES ${params.join(',')};
        `;
        await client.query(sql, values);
      }
    }

    await client.query('COMMIT');
    console.log('BOM import completed.');
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
