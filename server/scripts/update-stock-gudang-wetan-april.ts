import 'dotenv/config';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import xlsx from 'xlsx';

type SheetRow = Record<string, unknown>;

type ParsedStockRow = {
  rowNumber: number;
  code: string;
  name: string;
  category: string;
  kind?: string;
  stock: number;
};

type ItemRow = {
  code: string;
  name: string | null;
  category: string | null;
  subCategory: string | null;
  kind: string | null;
  stock: number;
};

type CategorySummary = {
  category: string;
  rows: number;
  updated: number;
  missing: number;
  ambiguous: number;
};

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

const workbookCandidates = [
  path.resolve(
    process.cwd(),
    '..',
    '(TIMUR) PERSEDIAAN GUDANG SPAREPART IAS 2026.xlsx',
  ),
  path.resolve(
    process.cwd(),
    '..',
    'GUDANG DRUMBAND & MARCHINGBAND IAS PRODUCTAMA new.xlsx',
  ),
];

const requestedSheetName =
  getArgValue('--sheet') ??
  process.env.GUDANG_WETAN_SHEET ??
  'GUDANG_WETAN PER APRIL 2026';

const selectedCategory = (
  getArgValue('--category') ??
  process.env.GUDANG_WETAN_CATEGORY ??
  ''
).trim();

// Manual reconciliation for rows that use alternate source codes/names in the
// April sheet but should update existing canonical Item codes.
const sourceCodeToTargetCode: Record<string, string> = {
  // Ring
  'RIN-HTS-LIT-12-002': 'RING-HTS-12-BLK',
  'RIN-HTS-LIT-13-003': 'RING-HTS-13-BLK',
  'RIN-HTS-LIT-14-004': 'RING-HTS-14-BLK',

  // Lug
  'LUG-LIT-12-015': 'LUG-LT-12-STD',
  'LUG-MAR-15P-014': 'LUG-LT-15-STD3',

  // Harnest / Harness Airframe
  'HAR-AIR-GEN-001': 'HARN-GEN-00-BLK',
  'HAR-AIR-GEN-002': 'HARN-GEN-00-BLK2',
  'HAR-AIR-BLK-003': 'HARN-GEN-00-BLK',
  'HAR-AIR-BLK-004': 'HARN-GEN-00-BLK2',
  'HAR-AIR-CHR-005': 'HARN-GEN-00-CHRCHR',
  'HAR-AIR-CHR-006': 'HARN-GEN-00-CHRCHR2',

  // Stick
  'STK-TNR-TK-008': 'ACC-GEN-00-STD5',
};

const sourceNameToTargetCode: Record<string, string> = {
  'KARDUS (35x43x85)': 'PACK-GEN-00-35X43X85',
  'KARDUS Packing Biasa': 'PACK-GEN-00-BIASA',
};

const createByTargetCode: Record<
  string,
  {
    code: string;
    name: string;
    category: string;
    kind?: string;
  }
> = {
  'PACK-GEN-00-35X43X85': {
    code: 'PACK-GEN-00-35X43X85',
    name: 'KARDUS (35x43x85)',
    category: 'Kardus Packing',
    kind: '35x43x85',
  },
  'PACK-GEN-00-BIASA': {
    code: 'PACK-GEN-00-BIASA',
    name: 'KARDUS Packing Biasa',
    category: 'Kardus Packing',
  },
};

function getArgValue(flag: string): string | null {
  const args = process.argv.slice(2);
  const prefixed = `${flag}=`;

  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    if (current === flag) {
      return args[i + 1] ?? null;
    }

    if (current.startsWith(prefixed)) {
      return current.slice(prefixed.length);
    }
  }

  return null;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const parsed = String(value ?? '').trim();
    if (parsed) {
      return parsed;
    }
  }
  return '';
}

