require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const data = JSON.parse(
  fs.readFileSync('scripts/output/gudang-wetan-update-summary.json', 'utf8'),
);

const codes = [...new Set(data.notFound.map((x) => x.targetCode))];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
      ? { rejectUnauthorized: false }
      : undefined,
});

(async () => {
  const res = await pool.query(
    'select code from "Item" where code = ANY($1)',
    [codes],
  );
  console.log('codes', codes.length);
  console.log('found', res.rows.length, 'of', codes.length);
  const missing = codes.filter((c) => !res.rows.find((r) => r.code === c));
  console.log('missing', missing);
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});