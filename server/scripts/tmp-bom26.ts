import 'dotenv/config';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const ssl =
  process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
    ? { rejectUnauthorized: false }
    : undefined;

const pool = new Pool({ connectionString, ssl });

async function main() {
  const term = process.argv[2] ?? '26';
  const res = await pool.query(
    `SELECT b.id, b."productCode", b."productName",
            json_agg(json_build_object('id', bl.id, 'code', bl.code, 'name', bl.name, 'qty', bl.qty, 'sourceType', bl."sourceType") ORDER BY bl.name) AS lines
     FROM "Bom" b
     LEFT JOIN "BomLine" bl ON bl."bomId" = b.id
     WHERE b."productName" ILIKE $1
     GROUP BY b.id
     ORDER BY b."productCode";`,
    [`%${term}%`],
  );
  console.log(JSON.stringify(res.rows, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
