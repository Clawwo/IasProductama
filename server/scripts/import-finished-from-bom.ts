/// <reference types="node" />
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

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
  lines: Array<{ component: string; qty: number }>;
};

function loadBom(): Record<string, BomEntry> {
  const bomPath = path.resolve(process.cwd(), '../client/src/data/bom.json');
  const raw = fs.readFileSync(bomPath, 'utf-8');
  return JSON.parse(raw);
}

async function main() {
  const bom = loadBom();
  const rows = Object.entries(bom).map(([name, entry]) => ({
    code: name,
    name,
    category: entry.category ?? 'Produk',
    subCategory: null as string | null,
    kind: null as string | null,
    stock: 0,
  }));

  console.log(
    `Preparing to upsert ${rows.length} finished goods into Item table...`,
  );

  const chunkSize = 300;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const params: string[] = [];
    const values: Array<string | number | null> = [];

    chunk.forEach((row, idx) => {
      const base = idx * 6;
      params.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`,
      );
      values.push(
        row.code,
        row.name,
        row.category,
        row.subCategory,
        row.kind,
        row.stock,
      );
    });

    const sql = `
      INSERT INTO "Item" ("code", "name", "category", "subCategory", "kind", "stock")
      VALUES ${params.join(',')}
      ON CONFLICT ("code") DO UPDATE SET
        "name" = EXCLUDED."name",
        "category" = EXCLUDED."category",
        "subCategory" = EXCLUDED."subCategory",
        "kind" = EXCLUDED."kind";
    `;

    const client = await pool.connect();
    try {
      await client.query(sql, values);
      console.log(`Upserted batch ${i / chunkSize + 1} (${chunk.length} rows)`);
    } finally {
      client.release();
    }
  }
}

main()
  .catch((err) => {
    console.error('Failed to import finished goods from BOM', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
