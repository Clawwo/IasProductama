import 'dotenv/config';
import { Pool } from 'pg';
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

async function main() {
  const rows = inventoryItems.map((item) => ({
    code: item.code,
    name: item.name?.trim() || null,
    category: item.category || null,
    subCategory: item.subCategory || null,
    kind: item.kind || null,
    stock: Number.isFinite(item.stock) ? item.stock : 0,
  }));

  const chunkSize = 400;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const params: Array<string> = [];
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
        "kind" = EXCLUDED."kind",
        "stock" = EXCLUDED."stock";
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
    console.error('Failed to import items', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
