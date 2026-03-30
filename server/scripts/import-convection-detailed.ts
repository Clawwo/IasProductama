import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as XLSX from 'xlsx';
import * as path from 'path';
import { mkdirSync, writeFileSync } from 'fs';

type ImportReport = {
  sourceFile: string;
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  renamedPasangToSet: number;
  byUnit: Record<string, number>;
  byCategory: Record<string, number>;
  bySubCategory: Record<string, number>;
  samples: Array<{
    code: string;
    name: string;
    category: string;
    subCategory: string | null;
    unit: string;
    stockBase: number;
    metersPerKg: number | null;
  }>;
  sepatuSamples: Array<{
    code: string;
    name: string;
    category: string;
    subCategory: string | null;
    unit: string;
    stockBase: number;
  }>;
  sepatuSamplesBySubCategory: Record<
    string,
    Array<{
      code: string;
      name: string;
      category: string;
      subCategory: string | null;
      unit: string;
      stockBase: number;
    }>
  >;
};

function toNumber(value: unknown): number {
  const num = Number(
    String(value ?? '')
      .replace(',', '.')
      .trim(),
  );
  return Number.isFinite(num) ? num : 0;
}

function isCodeLike(value: string): boolean {
  const text = (value ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{2,10}$/.test(text);
}

function isItemCodeLike(value: string): boolean {
  const text = (value ?? '').trim().toUpperCase();
  if (isCodeLike(text) && /\d/.test(text)) return true;
  // Handle dotted code labels from REKAP like PTG1.5CM / PTS2.5CM / PTV1.5CM
  return /^(PTG|PTS|PTV)\d+(\.\d+)?CM$/i.test(text);
}

function extractCodeFromName(value: string): string {
  const text = (value ?? '').trim().toUpperCase();
  const match = text.match(/^([A-Z0-9]{2,10})\s*-/);
  return match?.[1] ?? '';
}

function normalizeHeaderLabel(value: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\s+/g, ' ');
}

function isMainCategoryHeader(value: string): boolean {
  const text = normalizeHeaderLabel(value).toUpperCase();
  if (!text) return false;
  if (text.includes('KAIN')) return true;
  if (text.includes('BULU')) return true;
  if (text.includes('JARUM')) return true;
  if (text.includes('BENANG')) return true;
  if (text.includes('KARTON')) return true;
  if (text.includes('MAYORET')) return true;
  if (text.includes('SEPATU')) return true;
  if (text.includes('PITA')) return true;
  return false;
}

function buildDetailedName(
  baseName: string,
  category: string,
  subCategory: string,
  code: string,
): string {
  const name = normalizeHeaderLabel(baseName);
  const categoryLabel = normalizeHeaderLabel(category);
  const sub = normalizeHeaderLabel(subCategory);

  if (!name) {
    if (sub && code) return `${sub} ${code}`;
    if (categoryLabel && code) return `${categoryLabel} ${code}`;
    return code;
  }

  if (!sub) return name;

  const lowerName = name.toLowerCase();
  const lowerSub = sub.toLowerCase();
  if (lowerName.includes(lowerSub)) return name;

  // Keep naming predictable like Sepatu pattern: clear token + detail.
  if (
    lowerSub.includes('karton') ||
    lowerSub.includes('resleting') ||
    lowerSub.includes('pita')
  ) {
    return `${sub} ${name}`;
  }
  return `${name} ${sub}`;
}

function extractSize(value: string): string {
  const text = (value ?? '').trim().toUpperCase();
  const m = text.match(/(\d{2})$/);
  return m?.[1] ?? '';
}

