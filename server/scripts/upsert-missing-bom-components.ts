/// <reference types="node" />
import 'dotenv/config';
import crypto from 'node:crypto';
import { Pool } from 'pg';

type Source = 'ITEM' | 'BAHAN_BAKU';

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
    .replace(/(^-|-$)/g, '');
}

function generateCode(name: string) {
  const slug = slugify(name) || 'AUTO';
  const short = slug.slice(0, 18).toUpperCase();
  const hash = crypto
    .createHash('md5')
    .update(slug)
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();
  return `BB-AUTO-${short}-${hash}`;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = new Map<string, { code: string; source: Source }>();

    const items = await client.query('SELECT code, name FROM "Item"');
    items.rows.forEach((row: { code: string; name: string | null }) => {
      const key = normalize(row.name) || normalize(row.code);
      if (key) existing.set(key, { code: row.code, source: 'ITEM' });
    });

    const bahan = await client.query('SELECT code, name FROM "BahanBaku"');
    bahan.rows.forEach((row: { code: string; name: string | null }) => {
      const key = normalize(row.name) || normalize(row.code);
      if (key) existing.set(key, { code: row.code, source: 'BAHAN_BAKU' });
    });

    const missingRes = await client.query(
      `SELECT id, name FROM "BomLine" WHERE (code IS NULL OR code = '')`,
    );

    const assignments = new Map<string, { code: string; source: Source }>();
    const newMaterials: Array<{ code: string; name: string }> = [];

    for (const row of missingRes.rows as Array<{
      id: string;
      name: string | null;
    }>) {
      const norm = normalize(row.name);
      if (!norm) continue;

      const existingEntry = existing.get(norm);
      if (existingEntry) {
        assignments.set(norm, existingEntry);
        continue;
      }

      const current = assignments.get(norm);
      if (current) continue;

      const code = generateCode(row.name ?? '');
      const entry = { code, source: 'BAHAN_BAKU' as const };
      assignments.set(norm, entry);
      newMaterials.push({ code, name: row.name ?? code });
    }

    if (newMaterials.length) {
      const params: string[] = [];
      const values: Array<string | null | number> = [];
      newMaterials.forEach((mat, idx) => {
        const base = idx * 4;
        params.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
        values.push(mat.code, mat.name, 'AUTO', 0);
      });

      const sql = `
        INSERT INTO "BahanBaku" ("code", "name", "category", "stock")
        VALUES ${params.join(',')}
        ON CONFLICT ("code") DO NOTHING
      `;
      await client.query(sql, values);
    }

    if (missingRes.rowCount) {
      const updates: Array<{ id: string; code: string; source: Source }> = [];

      for (const row of missingRes.rows as Array<{
        id: string;
        name: string | null;
      }>) {
        const norm = normalize(row.name);
        if (!norm) continue;
        const assignment = assignments.get(norm) || existing.get(norm);
        if (!assignment) continue;
        updates.push({
          id: row.id,
          code: assignment.code,
          source: assignment.source,
        });
      }

      if (updates.length) {
        const params: string[] = [];
        const values: Array<string> = [];
        updates.forEach((u, idx) => {
          const base = idx * 3;
          params.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
          values.push(u.id, u.code, u.source);
        });

        const sql = `
          UPDATE "BomLine" AS bl
          SET code = data.code, "sourceType" = data.source::"BomSourceType"
          FROM (VALUES ${params.join(',')}) AS data(id, code, source)
          WHERE bl.id = data.id
        `;
        await client.query(sql, values);
      }
    }

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          insertedToBahanBaku: newMaterials.length,
          updatedBomLines: missingRes.rowCount ?? 0,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to upsert missing components', err);
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
