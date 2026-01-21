/// <reference types="node" />
import 'dotenv/config';
import crypto from 'node:crypto';
import { Pool, PoolClient } from 'pg';

type Source = 'ITEM' | 'BAHAN_BAKU';

type Material = { code: string; name: string };

type BomLine = {
  id: string;
  code: string | null;
  name: string | null;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set. Please add it to server/.env');
  process.exit(1);
}

const ssl =
  process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
    ? { rejectUnauthorized: false }
    : undefined;

const pool = new Pool({ connectionString, ssl });

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
    .trim();
}

function shortHash(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 6).toUpperCase();
}

async function loadItems(client: PoolClient) {
  const res = await client.query('SELECT code, name FROM "Item"');
  const byName = new Map<string, Material>();
  const byCode = new Map<string, Material>();
  res.rows.forEach((row: { code: string; name: string | null }) => {
    const nameKey = normalize(row.name);
    const codeKey = normalize(row.code);
    if (nameKey) byName.set(nameKey, { code: row.code, name: row.name ?? row.code });
    if (codeKey) byCode.set(codeKey, { code: row.code, name: row.name ?? row.code });
  });
  return { byName, byCode };
}

async function loadRaws(client: PoolClient) {
  const res = await client.query('SELECT code, name FROM "BahanBaku"');
  const byName = new Map<string, Material>();
  const byCode = new Map<string, Material>();
  res.rows.forEach((row: { code: string; name: string | null }) => {
    const nameKey = normalize(row.name);
    const codeKey = normalize(row.code);
    if (nameKey) byName.set(nameKey, { code: row.code, name: row.name ?? row.code });
    if (codeKey) byCode.set(codeKey, { code: row.code, name: row.name ?? row.code });
  });
  return { byName, byCode };
}

async function loadInvalidBomLines(client: PoolClient) {
  const res = await client.query<BomLine>(
    `SELECT bl.id, bl.code, bl.name
     FROM "BomLine" bl
     WHERE (bl.code IS NULL OR bl.code = '')
        OR (NOT EXISTS (SELECT 1 FROM "Item" i WHERE i.code = bl.code)
            AND NOT EXISTS (SELECT 1 FROM "BahanBaku" b WHERE b.code = bl.code))
    `,
  );
  return res.rows;
}

function ensureRaw(
  name: string,
  raws: { byName: Map<string, Material>; byCode: Map<string, Material> },
  pendingRaws: Map<string, Material>,
) {
  const norm = normalize(name);
  if (!norm) {
    const code = `BB-${shortHash('NONAME')}`;
    return { code, name: 'NONAME' } as Material;
  }

  const existing = raws.byName.get(norm) || raws.byCode.get(norm);
  if (existing) return existing;

  const pending = pendingRaws.get(norm);
  if (pending) return pending;

  const code = `BB-${slugify(name)}-${shortHash(name)}`.toUpperCase();
  const entry: Material = { code, name };
  pendingRaws.set(norm, entry);
  return entry;
}

async function insertPendingRaws(client: PoolClient, pendingRaws: Map<string, Material>) {
  if (!pendingRaws.size) return 0;

  const params: string[] = [];
  const values: string[] = [];
  let idx = 0;
  for (const { code, name } of pendingRaws.values()) {
    params.push(`($${idx + 1}, $${idx + 2})`);
    values.push(code, name);
    idx += 2;
  }

  const sql = `INSERT INTO "BahanBaku" ("code", "name") VALUES ${params.join(',')} ON CONFLICT ("code") DO NOTHING;`;
  await client.query(sql, values);
  return pendingRaws.size;
}

async function updateBomLines(
  client: PoolClient,
  updates: Array<{ id: string; code: string; source: Source }>,
) {
  if (!updates.length) return 0;

  const params: string[] = [];
  const values: string[] = [];
  updates.forEach((u, idx) => {
    const base = idx * 3;
    params.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
    values.push(u.id, u.code, u.source);
  });

  const sql = `
    UPDATE "BomLine" AS bl
    SET code = data.code, "sourceType" = data.source::"BomSourceType"
    FROM (VALUES ${params.join(',')}) AS data(id, code, source)
    WHERE bl.id = data.id;
  `;
  await client.query(sql, values);
  return updates.length;
}

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const items = await loadItems(client);
    const raws = await loadRaws(client);
    const pendingRaws = new Map<string, Material>();

    const invalidLines = await loadInvalidBomLines(client);
    const updates: Array<{ id: string; code: string; source: Source }> = [];

    let matchedItems = 0;
    let matchedRaws = 0;

    invalidLines.forEach((line) => {
      const normName = normalize(line.name);
      const normCode = normalize(line.code);

      const itemByCode = normCode ? items.byCode.get(normCode) : undefined;
      const itemByName = normName ? items.byName.get(normName) : undefined;
      const rawByCode = normCode ? raws.byCode.get(normCode) : undefined;
      const rawByName = normName ? raws.byName.get(normName) : undefined;

      if (itemByCode || itemByName) {
        const match = itemByCode || itemByName!;
        matchedItems += 1;
        updates.push({ id: line.id, code: match.code, source: 'ITEM' });
        return;
      }

      if (rawByCode || rawByName) {
        const match = rawByCode || rawByName!;
        matchedRaws += 1;
        updates.push({ id: line.id, code: match.code, source: 'BAHAN_BAKU' });
        return;
      }

      const raw = ensureRaw(line.name ?? line.code ?? 'NONAME', raws, pendingRaws);
      updates.push({ id: line.id, code: raw.code, source: 'BAHAN_BAKU' });
    });

    const insertedRaws = await insertPendingRaws(client, pendingRaws);
    const updatedLines = await updateBomLines(client, updates);

    await client.query('COMMIT');

    const sample = invalidLines.slice(0, 10).map((line) => ({
      id: line.id,
      name: line.name,
      prevCode: line.code,
    }));

    console.log(
      JSON.stringify(
        {
          scannedBomLines: invalidLines.length,
          updatedBomLines: updatedLines,
          matchedItems,
          matchedRaws,
          insertedToBahanBaku: insertedRaws,
          sample,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to fix BOM invalid codes', err);
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
