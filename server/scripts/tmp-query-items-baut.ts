import 'dotenv/config';
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ? { rejectUnauthorized: false } : undefined });
async function main(){
  const res = await pool.query('SELECT code,name FROM "Item" WHERE lower(name) LIKE $1 ORDER BY name', ['%baut%']);
  console.log(JSON.stringify(res.rows,null,2));
}
main().finally(()=>pool.end());
