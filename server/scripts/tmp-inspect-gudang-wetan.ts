import xlsx from 'xlsx';
import { writeFileSync } from 'fs';

const workbook = xlsx.readFile('../GUDANG DRUMBAND & MARCHINGBAND IAS PRODUCTAMA new.xlsx');
console.log('Sheets:', workbook.SheetNames);

const sheetName = 'GUDANG WETAN';
const sheet = workbook.Sheets[sheetName];
if (!sheet) {
  throw new Error(`Sheet ${sheetName} not found`);
}

const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
  defval: '',
  raw: false,
});

console.log('Row count:', rows.length);
console.log('First 5 rows:', rows.slice(0, 5));

const outPath = './scripts/output/gudang-wetan-sample.json';
writeFileSync(
  outPath,
  JSON.stringify(
    {
      rowCount: rows.length,
      sample: rows.slice(0, 20),
      headers: rows.length ? Object.keys(rows[0]) : [],
    },
    null,
    2,
  ),
);
console.log(`Saved sample to ${outPath}`);
