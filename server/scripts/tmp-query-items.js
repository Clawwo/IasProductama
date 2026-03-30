require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
      ? { rejectUnauthorized: false }
      : undefined,
});

async function dump(label, pattern) {
  const res = await pool.query(
    'select code, name, category from "Item" where code like $1 order by code',
    [pattern],
  );
  console.log(`\n${label} (${res.rowCount})`);
  console.log(res.rows);
}

async function main() {
  await dump('ACC-GEN-00-STD%', 'ACC-GEN-00-STD%');
  await dump('ACC-HTS-00-STD%', 'ACC-HTS-00-STD%');
  await dump('RING-HTS-%', 'RING-HTS-%');
  await dump('LUG-%', 'LUG-%');
  await dump('HARN-%', 'HARN-%');
  await dump('STK-%', 'STK-%');
  await dump('BOL-%', 'BOL-%');
  await dump('RING-GEN-%', 'RING-GEN-%');

  const categoryStick = await pool.query(
    'select code, name from "Item" where category = $1 order by code',
    ['Stick'],
  );
  console.log(`\nCategory Stick (${categoryStick.rowCount})`);
  console.log(categoryStick.rows);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });