import 'dotenv/config';
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ? { rejectUnauthorized: false } : undefined });
async function main(){
  const codes = ['RING KAYU','LUG-HTS-13-STD','ACC-GEN-10-STD','BB-CLAW-CAKRAM-X6EGZZ','BB-BUSA-18MPT','BB-PEMUKUL-G8G6G5','BB-SLING-1BM4EH','BB-BODY-TABUNG-J33FZD','ACC-GEN-00-STD15','ACC-GEN-00-STD10','BBK-0040'];
  const items = await pool.query('SELECT code,name FROM "Item" WHERE code = ANY($1)', [codes]);
  const raws = await pool.query('SELECT code,name FROM "BahanBaku" WHERE code = ANY($1)', [codes]);
  console.log('items', items.rows);
  console.log('raws', raws.rows);
}
main().finally(()=>pool.end());
