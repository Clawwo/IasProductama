import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as XLSX from 'xlsx';
import * as path from 'path';

type ExpectedItem = {
  key: string;
  rawCode: string;
  category: string;
  rowNumber: number;
};

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function normalizeHeaderLabel(value: string): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeKey(value: string): string {
  return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isCodeLike(value: string): boolean {
  const text = (value ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{2,12}$/.test(text);
}

function isItemCodeLike(value: string): boolean {
  const text = (value ?? '').trim().toUpperCase();
  if (isCodeLike(text) && /\d/.test(text)) return true;
  return /^(PTG|PTS|PTV)\d+(\.\d+)?CM$/i.test(text);
}

function extractCodeFromName(value: string): string {
  const text = (value ?? '').trim().toUpperCase();
  const match = text.match(/^([A-Z0-9.]{2,16})\s*-/);
  return match?.[1] ?? '';
}

function titleCaseWords(value: string | null | undefined): string {
  const text = (value ?? '').trim().toLowerCase();
  if (!text) return '';
  return text.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function extractSize(value: string): string {
  const text = (value ?? '').trim().toUpperCase();
  const m = text.match(/(\d{2})$/);
  return m?.[1] ?? '';
}

function buildSepatuCode(
  col0: string,
  col1: string,
  subCategory: string,
): string {
  const source = (col0 || col1 || '').trim().toUpperCase();
  const size = extractSize(source);
  const sub = titleCaseWords(subCategory).toUpperCase();
  if (!size) return '';
  if (sub.includes('PENARI')) return `PN${size}`;
  if (sub.includes('PASUKAN')) return `PS${size}`;
  if (sub.includes('PUTRI')) return `MYI${size}`;
  if (sub.includes('PUTRA')) return `MYA${size}`;
  return '';
}

function normalizeCategoryAlias(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  const upper = raw.toUpperCase();
  if (!upper) return '';

  if (/^(B\.?\s*)?SEPATU$/i.test(upper)) return 'Sepatu';
  if (/^PTG[\d.]*CM?$/i.test(upper) || upper === 'PITA GOLD')
    return 'Pita Gold';
  if (/^PTS[\d.]*CM?$/i.test(upper) || upper === 'PITA SATIN')
    return 'Pita Satin';
  if (/^PTV[\d.]*CM?$/i.test(upper) || upper === 'PITA SILVER')
    return 'Pita Silver';
  if (upper === 'KARTON') return 'Karton';
  if (upper === 'JARUM') return 'Jarum';
  if (upper === 'BENANG') return 'Benang';
  if (upper === 'ELASTIS') return 'Elastis';
  if (upper === 'RESLETING') return 'Resleting';
  if (upper === 'PELES') return 'Kain Peles';

  return titleCaseWords(raw);
}

function isMainCategoryHeader(value: string): boolean {
  const text = normalizeHeaderLabel(value).toUpperCase();
  if (!text) return false;
  return (
    text.includes('KAIN') ||
    text.includes('BULU') ||
    text.includes('JARUM') ||
    text.includes('BENANG') ||
    text.includes('KARTON') ||
    text.includes('MAYORET') ||
    text.includes('SEPATU') ||
    text.includes('PITA')
  );
}

function resolveCategory(
  code: string,
  name: string,
  rawCategory: string,
  rawSubCategory: string | null,
): string {
  const c = code.toUpperCase();
  const n = name.toUpperCase();
  const raw = normalizeCategoryAlias(rawCategory);
  const sub = normalizeCategoryAlias(rawSubCategory ?? '').toUpperCase();

  if (/^PTG\d+(\.\d+)?CM$/i.test(c) || n.includes('PITA GOLD'))
    return 'Pita Gold';
  if (/^PTS\d+(\.\d+)?CM$/i.test(c) || n.includes('PITA SATIN'))
    return 'Pita Satin';
  if (/^PTV\d+(\.\d+)?CM$/i.test(c) || n.includes('PITA SILVER'))
    return 'Pita Silver';
  if (
    n.includes('RESLETING') ||
    /^(YE|YK|JK)\d+/i.test(c) ||
    /^JPH\d+/i.test(c) ||
    /^JPP\d+/i.test(c)
  ) {
    return 'Resleting';
  }
  if (/^SIZE\s*/i.test(c) || /^SIZE\s*/i.test(n)) return 'Sepatu';
  if (n.includes('JAMUR') || n.includes('ELASTIS') || sub.includes('ELASTIS')) {
    return 'Elastis';
  }

  if (raw) return raw;
  if (n.includes('JARUM') || c.startsWith('JR')) return 'Jarum';
  if (n.includes('BENANG') || c.startsWith('BB') || c.startsWith('BM'))
    return 'Benang';
  if (n.includes('PELES') || n.includes('BENDERA') || c.startsWith('PS'))
    return 'Kain Peles';
  if (n.includes('SATIN')) return 'Kain Satin';
  if (
    n.includes('DRILL') ||
    n.includes('DRIL') ||
    c.startsWith('DB') ||
    c.startsWith('DT') ||
    c.startsWith('DL') ||
    c.startsWith('OD')
  ) {
    return 'Kain Drill';
  }
  if (
    c.startsWith('PN') ||
    c.startsWith('PS') ||
    c.startsWith('MYI') ||
    c.startsWith('MYA')
  )
    return 'Sepatu';

  return 'Lainnya';
}

function normalizeCategoryForCompare(value: string | null | undefined): string {
  return normalizeCategoryAlias(value).toUpperCase() || 'LAINNYA';
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const pool = new Pool({
    connectionString: url,
    ssl:
      process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
        ? { rejectUnauthorized: false }
        : undefined,
  });

  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const workbookPath = path.join(
    __dirname,
    '../../doc/MARET 2026 - PERSEDIAAN KONVEKSI IAS PRODUCTAMA INDONESIA new.xlsx',
  );
  const workbook = XLSX.readFile(workbookPath);
  const rekapSheet = workbook.Sheets['REKAP PERSEDIAAN'];
  if (!rekapSheet) throw new Error('Sheet REKAP PERSEDIAAN tidak ditemukan');

  const rows = XLSX.utils.sheet_to_json<Array<string | number>>(rekapSheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  let currentCategory = '';
  let currentSubCategory = '';

  const expectedByKey = new Map<string, ExpectedItem>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const col0 = toText(row?.[0]).trim();
    const col1 = toText(row?.[1]).trim();

    if (!col0 && !col1) continue;
    if (/^NAMA BARANG$/i.test(col0) || /^CODE$/i.test(col1)) continue;

    const likelyItemWithEmptyCodeColumn =
      !col1 && !!col0 && (isItemCodeLike(col0) || !!extractCodeFromName(col0));

    if (!col1 && col0 && !likelyItemWithEmptyCodeColumn) {
      const header = normalizeHeaderLabel(col0);
      if (/SEPATU/i.test(currentCategory)) {
        currentSubCategory = titleCaseWords(header);
        continue;
      }

      if (isMainCategoryHeader(header)) {
        currentCategory = normalizeCategoryAlias(titleCaseWords(header));
        currentSubCategory = '';
        continue;
      }

      if (currentCategory) {
        currentSubCategory = titleCaseWords(header);
      }
      continue;
    }

    const isSepatuCategory = /SEPATU/i.test(currentCategory);
    const codeCandidate = isSepatuCategory
      ? buildSepatuCode(col0, col1, currentSubCategory)
      : col1 || (isItemCodeLike(col0) ? col0 : extractCodeFromName(col0));
    const key = normalizeKey(codeCandidate);
    if (!key) continue;

    const inferredName = normalizeHeaderLabel(col0 || codeCandidate);
    const inferredCategory = resolveCategory(
      codeCandidate,
      inferredName,
      currentCategory,
      currentSubCategory || null,
    );

    const prev = expectedByKey.get(key);
    if (!prev) {
      expectedByKey.set(key, {
        key,
        rawCode: codeCandidate,
        category: inferredCategory,
        rowNumber: i + 1,
      });
    } else if (prev.category !== 'Elastis' && inferredCategory === 'Elastis') {
      expectedByKey.set(key, {
        key,
        rawCode: codeCandidate,
        category: inferredCategory,
        rowNumber: i + 1,
      });
    }
  }

  const dbItems = await prisma.convectionItem.findMany({
    select: { code: true, category: true, name: true, unit: true },
  });

  const dbByKey = new Map(dbItems.map((x) => [normalizeKey(x.code), x]));

  const missing: ExpectedItem[] = [];
  const categoryMismatch: Array<{
    code: string;
    expectedCategory: string;
    actualCategory: string;
    rowNumber: number;
  }> = [];

  for (const expected of expectedByKey.values()) {
    const actual = dbByKey.get(expected.key);
    if (!actual) {
      missing.push(expected);
      continue;
    }

    const expCat = normalizeCategoryForCompare(expected.category);
    const actCat = normalizeCategoryForCompare(actual.category);
    if (expCat !== actCat) {
      categoryMismatch.push({
        code: actual.code,
        expectedCategory: expected.category,
        actualCategory: actual.category ?? 'Lainnya',
        rowNumber: expected.rowNumber,
      });
    }
  }

  const extra = dbItems
    .filter((x) => !expectedByKey.has(normalizeKey(x.code)))
    .map((x) => ({ code: x.code, category: x.category ?? 'Lainnya' }));

  const summary = {
    expectedFromRekap: expectedByKey.size,
    inDatabase: dbItems.length,
    missingFromDatabase: missing.length,
    categoryMismatch: categoryMismatch.length,
    extrasOutsideRekap: extra.length,
  };

  console.log(
    JSON.stringify(
      { summary, missing, categoryMismatch, extra: extra.slice(0, 80) },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
