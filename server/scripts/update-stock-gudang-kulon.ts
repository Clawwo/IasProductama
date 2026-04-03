import 'dotenv/config';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import xlsx from 'xlsx';

type ParsedStockRow = {
  sourceRow: number;
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

type HeaderInfo = {
  headerRowIndex: number;
  codeCol: number;
  categoryCol: number;
  kindCol: number;
  nameCol: number;
  stockCol: number;
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
  getArgValue('--sheet') ?? process.env.GUDANG_KULON_SHEET ?? 'GUDANG KULON';

const selectedCategory = (
  getArgValue('--category') ??
  process.env.GUDANG_KULON_CATEGORY ??
  ''
).trim();

const batchSize = getIntArg(
  '--batch-size',
  process.env.GUDANG_KULON_BATCH_SIZE,
);
const batchIndex =
  getIntArg('--batch-index', process.env.GUDANG_KULON_BATCH_INDEX) ?? 1;
const offset = getIntArg('--offset', process.env.GUDANG_KULON_OFFSET) ?? 0;
const limit = getIntArg('--limit', process.env.GUDANG_KULON_LIMIT);
const startRow = getIntArg('--start-row', process.env.GUDANG_KULON_START_ROW);
const endRow = getIntArg('--end-row', process.env.GUDANG_KULON_END_ROW);

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

function getIntArg(flag: string, envValue?: string): number | null {
  const raw = getArgValue(flag) ?? envValue ?? '';
  const value = String(raw).trim();
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer value for ${flag}: ${value}`);
  }
  return parsed;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' dan ')
    .replace(/["'`]/g, '')
    .replace(/[()]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function parseSectionCategory(name: string): string | null {
  const normalized = name.trim().replace(/\s+/g, ' ');
  const match = normalized.match(/^[A-Z]\.\s*(.+)$/);
  if (!match) return null;

  const section = match[1]?.trim() ?? '';
  if (!section) return null;
  if (/stok\s*awal/i.test(section)) return null;
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
  const fallbackSheets = ['GUDANG KULON'];

  for (const workbookPath of workbookCandidates) {
    if (!existsSync(workbookPath)) continue;

    const workbook = xlsx.readFile(workbookPath);
    const targetSheets = [
      requestedSheetName,
      ...fallbackSheets.filter((sheetName) => sheetName !== requestedSheetName),
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

function readMatrix(workbook: xlsx.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet ${sheetName} not found`);
  }

  return xlsx.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });
}

function findHeaderInfo(rows: unknown[][]): HeaderInfo {
  const findCol = (cells: string[], ...keys: string[]) =>
    cells.findIndex((cell) => keys.some((key) => cell.includes(key)));

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const cells = row.map((cell) => normalizeText(String(cell ?? '')));

    const codeCol = findCol(cells, 'kode barang');
    const nameCol = findCol(cells, 'nama barang');
    const categoryCol = findCol(cells, 'kategori');
    const kindCol = findCol(cells, 'ukuran varian', 'varian');
    const stockCols = cells
      .map((cell, index) => ({ cell, index }))
      .filter((entry) => entry.cell.includes('stok akhir'))
      .map((entry) => entry.index);

    if (codeCol >= 0 && nameCol >= 0 && stockCols.length > 0) {
      return {
        headerRowIndex: i,
        codeCol,
        categoryCol,
        kindCol,
        nameCol,
        stockCol: stockCols[stockCols.length - 1],
      };
    }
  }

  throw new Error(
    'Header row not found. Could not detect columns Kode Barang/Nama Barang/STOK AKHIR.',
  );
}

function getCell(row: unknown[], colIndex: number): string {
  if (colIndex < 0) return '';
  return String(row[colIndex] ?? '').trim();
}

function parseRows(
  rows: unknown[][],
  headerInfo: HeaderInfo,
): ParsedStockRow[] {
  const parsed: ParsedStockRow[] = [];
  let currentSectionCategory = '';

  for (
    let rowIndex = headerInfo.headerRowIndex + 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const row = rows[rowIndex] ?? [];

    const code = getCell(row, headerInfo.codeCol);
    const categoryCell = getCell(row, headerInfo.categoryCol);
    const kind = getCell(row, headerInfo.kindCol);
    const name = getCell(row, headerInfo.nameCol);
    const stock = parseStock(getCell(row, headerInfo.stockCol));

    if (!code && name) {
      const sectionCategory = parseSectionCategory(name);
      if (sectionCategory) {
        currentSectionCategory = sectionCategory;
        continue;
      }
    }

    if (!name) continue;
    if (/stok\s*awal/i.test(name)) continue;
    if (/^total\b/i.test(name)) continue;
    if (/kode\s*barang/i.test(code)) continue;
    if (stock === null) continue;

    const category = categoryCell || currentSectionCategory || 'Tanpa Kategori';

    parsed.push({
      sourceRow: rowIndex + 1,
      code,
      name,
      category,
      kind: kind || undefined,
      stock,
    });
  }

  return parsed;
}

function applyScopes(rows: ParsedStockRow[]): {
  scopedRows: ParsedStockRow[];
  scopeInfo: Record<string, number | string | null>;
} {
  let scoped = rows;

  if (selectedCategory) {
    const wanted = normalizeText(selectedCategory);
    scoped = scoped.filter((row) => normalizeText(row.category) === wanted);
  }

  if (startRow !== null || endRow !== null) {
    scoped = scoped.filter((row) => {
      if (startRow !== null && row.sourceRow < startRow) return false;
      if (endRow !== null && row.sourceRow > endRow) return false;
      return true;
    });
  }

  if (batchSize !== null && batchSize > 0) {
    const safeBatchIndex = Math.max(1, batchIndex);
    const start = (safeBatchIndex - 1) * batchSize;
    const end = start + batchSize;
    scoped = scoped.slice(start, end);
    return {
      scopedRows: scoped,
      scopeInfo: {
        category: selectedCategory || null,
        batchSize,
        batchIndex: safeBatchIndex,
        offset: start,
        limit: batchSize,
        startRow: startRow ?? null,
        endRow: endRow ?? null,
      },
    };
  }

  const safeOffset = Math.max(0, offset);
  const safeLimit = limit !== null && limit > 0 ? limit : null;

  if (safeOffset > 0 || safeLimit !== null) {
    scoped =
      safeLimit === null
        ? scoped.slice(safeOffset)
        : scoped.slice(safeOffset, safeOffset + safeLimit);
  }

  return {
    scopedRows: scoped,
    scopeInfo: {
      category: selectedCategory || null,
      batchSize: batchSize ?? null,
      batchIndex: batchSize !== null ? Math.max(1, batchIndex) : null,
      offset: safeOffset,
      limit: safeLimit,
      startRow: startRow ?? null,
      endRow: endRow ?? null,
    },
  };
}

function findCandidate(
  candidates: ItemRow[],
  rowCategory: string,
  rowCode: string,
): { item: ItemRow | null; ambiguousCandidates: ItemRow[] } {
  if (candidates.length === 0) {
    return { item: null, ambiguousCandidates: [] };
  }

  if (candidates.length === 1) {
    return { item: candidates[0], ambiguousCandidates: [] };
  }

  if (rowCode) {
    const codeMatches = candidates.filter(
      (candidate) => candidate.code.toUpperCase() === rowCode.toUpperCase(),
    );

    if (codeMatches.length === 1) {
      return { item: codeMatches[0], ambiguousCandidates: [] };
    }

    if (codeMatches.length > 1) {
      return { item: null, ambiguousCandidates: codeMatches };
    }
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

function buildScopeSuffix(
  scopeInfo: Record<string, number | string | null>,
): string {
  const parts: string[] = [];

  if (scopeInfo.category) {
    parts.push(
      `cat-${normalizeText(String(scopeInfo.category)).replace(/\s+/g, '-')}`,
    );
  }
  if (scopeInfo.batchSize && scopeInfo.batchIndex) {
    parts.push(`batch-${scopeInfo.batchIndex}x${scopeInfo.batchSize}`);
  }
  if (scopeInfo.limit) {
    parts.push(`offset-${scopeInfo.offset ?? 0}-limit-${scopeInfo.limit}`);
  }
  if (scopeInfo.startRow || scopeInfo.endRow) {
    parts.push(
      `rows-${scopeInfo.startRow ?? 'start'}-${scopeInfo.endRow ?? 'end'}`,
    );
  }

  return parts.length ? parts.join('-') : 'all';
}

async function main() {
  const { workbook, workbookPath, sheetName } = resolveWorkbookAndSheet();
  const matrix = readMatrix(workbook, sheetName);
  const headerInfo = findHeaderInfo(matrix);
  const parsedRows = parseRows(matrix, headerInfo);
  const { scopedRows, scopeInfo } = applyScopes(parsedRows);

  console.log(`Workbook: ${workbookPath}`);
  console.log(`Sheet: ${sheetName}`);
  console.log(
    `Detected rows with stock: ${parsedRows.length}, selected to process: ${scopedRows.length}`,
  );

  const itemRes = await pool.query<ItemRow>(
    'SELECT "code", "name", "category", "subCategory", "kind", "stock" FROM "Item"',
  );
  const items = itemRes.rows;
  const itemsByCode = new Map(
    items.map((item) => [item.code.toUpperCase(), item]),
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
    sourceRow: number;
    sourceCode: string;
    sourceName: string;
    sourceCategory: string;
    matchedCode: string;
    matchedName: string | null;
    matchType: 'exact-name' | 'normalized-name' | 'direct-code';
    stock: number;
  }> = [];

  const missing: Array<{
    sourceRow: number;
    sourceCode: string;
    sourceName: string;
    sourceCategory: string;
    stock: number;
    reason: 'no-match' | 'update-failed';
  }> = [];

  const ambiguous: Array<{
    sourceRow: number;
    sourceCode: string;
    sourceName: string;
    sourceCategory: string;
    stock: number;
    candidateCodes: string[];
  }> = [];

  for (const row of scopedRows) {
    const summary =
      categorySummary.get(row.category) ?? createCategorySummary(row.category);
    summary.rows += 1;
    categorySummary.set(row.category, summary);

    const exactCandidates = exactNameMap.get(row.name.toLowerCase()) ?? [];
    const normalizedCandidates =
      normalizedNameMap.get(normalizeText(row.name)) ?? [];

    let selectedItem: ItemRow | null = null;
    let matchType: 'exact-name' | 'normalized-name' | 'direct-code' | null =
      null;
    let ambiguousCandidates: ItemRow[] = [];

    const exactResult = findCandidate(exactCandidates, row.category, row.code);
    if (exactResult.item) {
      selectedItem = exactResult.item;
      matchType = 'exact-name';
    } else if (exactResult.ambiguousCandidates.length > 0) {
      ambiguousCandidates = exactResult.ambiguousCandidates;
    } else {
      const normalizedResult = findCandidate(
        normalizedCandidates,
        row.category,
        row.code,
      );
      if (normalizedResult.item) {
        selectedItem = normalizedResult.item;
        matchType = 'normalized-name';
      } else if (normalizedResult.ambiguousCandidates.length > 0) {
        ambiguousCandidates = normalizedResult.ambiguousCandidates;
      }
    }

    if (!selectedItem && row.code) {
      const byCode = itemsByCode.get(row.code.toUpperCase()) ?? null;
      if (byCode) {
        selectedItem = byCode;
        matchType = 'direct-code';
      }
    }

    if (!selectedItem || !matchType) {
      if (ambiguousCandidates.length > 0) {
        ambiguous.push({
          sourceRow: row.sourceRow,
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
          sourceRow: row.sourceRow,
          sourceCode: row.code,
          sourceName: row.name,
          sourceCategory: row.category,
          stock: row.stock,
          reason: 'no-match',
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
        sourceRow: row.sourceRow,
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
        sourceRow: row.sourceRow,
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
  const scopeSuffix = buildScopeSuffix(scopeInfo);
  const outPath = path.resolve(
    __dirname,
    'output',
    `gudang-kulon-stock-update-${scopeSuffix}.json`,
  );

  writeFileSync(
    outPath,
    JSON.stringify(
      {
        workbookPath,
        sheetName,
        processedAt: new Date().toISOString(),
        headerInfo,
        scopeInfo,
        totals: {
          rowsDetected: parsedRows.length,
          rowsProcessed: scopedRows.length,
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
    console.error('Failed to update Gudang Kulon stock', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
