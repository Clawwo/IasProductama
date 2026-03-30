import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import xlsx from 'xlsx';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set. Please add it to server/.env');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl:
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
      ? { rejectUnauthorized: false }
      : undefined,
});

// Excel file lives at the workspace root (one level above /server). Use CWD
// so it works whether tsx sets __dirname to /server or /server/scripts.
const workbookPath = path.resolve(
  process.cwd(),
  '..',
  'GUDANG DRUMBAND & MARCHINGBAND IAS PRODUCTAMA new.xlsx',
);
const sheetName = 'GUDANG WETAN';

function readSheet() {
  const workbook = xlsx.readFile(workbookPath);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet ${sheetName} not found in workbook ${workbookPath}`);
  }

  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  return rows;
}

function parseStock(value: unknown): number | null {
  const str = String(value ?? '').trim();
  if (!str) return null;
  const num = Number(str.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : null;
}

// Map kode di Excel ke kode Item yang sudah ada di DB/front-end
const excelToTarget: Record<string, string> = {
  // Mata Ayam
  'EYE-NRM-001': 'ACC-GEN-00-STD10',
  'EYE-HTS-002': 'ACC-HTS-00-PRM',

  // Ring HTS Lite/Hitam/Premium -> kode ring existing
  'RIN-HTS-LIT-10-001': 'RING-HTS-10-BLK',
  'RIN-HTS-LIT-12-002': 'RING-HTS-12-BLK',
  'RIN-HTS-LIT-13-003': 'RING-HTS-13-BLK',
  'RIN-HTS-LIT-14-004': 'RING-HTS-14-BLK',
  'RIN-HTS-HTM-LIT-10-001': 'RING-HTS-10-BLK',
  'RIN-HTS-HTM-LIT-12-002': 'RING-HTS-12-BLK',
  'RIN-HTS-HTM-LIT-13-003': 'RING-HTS-13-BLK',
  'RIN-HTS-HTM-LIT-14-004': 'RING-HTS-14-BLK',
  'RIN-HTS-PRE-10-001': 'RING-HTS-10-CHRCHRPRM',
  'RIN-HTS-PRE-12-002': 'RING-HTS-12-CHRCHRPRM',
  'RIN-HTS-PRE-13-003': 'RING-HTS-13-CHRCHRPRM',
  'RIN-HTS-PRE-14-004': 'RING-HTS-14-CHRCHRPRM',

  // Lug Lite / HTS / BU MARDI
  'LUG-LIT-05-001': 'LUG-LT-05-STD',
  'LUG-LIT-07-002': 'LUG-LT-07-STD',
  'LUG-LIT-12-015': 'LUG-LT-12-STD',
  'LUG-LIT-15-003': 'LUG-LT-15-STD',
  'LUG-LIT-17-004': 'LUG-LT-17-STD',
  'LUG-LIT-20-005': 'LUG-LT-20-STD',
  'LUG-HTS-05P-006': 'LUG-HTS-05-STD',
  'LUG-HTS-05L-007': 'LUG-HTS-05-STD2',
  'LUG-HTS-07P-008': 'LUG-HTS-07-STD',
  'LUG-HTS-13P-009': 'LUG-HTS-13-STD',
  'LUG-HTS-20P-010': 'LUG-HTS-20-STD',
  'LUG-HTS-22P-011': 'LUG-HTS-22-STD',
  'LUG-MAR-15-012': 'LUG-LT-15-STD2',
  'LUG-MAR-07-013': 'LUG-LT-07-STD2',
  'LUG-MAR-15P-014': 'LUG-LT-15-STD3',

  // Harness Airframe
  'HAR-AIR-GEN-001': 'HARN-GEN-00-BLK',
  'HAR-AIR-BLK-003': 'HARN-GEN-00-BLK',
  'HAR-AIR-GEN-002': 'HARN-GEN-00-BLK2',
  'HAR-AIR-BLK-004': 'HARN-GEN-00-BLK2',
  'HAR-AIR-CHR-005': 'HARN-GEN-00-CHRCHR',
  'HAR-AIR-CHR-006': 'HARN-GEN-00-CHRCHR2',

  // Stick
  'STK-SNR-TK-001': 'ACC-GEN-00-STD',
  'STK-SNR-SD-002': 'ACC-GEN-00-STD2',
  'STK-SNR-SM-003': 'ACC-GEN-00-STD3',
  'STK-SNR-HTS-004': 'ACC-HTS-00-STD',
  'STK-SNR-LIT-005': 'ACC-HTS-00-STD2',
  'STK-BAS-SML-006': 'ACC-GEN-00-STD4',
  'STK-BAS-BIG-007': 'ACC-HTS-00-STD3',

  // Ring baut & baut
  'RIN-BAU-GEN-006': 'RING-GEN-06-STD',
  'RIN-BAU-GEN-007': 'RING-GEN-10-STD',
  'BA-610-GEN-008': 'ACC-GEN-01-STD2',
  'BA-SLE-GEN-009': 'ACC-GEN-03-STD',
  'BA-SLE-GEN-010': 'ACC-GEN-03-STD2',
  'CTN-BS-GEN-011': 'ACC-GEN-00-STD16',
};

type FixEntry = {
  code: string;
  name: string;
  stock: number;
  category?: string;
  subCategory?: string;
  kind?: string;
  correctCode: string;
};

function loadFixes(): {
  mapFromFix: Record<string, string>;
  createEntries: FixEntry[];
  fixByCode: Record<string, FixEntry>;
} {
  const fixPath = path.resolve(__dirname, 'output', 'fix-kode-barang.json');
  const raw = readFileSync(fixPath, 'utf8');
  const fixes = JSON.parse(raw) as FixEntry[];

  const mapFromFix: Record<string, string> = {};
  const createEntries: FixEntry[] = [];
  const fixByCode: Record<string, FixEntry> = {};

  for (const f of fixes) {
    fixByCode[f.code] = f;
    if (f.correctCode && f.correctCode.trim()) {
      mapFromFix[f.code] = f.correctCode.trim();
    } else {
      createEntries.push(f);
    }
  }

  return { mapFromFix, createEntries, fixByCode };
}

async function main() {
  const { mapFromFix, createEntries, fixByCode } = loadFixes();
  const mergedExcelToTarget = { ...excelToTarget, ...mapFromFix };

  const rows = readSheet();

  const updates: Array<{
    code: string;
    stock: number;
    name?: string;
    category?: string;
    subCategory?: string;
    kind?: string;
  }> = [];

  for (const row of rows) {
    const codeRaw = (row as any).__EMPTY_1 ?? '';
    const nameRaw = (row as any).__EMPTY_5 ?? '';
    const categoryRaw = (row as any).__EMPTY_2 ?? '';
    const variantRaw = (row as any).__EMPTY_3 ?? '';

    const code = String(codeRaw).trim();
    if (!code || /kode barang/i.test(code)) continue;
    if (/stok awal/i.test(String(nameRaw))) continue;

    // Latest "STOK AKHIR" column (2026-02-02) sits at __EMPTY_28
    const stock = parseStock((row as any).__EMPTY_28);
    if (stock === null) continue;

    updates.push({
      code,
      stock,
      name: String(nameRaw).trim() || undefined,
      category: String(categoryRaw).trim() || undefined,
      subCategory: undefined,
      kind: String(variantRaw).trim() || undefined,
    });
  }

  console.log(`Parsed ${updates.length} rows with stock`);

  const notFound: Array<typeof updates[number] & { targetCode: string }> = [];
  const resolvedByName: Array<
    typeof updates[number] & { targetCode: string; matchedCode: string }
  > = [];
  const created: Array<typeof updates[number] & { targetCode: string }> = [];
  let updated = 0;

  for (const item of updates) {
    const targetCode = mergedExcelToTarget[item.code] ?? item.code;

    const res = await pool.query(
      `UPDATE "Item"
       SET "name" = $1,
           "stock" = $2,
           "category" = COALESCE($3, "category"),
           "subCategory" = COALESCE($4, "subCategory"),
           "kind" = COALESCE($5, "kind")
       WHERE "code" = $6`,
      [
        item.name ?? null,
        item.stock,
        item.category ?? null,
        item.subCategory ?? null,
        item.kind ?? null,
        targetCode,
      ],
    );

    if (res.rowCount > 0) {
      updated += res.rowCount;
    } else {
      // Fallback: cari item berdasar nama (case-insensitive) jika kode tidak ketemu
      if (item.name) {
        const byName = await pool.query(
          'SELECT code FROM "Item" WHERE lower("name") = lower($1)',
          [item.name],
        );

        if (byName.rowCount === 1) {
          const matchedCode = byName.rows[0].code as string;
          const resByName = await pool.query(
            `UPDATE "Item"
             SET "name" = $1,
                 "stock" = $2,
                 "category" = COALESCE($3, "category"),
                 "subCategory" = COALESCE($4, "subCategory"),
                 "kind" = COALESCE($5, "kind")
             WHERE "code" = $6`,
            [
              item.name ?? null,
              item.stock,
              item.category ?? null,
              item.subCategory ?? null,
              item.kind ?? null,
              matchedCode,
            ],
          );

          if (resByName.rowCount > 0) {
            updated += resByName.rowCount;
            resolvedByName.push({ ...item, targetCode, matchedCode });
            continue;
          }
        }
      }

      notFound.push({ ...item, targetCode });
    }
  }

  const stillMissing: typeof notFound = [];

  for (const item of notFound) {
    const fix = fixByCode[item.code];
    const targetCode = fix?.correctCode?.trim() || item.targetCode || item.code;

    const res = await pool.query(
      `INSERT INTO "Item" ("code", "name", "stock", "category", "subCategory", "kind")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("code") DO UPDATE SET
         "name" = EXCLUDED."name",
         "stock" = EXCLUDED."stock",
         "category" = COALESCE(EXCLUDED."category", "Item"."category"),
         "subCategory" = COALESCE(EXCLUDED."subCategory", "Item"."subCategory"),
         "kind" = COALESCE(EXCLUDED."kind", "Item"."kind")`,
      [
        targetCode,
        fix?.name ?? item.name ?? null,
        item.stock,
        fix?.category ?? item.category ?? null,
        fix?.subCategory ?? item.subCategory ?? null,
        fix?.kind ?? item.kind ?? null,
      ],
    );

    if (res.rowCount > 0) {
      created.push({ ...item, targetCode });
      updated += 1;
    } else {
      stillMissing.push(item);
    }
  }

  console.log(
    `Updated ${updated}, by-name ${resolvedByName.length}, created ${created.length}, not processed ${stillMissing.length}`,
  );

  mkdirSync(path.resolve(__dirname, 'output'), { recursive: true });
  const outPath = path.resolve(
    __dirname,
    'output',
    'gudang-wetan-update-summary.json',
  );
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        updated,
        resolvedByName,
        created,
        notFound: stillMissing,
      },
      null,
      2,
    ),
  );
  console.log(`Summary written to ${outPath}`);
}

main()
  .catch((err) => {
    console.error('Failed to update Gudang Wetan stock', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