function buildSepatuItem(
  col0: string,
  col1: string,
  subCategory: string,
): { code: string; name: string; subCategory: string } {
  const source = (col0 || col1 || '').trim().toUpperCase();
  const size = extractSize(source);
  const sub = titleCaseWords(subCategory);
  if (!size) return { code: '', name: '', subCategory: sub };

  const normalizedSub = sub.toUpperCase();
  if (normalizedSub.includes('PENARI')) {
    return { code: `PN${size}`, name: `Penari${size}`, subCategory: 'Penari' };
  }
  if (normalizedSub.includes('PASUKAN')) {
    return {
      code: `PS${size}`,
      name: `Pasukan${size}`,
      subCategory: 'Pasukan',
    };
  }
  if (normalizedSub.includes('PUTRI')) {
    return {
      code: `MYI${size}`,
      name: `Mayoret Putri${size}`,
      subCategory: 'Mayoret Putri',
    };
  }
  if (normalizedSub.includes('PUTRA')) {
    return {
      code: `MYA${size}`,
      name: `Mayoret Putra${size}`,
      subCategory: 'Mayoret Putra',
    };
  }

  return {
    code: normalizeCode(col1 || col0),
    name: normalizeHeaderLabel(col0),
    subCategory: sub,
  };
}

function titleCaseWords(value: string | null | undefined): string {
  const text = (value ?? '').trim().toLowerCase();
  if (!text) return '';
  return text.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function normalizeCategoryAlias(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  const upper = raw.toUpperCase();
  if (!upper) return '';

  if (/^(B\.?\s*)?SEPATU$/i.test(upper)) return 'Sepatu';
  if (/^PTG\d*$/i.test(upper) || upper === 'PITA GOLD') return 'Pita Gold';
  if (/^PTS\d*$/i.test(upper) || upper === 'PITA SATIN') return 'Pita Satin';
  if (/^PTV\d*$/i.test(upper) || upper === 'PITA SILVER') return 'Pita Silver';
  if (upper === 'KARTON') return 'Karton';
  if (upper === 'JARUM') return 'Jarum';
  if (upper === 'BENANG') return 'Benang';
  if (upper === 'ELASTIS') return 'Elastis';
  if (upper === 'RESLETING') return 'Resleting';

  return titleCaseWords(raw);
}

function normalizeCode(value: unknown): string {
  const upper = String(value ?? '')
    .trim()
    .toUpperCase();
  const firstChunk = upper.split(/\s*[-:]\s*/)[0] ?? '';
  return firstChunk.replace(/[^A-Z0-9]/g, '');
}

function normalizeName(value: unknown, code: string): string {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  let candidate = trimmed;
  if (code) {
    const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${escapedCode}\\s*[-:]?\\s*`, 'i');
    const cleanedByExactCode = trimmed.replace(re, '').trim();
    if (cleanedByExactCode) {
      candidate = cleanedByExactCode;
    }
  }

  // Fallback: strip any leading code token from sheet labels like "OD01 - ...".
  const genericPrefix = /^[A-Z0-9]{2,12}\s*[-:]\s*/i;
  const cleanedGeneric = candidate.replace(genericPrefix, '').trim();
  return cleanedGeneric || candidate;
}

function normalizeUnit(value: unknown): string {
  const cleaned = String(value ?? '')
    .trim()
    .toUpperCase();
  if (!cleaned) return 'KG';
  if (cleaned === 'PASANG') return 'SET';
  if (cleaned === 'M' || cleaned === 'MTR' || cleaned === 'METERS')
    return 'METER';
  if (cleaned === 'PC' || cleaned === 'PIECE' || cleaned === 'PIECES')
    return 'PCS';
  if (cleaned === 'OZ' || cleaned === 'ONZ') return 'ONS';
  if (
    cleaned === 'ONS' ||
    cleaned === 'KG' ||
    cleaned === 'METER' ||
    cleaned === 'PCS' ||
    cleaned === 'SET'
  ) {
    return cleaned;
  }
  return 'KG';
}

function shouldForcePcsUnit(
  category: string,
  subCategory: string | null,
  name: string,
): boolean {
  const cat = (category ?? '').trim().toLowerCase();
  const sub = (subCategory ?? '').trim().toLowerCase();
  const itemName = (name ?? '').trim().toLowerCase();

  if (cat === 'jarum' || cat === 'benang') return true;
  if (cat === 'karton' || sub === 'karton') return true;
  if (cat === 'pita satin' || cat === 'pita gold' || cat === 'pita silver') {
    return true;
  }
  if (itemName.includes('jamur silver')) return true;

  return false;
}

function resolveCategory(
  code: string,
  name: string,
  rawCategory: unknown,
  rawSubCategory: string | null,
): string {
  const c = code.toUpperCase();
  const n = name.toUpperCase();
  const raw = normalizeCategoryAlias(String(rawCategory ?? ''));
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
  if (n.includes('PITA GOLD')) return 'Pita Gold';
  if (n.includes('PITA SILVER')) return 'Pita Silver';
  if (n.includes('PITA SATIN')) return 'Pita Satin';
  if (n.includes('JARUM') || c.startsWith('JR')) return 'Jarum';
  if (n.includes('BENANG') || c.startsWith('BB') || c.startsWith('BM'))
    return 'Benang';
  if (n.includes('VINYL') || c.startsWith('V')) return 'Vinyl';
  if (n.includes('PELES') || n.includes('BENDERA') || c.startsWith('PS'))
    return 'Kain Peles';
  if (n.includes('SATIN')) return 'Kain Satin';
  if (n.includes('50F') || c.startsWith('KK50F')) return 'Kain Keras 50F';
  if (n.includes('50N') || c.startsWith('KK50N')) return 'Kain Keras 50N';
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

  return 'Lainnya';
}

function getMetersPerKg(category: string, name: string): number | null {
  const text = `${category} ${name}`.toUpperCase();
  if (text.includes('SATIN')) return 6.45;
  if (text.includes('50F')) return 11.5;
  if (text.includes('50N')) return 12.3;
  if (text.includes('PELES') || text.includes('BENDERA')) return 10;
  if (text.includes('VINYL')) return 1 / 0.6;
  if (text.includes('DRILL') || text.includes('DRIL')) return 3.3;
  return null;
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
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

  if (!rekapSheet) {
    throw new Error('Sheet REKAP PERSEDIAAN tidak ditemukan');
  }
  const rekapRows = XLSX.utils.sheet_to_json<Array<string | number>>(
    rekapSheet,
    {
      header: 1,
      defval: '',
      raw: false,
    },
  );

  const existing = await prisma.convectionItem.findMany({
    select: { code: true },
  });
  const existingSet = new Set(existing.map((x) => x.code));

  const report: ImportReport = {
    sourceFile: workbookPath,
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    renamedPasangToSet: 0,
    byUnit: {},
    byCategory: {},
    bySubCategory: {},
    samples: [],
    sepatuSamples: [],
    sepatuSamplesBySubCategory: {},
  };

  try {
    let currentCategory = '';
    let currentSubCategory = '';

    for (let i = 0; i < rekapRows.length; i++) {
      const row = rekapRows[i] as unknown[];
      const col0 = String(row?.[0] ?? '').trim();
      const col1 = String(row?.[1] ?? '').trim();
      const col5 = row?.[5];
      const col6 = row?.[6];

      if (!col0 && !col1) continue;
      if (/^NAMA BARANG$/i.test(col0) || /^CODE$/i.test(col1)) continue;

      const likelyItemWithEmptyCodeColumn =
        !col1 &&
        !!col0 &&
        (isItemCodeLike(col0) || !!extractCodeFromName(col0));

      if (!col1 && col0 && !likelyItemWithEmptyCodeColumn) {
        const header = normalizeHeaderLabel(col0);

        // While parsing Sepatu section, every header row is a subgroup (Pasukan, Penari, Mayoret Putri/Putra).
        if (/SEPATU/i.test(currentCategory)) {
          currentSubCategory = titleCaseWords(header);
          continue;
        }

        if (isMainCategoryHeader(header)) {
          currentCategory = titleCaseWords(header);
          currentSubCategory = '';
          continue;
        }

        // Second-level header under the same category (e.g., Best Quality, Takayama, LTR).
        if (currentCategory) {
          currentSubCategory = titleCaseWords(header);
        }
        continue;
      }

      const isSepatuCategory = /SEPATU/i.test(currentCategory);

      const codeFromCol1 = isCodeLike(col1) ? col1 : '';
      const codeFromName = codeFromCol1 ? '' : extractCodeFromName(col0);

      let code = normalizeCode(codeFromCol1 || codeFromName);
      let name = '';
      let subCategory = currentSubCategory || null;

      if (isSepatuCategory) {
        const sepatu = buildSepatuItem(col0, col1, currentSubCategory);
        code = sepatu.code;
        name = sepatu.name;
        subCategory = sepatu.subCategory || null;
      } else {
        const rawName = col0;
        const rawBaseName = normalizeName(rawName, code);
        name = normalizeHeaderLabel(rawBaseName);
      }

      const rawUnit = isSepatuCategory ? 'SET' : normalizeUnit(col6);
      if (
        String(col6 ?? '')
          .trim()
          .toUpperCase() === 'PASANG'
      ) {
        report.renamedPasangToSet++;
      }

      const category = isSepatuCategory
        ? 'Sepatu'
        : resolveCategory(code, name, currentCategory, subCategory);
      if (!isSepatuCategory) {
        name = buildDetailedName(name, category, subCategory ?? '', code);
      }

      if (!code || !name) {
        report.skipped++;
        continue;
      }

      const unit = shouldForcePcsUnit(category, subCategory, name)
        ? 'PCS'
        : rawUnit;
      const metersPerKg = getMetersPerKg(category, name);
      const stockBase = isSepatuCategory
        ? Math.trunc(toNumber(col5))
        : toNumber(col5);

      await prisma.convectionItem.upsert({
        where: { code },
        create: {
          code,
          name,
          category,
          unit,
          subCategory,
          metersPerKg,
          stockBase,
        },
        update: {
          name,
          category,
          unit,
          subCategory,
          metersPerKg,
          stockBase,
        },
      });

      report.processed++;
      report.byUnit[unit] = (report.byUnit[unit] ?? 0) + 1;
      report.byCategory[category] = (report.byCategory[category] ?? 0) + 1;
      if (subCategory) {
        report.bySubCategory[subCategory] =
          (report.bySubCategory[subCategory] ?? 0) + 1;
      }

      if (existingSet.has(code)) report.updated++;
      else report.inserted++;

      if (report.samples.length < 30) {
        report.samples.push({
          code,
          name,
          category,
          subCategory,
          unit,
          stockBase,
          metersPerKg,
        });
      }

      if (category === 'Sepatu' && report.sepatuSamples.length < 30) {
        report.sepatuSamples.push({
          code,
          name,
          category,
          subCategory,
          unit,
          stockBase,
        });
      }

      if (category === 'Sepatu') {
        const key = (subCategory ?? 'Lainnya').trim() || 'Lainnya';
        if (!report.sepatuSamplesBySubCategory[key]) {
          report.sepatuSamplesBySubCategory[key] = [];
        }
        if (report.sepatuSamplesBySubCategory[key].length < 12) {
          report.sepatuSamplesBySubCategory[key].push({
            code,
            name,
            category,
            subCategory,
            unit,
            stockBase,
          });
        }
      }
    }

    const outputDir = path.join(__dirname, 'output');
    mkdirSync(outputDir, { recursive: true });
    const outPath = path.join(outputDir, 'convection-detailed-report.json');
    writeFileSync(outPath, JSON.stringify(report, null, 2));

    console.log(
      `Import detail konveksi selesai. processed=${report.processed}, inserted=${report.inserted}, updated=${report.updated}, skipped=${report.skipped}`,
    );
    console.log(`Laporan: ${outPath}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
