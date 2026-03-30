import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as XLSX from 'xlsx';
import * as path from 'path';

type ExpectedItem = {
  key: string;
  code: string;
  category: string;
  subCategory: string | null;
  unit: string;
};

function normalizeHeaderLabel(value: string): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeKey(value: string): string {
  return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function titleCaseWords(value: string | null | undefined): string {
  const text = (value ?? '').trim().toLowerCase();
  if (!text) return '';
  return text.replace(/\b([a-z])/g, (m) => m.toUpperCase());
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

function normalizeCode(value: string): string {
  const upper = (value ?? '').trim().toUpperCase();
  return upper.replace(/[^A-Z0-9.]/g, '');
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function normalizeUnit(value: unknown): string {
  const cleaned = toText(value).trim().toUpperCase();
  if (!cleaned) return 'KG';
  if (cleaned === 'PASANG') return 'SET';
  if (cleaned === 'M' || cleaned === 'MTR' || cleaned === 'METERS')
    return 'METER';
  if (cleaned === 'PC' || cleaned === 'PIECE' || cleaned === 'PIECES')
    return 'PCS';
  if (cleaned === 'OZ' || cleaned === 'ONZ') return 'ONS';
  if (['ONS', 'KG', 'METER', 'PCS', 'SET'].includes(cleaned)) return cleaned;
  return 'KG';
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

function extractSize(value: string): string {
  const text = (value ?? '').trim().toUpperCase();
  const m = text.match(/(\d{2})$/);
  return m?.[1] ?? '';
}

function buildSepatuItem(col0: string, col1: string, subCategory: string) {
  const source = (col0 || col1 || '').trim().toUpperCase();
  const size = extractSize(source);
  const sub = titleCaseWords(subCategory).toUpperCase();
  if (!size) return { code: '', subCategory: null as string | null };
  if (sub.includes('PENARI'))
    return { code: `PN${size}`, subCategory: 'Penari' };
  if (sub.includes('PASUKAN'))
    return { code: `PS${size}`, subCategory: 'Pasukan' };
  if (sub.includes('PUTRI'))
    return { code: `MYI${size}`, subCategory: 'Mayoret Putri' };
  if (sub.includes('PUTRA'))
    return { code: `MYA${size}`, subCategory: 'Mayoret Putra' };
  return {
    code: normalizeCode(col1 || col0),
    subCategory: titleCaseWords(subCategory) || null,
  };
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
  if (n.includes('JAMUR') || n.includes('ELASTIS') || sub.includes('ELASTIS'))
    return 'Elastis';

  if (raw) return raw;
  if (n.includes('JARUM') || c.startsWith('JR')) return 'Jarum';
  if (n.includes('BENANG') || c.startsWith('BB') || c.startsWith('BM'))
    return 'Benang';
  if (n.includes('PELES') || n.includes('BENDERA')) return 'Kain Peles';
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
    /^PS\d{2}$/i.test(c) ||
    c.startsWith('MYI') ||
    c.startsWith('MYA')
  ) {
    return 'Sepatu';
  }

  return 'Lainnya';
}

function shouldForcePcs(
  category: string,
  subCategory: string | null,
  code: string,
  name: string,
): boolean {
  const cat = category.toLowerCase();
  const sub = (subCategory ?? '').toLowerCase();
  const c = code.toUpperCase();
  const n = name.toUpperCase();

  if (cat === 'jarum' || cat === 'benang' || cat === 'karton') return true;
  if (cat === 'resleting') return true;
  if (cat === 'pita satin' || cat === 'pita gold' || cat === 'pita silver')
    return true;
  if (sub === 'karton') return true;
  if (n.includes('JAMUR SILVER')) return true;
  if (/^(YE|YK|JK)\d+/i.test(c) || /^JPH\d+/i.test(c) || /^JPP\d+/i.test(c))
    return true;
  return false;
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

  try {
    const workbookPath = path.join(
      __dirname,
      '../../doc/MARET 2026 - PERSEDIAAN KONVEKSI IAS PRODUCTAMA INDONESIA new.xlsx',
    );
    const workbook = XLSX.readFile(workbookPath);
    const sheet = workbook.Sheets['REKAP PERSEDIAAN'];
    if (!sheet) throw new Error('Sheet REKAP PERSEDIAAN tidak ditemukan');

    const rows = XLSX.utils.sheet_to_json<Array<string | number>>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    const expected = new Map<string, ExpectedItem>();

    let currentCategory = '';
    let currentSubCategory = '';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      const col0 = toText(row?.[0]).trim();
      const col1 = toText(row?.[1]).trim();
      const col6 = row?.[6];

      if (!col0 && !col1) continue;
      if (/^NAMA BARANG$/i.test(col0) || /^CODE$/i.test(col1)) continue;

      const likelyItemWithEmptyCodeColumn =
        !col1 &&
        !!col0 &&
        (isItemCodeLike(col0) || !!extractCodeFromName(col0));
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
        if (currentCategory) currentSubCategory = titleCaseWords(header);
        continue;
      }

      const isSepatuCategory = /SEPATU/i.test(currentCategory);

      let code = '';
      let subCategory: string | null = currentSubCategory || null;
      if (isSepatuCategory) {
        const sepatu = buildSepatuItem(col0, col1, currentSubCategory);
        code = sepatu.code;
        subCategory = sepatu.subCategory;
      } else {
        const codeFromCol1 = isCodeLike(col1) ? col1 : '';
        const codeFromName = codeFromCol1 ? '' : extractCodeFromName(col0);
        code = normalizeCode(codeFromCol1 || codeFromName || col0);
      }

      const key = normalizeKey(code);
      if (!key) continue;

      const nameForCategory = normalizeHeaderLabel(col0 || code);
      const category = isSepatuCategory
        ? 'Sepatu'
        : resolveCategory(code, nameForCategory, currentCategory, subCategory);
      const baseUnit = isSepatuCategory ? 'SET' : normalizeUnit(col6);
      const unit = shouldForcePcs(category, subCategory, code, nameForCategory)
        ? 'PCS'
        : baseUnit;

      const prev = expected.get(key);
      if (!prev) {
        expected.set(key, { key, code, category, subCategory, unit });
      } else if (prev.category !== 'Elastis' && category === 'Elastis') {
        expected.set(key, { key, code, category, subCategory, unit });
      }
    }

    const dbItems = await prisma.convectionItem.findMany({
      include: {
        _count: { select: { inboundLines: true, outboundLines: true } },
      },
      orderBy: { code: 'asc' },
    });

    const dbByKey = new Map<string, (typeof dbItems)[number]>();
    for (const item of dbItems) {
      const key = normalizeKey(item.code);
      if (!dbByKey.has(key)) dbByKey.set(key, item);
    }

    let updated = 0;
    let deleted = 0;
    const blockedDeletes: string[] = [];

    for (const exp of expected.values()) {
      const actual = dbByKey.get(exp.key);
      if (!actual) continue;

      const needCategory = (actual.category ?? '').trim() !== exp.category;
      const needSubCategory =
        (actual.subCategory ?? null) !== (exp.subCategory ?? null);
      const needUnit = (actual.unit ?? '').trim().toUpperCase() !== exp.unit;

      if (needCategory || needSubCategory || needUnit) {
        await prisma.convectionItem.update({
          where: { code: actual.code },
          data: {
            category: exp.category,
            subCategory: exp.subCategory,
            unit: exp.unit,
          },
        });
        updated++;
      }
    }

    const expectedKeys = new Set(expected.keys());
    const extras = dbItems.filter(
      (x) => !expectedKeys.has(normalizeKey(x.code)),
    );

    for (const extra of extras) {
      const hasTxn =
        (extra._count.inboundLines ?? 0) > 0 ||
        (extra._count.outboundLines ?? 0) > 0;
      if (hasTxn) {
        blockedDeletes.push(extra.code);
        continue;
      }
      await prisma.convectionItem.delete({ where: { code: extra.code } });
      deleted++;
    }

    console.log(
      JSON.stringify(
        {
          expectedFromRekap: expected.size,
          dbBefore: dbItems.length,
          updated,
          deletedExtras: deleted,
          blockedDeleteByTransactions: blockedDeletes.length,
          blockedCodes: blockedDeletes.slice(0, 80),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
