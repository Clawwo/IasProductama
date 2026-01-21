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

function slugify(text: string) {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .toUpperCase();
}

function shortHash(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 6).toUpperCase();
}

async function loadProducts(client: PoolClient) {
  const res = await client.query('SELECT code, name FROM "Product"');
  const map = new Map<string, { code: string; name: string }>();
  res.rows.forEach((row: { code: string; name: string }) => {
    map.set(normalize(row.name), { code: row.code, name: row.name });
  });
  return map;
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
  ensureRaw: (name: string) => { code: string; name: string },
) {
  const norm = normalize(component);
  if (!norm) {
    const raw = ensureRaw(component || 'NONAME');
    return { sourceType: 'BAHAN_BAKU' as const, code: raw.code, name: raw.name };
  }

  // Prefer exact code match item
  const itemByCode = items.byCode.get(norm);
  if (itemByCode) return { sourceType: 'ITEM' as const, code: itemByCode.code, name: itemByCode.name };

  // Exact name match item
  const itemByName = items.byName.get(norm);
  if (itemByName) return { sourceType: 'ITEM' as const, code: itemByName.code, name: itemByName.name };

  // Exact code match raw
  const rawByCode = raws.byCode.get(norm);
  if (rawByCode && !rawByCode.code.startsWith('BB-AUTO'))
    return { sourceType: 'BAHAN_BAKU' as const, code: rawByCode.code, name: rawByCode.name };

  // Exact name match raw
  const rawByName = raws.byName.get(norm);
  if (rawByName && !rawByName.code.startsWith('BB-AUTO'))
    return { sourceType: 'BAHAN_BAKU' as const, code: rawByName.code, name: rawByName.name };

  // Fallback: contains search on items first, then raw
  for (const [key, value] of items.byName.entries()) {
    if (key.includes(norm) || norm.includes(key))
      return { sourceType: 'ITEM' as const, code: value.code, name: value.name };
  }
  for (const [key, value] of raws.byName.entries()) {
    if ((key.includes(norm) || norm.includes(key)) && !value.code.startsWith('BB-AUTO'))
      return { sourceType: 'BAHAN_BAKU' as const, code: value.code, name: value.name };
  }

  const raw = ensureRaw(component);
  return { sourceType: 'BAHAN_BAKU' as const, code: raw.code, name: raw.name };
}

async function main() {
  const bom = loadBom();

  const client = await pool.connect();
  await client.query('DELETE FROM "BahanBaku" WHERE "code" LIKE $1', ['BB-AUTO-%']);
  const productMap = await loadProducts(client);
  const items = await loadItems(client);
  const raws = await loadRawMaterials(client);
  const pendingRaws = new Map<string, { code: string; name: string }>();

  const ensureRaw = (name: string) => {
    const norm = normalize(name);
    if (!norm) {
      const code = `BB-${shortHash('NONAME')}`;
      return { code, name: 'NONAME' };
    }
    const existing = raws.byName.get(norm) || raws.byCode.get(norm);
    if (existing) return existing;

    const pending = pendingRaws.get(norm);
    if (pending) return pending;

    const code = `BB-${slugify(name)}-${shortHash(name)}`;
    const entry = { code, name };
    pendingRaws.set(norm, entry);
    return entry;
  };

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
    if (pendingRaws.size) {
      const params: string[] = [];
      const values: Array<string> = [];
      let idx = 0;
      for (const { code, name } of pendingRaws.values()) {
        params.push(`($${idx + 1}, $${idx + 2})`);
        values.push(code, name);
        idx += 2;
      }
      const insertSql = `INSERT INTO "BahanBaku" ("code", "name") VALUES ${params.join(',')} ON CONFLICT ("code") DO NOTHING;`;
      await client.query(insertSql, values);
      // refresh raws cache for lookups after insert
      const updatedRaws = await loadRawMaterials(client);
      raws.byName = updatedRaws.byName;
      raws.byCode = updatedRaws.byCode;
    }
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
          const match = matchComponent(line.component, items, raws, ensureRaw);
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