function parseStock(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const cleaned = raw.replace(/[^0-9,.-]/g, '');
  if (!cleaned) return null;

  const normalized =
    cleaned.includes(',') && !cleaned.includes('.')
      ? cleaned.replace(',', '.')
      : cleaned.replace(/,/g, '');

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  return Math.round(parsed);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' dan ')
    .replace(/[@]/g, ' at ')
    .replace(/["'`]/g, '')
    .replace(/[()]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSectionCategory(name: string): string | null {
  const normalizedName = name.trim().replace(/\s+/g, ' ');
  // Section rows use a marker format like "A. RING" / "S. KARDUS PACKING".
  const match = normalizedName.match(/^[A-Z]\.\s*(.+)$/);
  if (!match) return null;

  const section = match[1]?.trim() ?? '';
  if (!section) return null;
  if (/stok\s*awal/i.test(section)) return null;
  // Prevent normal item names (e.g. "Snare ...") from being misread as section.
  if (/[a-z]/.test(section)) return null;

  return section;
}

function createCategorySummary(category: string): CategorySummary {
  return {
    category,
    rows: 0,
    updated: 0,
    missing: 0,
    ambiguous: 0,
  };
}

function resolveWorkbookAndSheet(): {
  workbookPath: string;
  sheetName: string;
  workbook: xlsx.WorkBook;
} {
  const fallbackSheets = ['GUDANG_WETAN PER APRIL 2026', 'GUDANG WETAN'];

  for (const workbookPath of workbookCandidates) {
    if (!existsSync(workbookPath)) continue;

    const workbook = xlsx.readFile(workbookPath);
    const targetSheets = [
      requestedSheetName,
      ...fallbackSheets.filter((name) => name !== requestedSheetName),
    ];

    for (const sheetName of targetSheets) {
      if (workbook.Sheets[sheetName]) {
        return { workbookPath, sheetName, workbook };
      }
    }
  }

  throw new Error(
    `Could not find sheet \"${requestedSheetName}\" in workbook candidates:\n- ${workbookCandidates.join('\n- ')}`,
  );
}

function readRows(workbook: xlsx.WorkBook, sheetName: string): SheetRow[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet ${sheetName} not found`);
  }

  return xlsx.utils.sheet_to_json<SheetRow>(sheet, {
    defval: '',
    raw: false,
  });
}

function parseRows(rows: SheetRow[]): ParsedStockRow[] {
  const parsed: ParsedStockRow[] = [];
  let currentSectionCategory = '';

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    const code = firstNonEmpty(
      row['Kode Barang'],
      row['KODE BARANG'],
      row.__EMPTY,
      row.__EMPTY_1,
    );

    const categoryCell = firstNonEmpty(
      row['Kategori'],
      row['KATEGORI'],
      row.__EMPTY_2,
    );

    const kind = firstNonEmpty(
      row['Ukuran/Varian'],
      row['VARIAN'],
      row.__EMPTY_3,
    );

    const name = firstNonEmpty(
      row['Nama Barang'],
      row['NAMA BARANG'],
      row.__EMPTY_4,
      row.__EMPTY_5,
    );

    const stock = parseStock(
      firstNonEmpty(
        row['STOK AKHIR'],
        row['Stok Akhir'],
        row.__EMPTY_9,
        row.__EMPTY_28,
      ),
    );

    if (!code && name) {
      const sectionCategory = parseSectionCategory(name);
      if (sectionCategory) {
        currentSectionCategory = sectionCategory;
        continue;
      }
    }

    if (/kode\s*barang/i.test(code)) continue;
    if (/stok\s*awal/i.test(name)) continue;
    if (!name) continue;
    if (stock === null) continue;

    const category = categoryCell || currentSectionCategory || 'Tanpa Kategori';
    if (
      selectedCategory &&
      normalizeText(category) !== normalizeText(selectedCategory)
    ) {
      continue;
    }

    parsed.push({
      rowNumber: index + 2,
      code,
      name,
      category,
      kind: kind || undefined,
      stock,
    });
  }

  return parsed;
}

function findCandidate(
  candidates: ItemRow[],
  rowCategory: string,
): { item: ItemRow | null; ambiguousCandidates: ItemRow[] } {
  if (candidates.length === 0) {
    return { item: null, ambiguousCandidates: [] };
  }

  if (candidates.length === 1) {
    return { item: candidates[0], ambiguousCandidates: [] };
  }

  const normalizedCategory = normalizeText(rowCategory);
  if (normalizedCategory) {
    const categoryMatches = candidates.filter(
      (candidate) =>
        normalizeText(candidate.category ?? '') === normalizedCategory,
    );

    if (categoryMatches.length === 1) {
      return { item: categoryMatches[0], ambiguousCandidates: [] };
    }

    if (categoryMatches.length > 1) {
      return { item: null, ambiguousCandidates: categoryMatches };
    }
  }

  return { item: null, ambiguousCandidates: candidates };
}

function slugifyCategory(value: string): string {
  return normalizeText(value).replace(/\s+/g, '-');
}

async function main() {
  const { workbook, workbookPath, sheetName } = resolveWorkbookAndSheet();
  const rows = readRows(workbook, sheetName);
  const parsedRows = parseRows(rows);

  console.log(`Workbook: ${workbookPath}`);
  console.log(`Sheet: ${sheetName}`);
  console.log(
    `Rows ready for update: ${parsedRows.length}${
      selectedCategory ? ` (category: ${selectedCategory})` : ''
    }`,
  );

  const itemRes = await pool.query<ItemRow>(
    'SELECT "code", "name", "category", "subCategory", "kind", "stock" FROM "Item"',
  );
  const items = itemRes.rows;
  const itemsByCode = new Map(items.map((item) => [item.code, item]));

  const normalizedNameToTargetCode = new Map<string, string>(
    Object.entries(sourceNameToTargetCode).map(([name, code]) => [
      normalizeText(name),
      code,
    ]),
  );

  const exactNameMap = new Map<string, ItemRow[]>();
  const normalizedNameMap = new Map<string, ItemRow[]>();

  for (const item of items) {
    const name = (item.name ?? '').trim();
    if (!name) continue;

    const exactKey = name.toLowerCase();
    const normalizedKey = normalizeText(name);

    if (!exactNameMap.has(exactKey)) {
      exactNameMap.set(exactKey, []);
    }
    exactNameMap.get(exactKey)?.push(item);

    if (!normalizedNameMap.has(normalizedKey)) {
      normalizedNameMap.set(normalizedKey, []);
    }
    normalizedNameMap.get(normalizedKey)?.push(item);
  }

  const categorySummary = new Map<string, CategorySummary>();

  const updated: Array<{
    rowNumber: number;
    sourceCode: string;
    sourceName: string;
    sourceCategory: string;
    matchedCode: string;
    matchedName: string | null;
    matchType:
      | 'code-map'
      | 'code-map-create'
      | 'exact-name'
      | 'normalized-name';
    stock: number;
  }> = [];

  const missing: Array<{
    rowNumber: number;
    sourceCode: string;
    sourceName: string;
    sourceCategory: string;
    stock: number;
    reason: 'no-name-match' | 'update-failed';
  }> = [];

  const ambiguous: Array<{
    rowNumber: number;
    sourceCode: string;
    sourceName: string;
    sourceCategory: string;
    stock: number;
    candidateCodes: string[];
  }> = [];

  for (const row of parsedRows) {
    const summary =
      categorySummary.get(row.category) ?? createCategorySummary(row.category);
    summary.rows += 1;
    categorySummary.set(row.category, summary);

    const mappedCode =
      sourceCodeToTargetCode[row.code] ??
      normalizedNameToTargetCode.get(normalizeText(row.name));
    if (mappedCode) {
      const mappedItem = itemsByCode.get(mappedCode) ?? null;
      const updateByMap = await pool.query(
        `UPDATE "Item"
         SET "name" = $1,
             "stock" = $2,
             "category" = COALESCE($3, "category"),
             "kind" = COALESCE($4, "kind")
         WHERE "code" = $5`,
        [
          row.name,
          row.stock,
          row.category || null,
          row.kind || null,
          mappedCode,
        ],
      );

      if (updateByMap.rowCount && updateByMap.rowCount > 0) {
        updated.push({
          rowNumber: row.rowNumber,
          sourceCode: row.code,
          sourceName: row.name,
          sourceCategory: row.category,
          matchedCode: mappedCode,
          matchedName: mappedItem?.name ?? null,
          matchType: 'code-map',
          stock: row.stock,
        });
        summary.updated += 1;
        continue;
      }

      const createTemplate = createByTargetCode[mappedCode];
      if (createTemplate) {
        const createRes = await pool.query(
          `INSERT INTO "Item" ("code", "name", "stock", "category", "kind")
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT ("code") DO UPDATE SET
             "name" = EXCLUDED."name",
             "stock" = EXCLUDED."stock",
             "category" = COALESCE(EXCLUDED."category", "Item"."category"),
             "kind" = COALESCE(EXCLUDED."kind", "Item"."kind")`,
          [
            createTemplate.code,
            row.name || createTemplate.name,
            row.stock,
            row.category || createTemplate.category,
            row.kind || createTemplate.kind || null,
          ],
        );

        if (createRes.rowCount && createRes.rowCount > 0) {
          updated.push({
            rowNumber: row.rowNumber,
            sourceCode: row.code,
            sourceName: row.name,
            sourceCategory: row.category,
            matchedCode: mappedCode,
            matchedName: row.name || createTemplate.name,
            matchType: 'code-map-create',
            stock: row.stock,
          });
          summary.updated += 1;
          continue;
        }
      }
    }

    const exactCandidates = exactNameMap.get(row.name.toLowerCase()) ?? [];
    const normalizedCandidates =
      normalizedNameMap.get(normalizeText(row.name)) ?? [];

    let matchType: 'exact-name' | 'normalized-name' | null = null;
    let selectedItem: ItemRow | null = null;
    let ambiguousCandidates: ItemRow[] = [];

    const exactResult = findCandidate(exactCandidates, row.category);
    if (exactResult.item) {
      selectedItem = exactResult.item;
      matchType = 'exact-name';
    } else if (exactResult.ambiguousCandidates.length > 0) {
      ambiguousCandidates = exactResult.ambiguousCandidates;
    } else {
      const normalizedResult = findCandidate(
        normalizedCandidates,
        row.category,
      );
      if (normalizedResult.item) {
        selectedItem = normalizedResult.item;
        matchType = 'normalized-name';
      } else if (normalizedResult.ambiguousCandidates.length > 0) {
        ambiguousCandidates = normalizedResult.ambiguousCandidates;
      }
    }

    if (!selectedItem || !matchType) {
      if (ambiguousCandidates.length > 0) {
        ambiguous.push({
          rowNumber: row.rowNumber,
          sourceCode: row.code,
          sourceName: row.name,
          sourceCategory: row.category,
          stock: row.stock,
          candidateCodes: ambiguousCandidates.map(
            (candidate) => candidate.code,
          ),
        });
        summary.ambiguous += 1;
      } else {
        missing.push({
          rowNumber: row.rowNumber,
          sourceCode: row.code,
          sourceName: row.name,
          sourceCategory: row.category,
          stock: row.stock,
          reason: 'no-name-match',
        });
        summary.missing += 1;
      }
      continue;
    }

    const updateRes = await pool.query(
      `UPDATE "Item"
       SET "name" = $1,
           "stock" = $2,
           "category" = COALESCE($3, "category"),
           "kind" = COALESCE($4, "kind")
       WHERE "code" = $5`,
      [
        row.name,
        row.stock,
        row.category || null,
        row.kind || null,
        selectedItem.code,
      ],
    );

    if (updateRes.rowCount && updateRes.rowCount > 0) {
      updated.push({
        rowNumber: row.rowNumber,
        sourceCode: row.code,
        sourceName: row.name,
        sourceCategory: row.category,
        matchedCode: selectedItem.code,
        matchedName: selectedItem.name,
        matchType,
        stock: row.stock,
      });
      summary.updated += 1;
    } else {
      missing.push({
        rowNumber: row.rowNumber,
        sourceCode: row.code,
        sourceName: row.name,
        sourceCategory: row.category,
        stock: row.stock,
        reason: 'update-failed',
      });
      summary.missing += 1;
    }
  }

  const categoryBreakdown = [...categorySummary.values()].sort((a, b) =>
    a.category.localeCompare(b.category),
  );

  mkdirSync(path.resolve(__dirname, 'output'), { recursive: true });

  const scope = selectedCategory
    ? slugifyCategory(selectedCategory)
    : 'all-categories';

  const outPath = path.resolve(
    __dirname,
    'output',
    `gudang-wetan-april-2026-stock-update-${scope}.json`,
  );

  writeFileSync(
    outPath,
    JSON.stringify(
      {
        workbookPath,
        sheetName,
        selectedCategory: selectedCategory || null,
        processedAt: new Date().toISOString(),
        totals: {
          rowsReady: parsedRows.length,
          updated: updated.length,
          missing: missing.length,
          ambiguous: ambiguous.length,
          categories: categoryBreakdown.length,
        },
        categoryBreakdown,
        missing,
        ambiguous,
        updated,
      },
      null,
      2,
    ),
  );

  console.log(`Updated: ${updated.length}`);
  console.log(`Missing: ${missing.length}`);
  console.log(`Ambiguous: ${ambiguous.length}`);
  console.log(`Category count: ${categoryBreakdown.length}`);
  console.log(`Summary written to ${outPath}`);
}

main()
  .catch((err) => {
    console.error('Failed to update Gudang Wetan April stock', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
