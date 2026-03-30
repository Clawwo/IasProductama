import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as XLSX from 'xlsx';
import * as path from 'path';

// Initialize Prisma with pg adapter (same pattern as PrismaService)
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL is missing; set it in your environment or .env file',
  );
}

const pool = new Pool({
  connectionString: url,
  ssl:
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
      ? { rejectUnauthorized: false }
      : undefined,
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Conversion rules from Rumus_Konveksi.md
const conversionRules: Record<string, number> = {
  'KAIN DRIL': 3.3,
  'KAIN SATIN': 6.45,
  'KAIN KERAS 50F': 11.5,
  'KAIN KERAS 50N': 12.3,
  PELES: 10,
  BENDERA: 10,
  VINYL: 1 / 0.6, // 1.667
  SQUIN: 6.67,
};

function getMetersPerKg(category: string, subCategory: string): number | null {
  const combined = `${category} ${subCategory}`.toUpperCase().trim();

  // Try exact match first
  for (const [key, value] of Object.entries(conversionRules)) {
    if (combined.includes(key)) {
      return value;
    }
  }

  // Check if it's any type of KAIN (fabric) - might need conversion
  if (category.toUpperCase().includes('KAIN')) {
    console.warn(`No conversion rule found for: ${category} ${subCategory}`);
  }

  return null;
}

async function importMasterItems() {
  console.log('📦 Importing MASTER items...');

  const excelPath = path.join(
    __dirname,
    '../../doc/MARET 2026 - PERSEDIAAN KONVEKSI IAS PRODUCTAMA INDONESIA new.xlsx',
  );
  const workbook = XLSX.readFile(excelPath);
  const masterSheet = workbook.Sheets['MASTER'];
  const masterData = XLSX.utils.sheet_to_json(masterSheet);

  console.log(`Found ${masterData.length} items in MASTER sheet`);

  let imported = 0;
  let skipped = 0;

  for (const row of masterData as any[]) {
    const code = row['Kode']?.toString().trim();
    const name = row['Nama Barang']?.toString().trim();
    const category = row['Kategori']?.toString().trim() || '';
    const subCategory = row['Sub Kategori']?.toString().trim() || '';
    const unit = row['Satuan']?.toString().trim() || 'KG';

    if (!code || !name) {
      skipped++;
      continue;
    }

    const metersPerKg = getMetersPerKg(category, subCategory);

    try {
      await prisma.convectionItem.upsert({
        where: { code },
        create: {
          code,
          name,
          category,
          subCategory,
          unit,
          metersPerKg,
          stockBase: 0, // Will be updated from REKAP
        },
        update: {
          name,
          category,
          subCategory,
          unit,
          metersPerKg,
        },
      });
      imported++;
    } catch (error) {
      console.error(`Error importing item ${code}:`, error);
      skipped++;
    }
  }

  console.log(`✅ Imported ${imported} items, skipped ${skipped}`);
}

async function importRekapStocks() {
  console.log('📊 Importing REKAP opening balances...');

  const excelPath = path.join(
    __dirname,
    '../../doc/MARET 2026 - PERSEDIAAN KONVEKSI IAS PRODUCTAMA INDONESIA new.xlsx',
  );
  const workbook = XLSX.readFile(excelPath);
  const rekapSheet = workbook.Sheets['REKAP PERSEDIAAN'];
  const rekapData = XLSX.utils.sheet_to_json(rekapSheet);

  console.log(`Found ${rekapData.length} records in REKAP sheet`);

  let updated = 0;
  let notFound = 0;

  for (const row of rekapData as any[]) {
    const code = row['Kode']?.toString().trim();
    const stokAkhir = parseFloat(row['Stok Akhir']) || 0;

    if (!code) continue;

    try {
      const item = await prisma.convectionItem.findUnique({
        where: { code },
      });

      if (!item) {
        console.warn(`Item not found in master: ${code}`);
        notFound++;
        continue;
      }

      await prisma.convectionItem.update({
        where: { code },
        data: { stockBase: stokAkhir },
      });
      updated++;
    } catch (error) {
      console.error(`Error updating stock for ${code}:`, error);
    }
  }

  console.log(`✅ Updated ${updated} stocks, ${notFound} not found in master`);
}

async function importInboundTransactions() {
  console.log('📥 Importing IN transactions...');

  const excelPath = path.join(
    __dirname,
    '../../doc/MARET 2026 - PERSEDIAAN KONVEKSI IAS PRODUCTAMA INDONESIA new.xlsx',
  );
  const workbook = XLSX.readFile(excelPath);
  const inSheet = workbook.Sheets['IN'];
  const inData = XLSX.utils.sheet_to_json(inSheet);

  console.log(`Found ${inData.length} inbound records`);

  // Group by transaction (by date and vendor)
  const transactions = new Map<string, any[]>();

  for (const row of inData as any[]) {
    const rawDate = row['Tanggal'];
    const vendor = row['Supplier']?.toString().trim() || 'Unknown';
    const code = row['Kode']?.toString().trim();
    const qty = parseFloat(row['Jumlah']) || 0;
    const unit = row['Satuan']?.toString().trim() || 'KG';
    const note = row['Keterangan']?.toString().trim() || '';

    if (!code || qty <= 0) continue;

    // Parse Excel date
    let date: Date;
    if (typeof rawDate === 'number') {
      // Excel serial date
      const parsed = XLSX.SSF.parse_date_code(rawDate) as {
        y: number;
        m: number;
        d: number;
      };
      date = new Date(parsed.y, parsed.m - 1, parsed.d);
    } else {
      date = new Date(rawDate);
    }

    if (isNaN(date.getTime())) {
      console.warn(`Invalid date for row:`, row);
      continue;
    }

    const key = `${date.toISOString().split('T')[0]}_${vendor}`;

    if (!transactions.has(key)) {
      transactions.set(key, []);
    }

    transactions.get(key)!.push({
      code,
      qty,
      unit,
      note,
      date,
      vendor,
    });
  }

  console.log(`Grouped into ${transactions.size} transactions`);

  let imported = 0;

  for (const [key, lines] of transactions) {
    const { date, vendor } = lines[0];

    try {
      // Get next sequence number for this date
      const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
      const prefix = `CONV-IN-${dateStr}`;

      const lastCode = await prisma.convectionInbound.findFirst({
        where: {
          code: { startsWith: prefix },
        },
        orderBy: { code: 'desc' },
      });

      let sequence = 1;
      if (lastCode) {
        const lastSeq = parseInt(lastCode.code.slice(-4));
        sequence = lastSeq + 1;
      }

      const code = `${prefix}-${sequence.toString().padStart(4, '0')}`;

      await prisma.convectionInbound.create({
        data: {
          code,
          date,
          vendor,
          lines: {
            create: lines.map((line) => ({
              code: line.code,
              name: '', // Will be filled by trigger or manually
              category: '',
              subCategory: '',
              qty: line.qty,
              qtyInBase: line.qty, // Simplified - actual conversion should be computed
              unit: line.unit,
              note: line.note,
            })),
          },
        },
      });

      imported++;
    } catch (error) {
      console.error(`Error importing transaction ${key}:`, error);
    }
  }

  console.log(`✅ Imported ${imported} inbound transactions`);
}

async function importOutboundTransactions() {
  console.log('📤 Importing OUT transactions...');

  const excelPath = path.join(
    __dirname,
    '../../doc/MARET 2026 - PERSEDIAAN KONVEKSI IAS PRODUCTAMA INDONESIA new.xlsx',
  );
  const workbook = XLSX.readFile(excelPath);
  const outSheet = workbook.Sheets['OUT'];
  const outData = XLSX.utils.sheet_to_json(outSheet);

  console.log(`Found ${outData.length} outbound records`);

  // Group by transaction
  const transactions = new Map<string, any[]>();

  for (const row of outData as any[]) {
    const rawDate = row['Tanggal'];
    const receiver = row['Penerima']?.toString().trim() || 'Unknown';
    const code = row['Kode']?.toString().trim();
    const qty = parseFloat(row['Jumlah']) || 0;
    const unit = row['Satuan']?.toString().trim() || 'KG';
    const note = row['Keterangan']?.toString().trim() || '';

    if (!code || qty <= 0) continue;

    // Parse Excel date
    let date: Date;
    if (typeof rawDate === 'number') {
      const parsed = XLSX.SSF.parse_date_code(rawDate) as {
        y: number;
        m: number;
        d: number;
      };
      date = new Date(parsed.y, parsed.m - 1, parsed.d);
    } else {
      date = new Date(rawDate);
    }

    if (isNaN(date.getTime())) {
      console.warn(`Invalid date for row:`, row);
      continue;
    }

    const key = `${date.toISOString().split('T')[0]}_${receiver}`;

    if (!transactions.has(key)) {
      transactions.set(key, []);
    }

    transactions.get(key)!.push({
      code,
      qty,
      unit,
      note,
      date,
      receiver,
    });
  }

  console.log(`Grouped into ${transactions.size} transactions`);

  let imported = 0;

  for (const [key, lines] of transactions) {
    const { date, receiver } = lines[0];

    try {
      const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
      const prefix = `CONV-OUT-${dateStr}`;

      const lastCode = await prisma.convectionOutbound.findFirst({
        where: {
          code: { startsWith: prefix },
        },
        orderBy: { code: 'desc' },
      });

      let sequence = 1;
      if (lastCode) {
        const lastSeq = parseInt(lastCode.code.slice(-4));
        sequence = lastSeq + 1;
      }

      const code = `${prefix}-${sequence.toString().padStart(4, '0')}`;

      await prisma.convectionOutbound.create({
        data: {
          code,
          date,
          receiver,
          lines: {
            create: lines.map((line) => ({
              code: line.code,
              name: '',
              category: '',
              subCategory: '',
              qty: line.qty,
              qtyInBase: line.qty,
              unit: line.unit,
              note: line.note,
            })),
          },
        },
      });

      imported++;
    } catch (error) {
      console.error(`Error importing transaction ${key}:`, error);
    }
  }

  console.log(`✅ Imported ${imported} outbound transactions`);
}

async function main() {
  try {
    console.log('🚀 Starting convection data import...\n');

    // Step 1: Import master items with conversion rules
    await importMasterItems();
    console.log('');

    // Step 2: Import opening balances from REKAP
    await importRekapStocks();
    console.log('');

    // Step 3: Import inbound transactions
    await importInboundTransactions();
    console.log('');

    // Step 4: Import outbound transactions
    await importOutboundTransactions();
    console.log('');

    console.log('✨ Import completed successfully!');
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
