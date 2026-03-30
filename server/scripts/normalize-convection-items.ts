import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

function normalizeItemCode(value: string): string {
  const upper = (value ?? '').trim().toUpperCase();
  const firstChunk = upper.split(/\s*[-:]\s*/)[0] ?? '';
  return firstChunk.replace(/[^A-Z0-9]/g, '');
}

function normalizeItemName(
  value: string | null | undefined,
  code: string,
): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  let candidate = trimmed;
  if (code) {
    const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${escapedCode}\\s*[-:]?\\s*`, 'i');
    const cleaned = trimmed.replace(re, '').trim();
    if (cleaned) {
      candidate = cleaned;
    }
  }

  const genericPrefix = /^[A-Z0-9]{2,12}\s*[-:]\s*/i;
  const cleanedGeneric = candidate.replace(genericPrefix, '').trim();
  return cleanedGeneric || candidate;
}

function normalizeUnit(value: string | null | undefined): string {
  const cleaned = (value ?? '').trim().toUpperCase();
  if (!cleaned) return 'KG';
  if (cleaned === 'PASANG') return 'SET';
  if (cleaned === 'M' || cleaned === 'METERS' || cleaned === 'MTR')
    return 'METER';
  if (cleaned === 'PC' || cleaned === 'PIECE' || cleaned === 'PIECES')
    return 'PCS';
  if (cleaned === 'OZ' || cleaned === 'ONZ') return 'ONS';
  return cleaned;
}

function shouldForcePcsUnit(
  category: string | null | undefined,
  subCategory: string | null | undefined,
  name: string | null | undefined,
): boolean {
  const cat = (category ?? '').trim().toLowerCase();
  const sub = (subCategory ?? '').trim().toLowerCase();
  const itemName = (name ?? '').trim().toLowerCase();

  if (cat === 'jarum' || cat === 'benang') return true;
  if (cat === 'resleting') return true;
  if (cat === 'karton' || sub === 'karton') return true;
  if (cat === 'pita satin' || cat === 'pita gold' || cat === 'pita silver')
    return true;
  if (itemName.includes('jamur silver')) return true;

  return false;
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

function resolveCanonicalCategory(
  code: string,
  name: string | null | undefined,
  existing?: string | null,
): string {
  const c = (code ?? '').toUpperCase().trim();
  const n = (name ?? '').toUpperCase().trim();
  const e = normalizeCategoryAlias(existing).toUpperCase();
  const combined = `${c} ${n} ${e}`;

  if (/^PTG[\d.]*CM?$/.test(c) || combined.includes('PITA GOLD'))
    return 'Pita Gold';
  if (/^PTS[\d.]*CM?$/.test(c) || combined.includes('PITA SATIN'))
    return 'Pita Satin';
  if (/^PTV[\d.]*CM?$/.test(c) || combined.includes('PITA SILVER'))
    return 'Pita Silver';

  if (
    combined.includes('RESLETING') ||
    /^(YE|YK|JK)\d+/i.test(c) ||
    /^JPH\d+/i.test(c) ||
    /^JPP\d+/i.test(c)
  ) {
    return 'Resleting';
  }

  if (combined.includes('JAMUR') || combined.includes('ELASTIS'))
    return 'Elastis';
  if (/^SIZE\s*/i.test(c) || /^SIZE\s*/i.test(n)) return 'Sepatu';
  if (
    combined.includes('SEPATU') ||
    /^PS\d{2}$/i.test(c) ||
    c.startsWith('PN') ||
    c.startsWith('MYA') ||
    c.startsWith('MYI')
  )
    return 'Sepatu';
  if (combined.includes('JARUM') || c.startsWith('JR')) return 'Jarum';
  if (combined.includes('BENANG') || c.startsWith('BB') || c.startsWith('BM'))
    return 'Benang';
  if (combined.includes('KARTON') || c.startsWith('K')) return 'Karton';
  if (combined.includes('PELES') || combined.includes('BENDERA'))
    return 'Kain Peles';

  const fallback = normalizeCategoryAlias(existing);
  return fallback || 'Lainnya';
}

function resolveCanonicalSubCategory(
  code: string,
  name: string | null | undefined,
  category: string,
): string | null {
  const c = (code ?? '').toUpperCase().trim();
  const n = (name ?? '').toUpperCase().trim();
  const cat = (category ?? '').toUpperCase().trim();

  if (cat === 'KAIN PELES') {
    if (
      n.includes('RESLETING') ||
      /^(YE|YK|JK)\d+/i.test(c) ||
      /^JPH\d+/i.test(c) ||
      /^JPP\d+/i.test(c)
    ) {
      return 'Resleting';
    }
  }

  if (cat === 'RESLETING') return null;

  return null;
}

function resolveConvectionCategory(
  code: string,
  name: string,
  existing?: string | null,
): string {
  return resolveCanonicalCategory(code, name, existing);
}

function resolveCategoryFromKeywords(
  code: string,
  name: string | null | undefined,
): string | null {
  const key = `${code ?? ''} ${name ?? ''}`.toUpperCase();
  if (key.includes('JAMUR') || key.includes('ELASTIS')) return 'Elastis';
  if (
    key.includes('RESLETING') ||
    /\b(YE|YK|JK)\d+/i.test(key) ||
    /\bJPH\d+/i.test(key) ||
    /\bJPP\d+/i.test(key)
  ) {
    return 'Resleting';
  }
  if (key.includes('PITA GOLD')) return 'Pita Gold';
  if (key.includes('PITA SILVER')) return 'Pita Silver';
  if (key.includes('PITA SATIN')) return 'Pita Satin';
  if (key.includes('JARUM') || key.includes(' JR')) return 'Jarum';
  if (key.includes('BENANG')) return 'Benang';
  if (key.includes('KARTON')) return 'Karton';
  return null;
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
    const items = await prisma.convectionItem.findMany({
      orderBy: { code: 'asc' },
    });

    let updated = 0;
    let skippedCode = 0;

    for (const item of items) {
      const normalizedCode = normalizeItemCode(item.code);
      const normalizedName = normalizeItemName(item.name, item.code);
      const normalizedCategory = resolveConvectionCategory(
        item.code,
        normalizedName || item.name || '',
        item.category,
      );

      if (!normalizedName) {
        console.warn(`Skip ${item.code}: name empty after normalization`);
        continue;
      }

      if (normalizedCode && normalizedCode !== item.code) {
        // Code is primary key and may be referenced by transaction lines, so skip auto-rename.
        skippedCode++;
      }

      const nextUnit = shouldForcePcsUnit(
        normalizedCategory,
        item.subCategory,
        normalizedName,
      )
        ? 'PCS'
        : normalizeUnit(item.unit);
      const nextSubCategory = resolveCanonicalSubCategory(
        item.code,
        normalizedName,
        normalizedCategory,
      );
      const shouldUpdate =
        (item.name ?? '') !== normalizedName ||
        (item.category ?? '') !== normalizedCategory ||
        (item.unit ?? '') !== nextUnit ||
        item.subCategory !== nextSubCategory;

      if (!shouldUpdate) continue;

      await prisma.convectionItem.update({
        where: { code: item.code },
        data: {
          name: normalizedName,
          category: normalizedCategory,
          subCategory: nextSubCategory,
          unit: nextUnit,
        },
      });
      updated++;
    }

    // Second pass: force-resolve any remaining uncategorized records.
    const unresolved = await prisma.convectionItem.findMany({
      where: { category: { equals: 'Lainnya', mode: 'insensitive' } },
      select: { code: true, name: true, unit: true },
    });

    for (const item of unresolved) {
      const inferred = resolveCategoryFromKeywords(item.code, item.name);
      if (!inferred) continue;

      await prisma.convectionItem.update({
        where: { code: item.code },
        data: {
          category: inferred,
          unit: shouldForcePcsUnit(inferred, null, item.name)
            ? 'PCS'
            : item.unit,
        },
      });
      updated++;
    }

    console.log(
      `Normalized convection items: updated=${updated}, skippedCodeRename=${skippedCode}, total=${items.length}`,
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
