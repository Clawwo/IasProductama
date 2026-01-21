import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  const res = await pool.query(
    `SELECT code, name, category, "subCategory"
     FROM "Product"
     WHERE (code IS NULL OR code = '')
     ORDER BY "name" NULLS LAST
     LIMIT 20`,
  );
  console.log(JSON.stringify(res.rows, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
