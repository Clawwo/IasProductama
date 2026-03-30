import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as path from 'path';
import { mkdirSync, writeFileSync } from 'fs';

type StockStatus = 'aman' | 'menipis' | 'kritis';

type ItemRow = {
  code: string;
  name: string | null;
  category: string | null;
  subCategory: string | null;
  unit: string;
  stockBase: number;
  stockStatus: StockStatus;
  totalInboundQtyBase: number;
  totalOutboundQtyBase: number;
  movementBalance: number;
  netFlow: number;
  turnoverQtyBase: number;
  inboundLinesCount: number;
  outboundLinesCount: number;
  lastInboundDate: string | null;
  lastOutboundDate: string | null;
  updatedAt: string;
};

type CategoryDetail = {
  items: number;
  stockBase: number;
  totalInboundQtyBase: number;
  totalOutboundQtyBase: number;
  byStockStatus: Record<StockStatus, number>;
};

type Report = {
  generatedAt: string;
  scope: {
    source: 'convection';
    unit: 'PCS';
  };
  totals: {
    items: number;
    stockBase: number;
    totalInboundQtyBase: number;
    totalOutboundQtyBase: number;
    totalTurnoverQtyBase: number;
  };
  byCategory: Record<string, number>;
  bySubCategory: Record<string, number>;
  byStockStatus: Record<StockStatus, number>;
  categoryDetails: Record<string, CategoryDetail>;
  movementHighlights: {
    mostMoved: ItemRow[];
    outboundDominant: ItemRow[];
    inactiveNoMovement: ItemRow[];
  };
  topStock: ItemRow[];
  lowStock: ItemRow[];
  items: ItemRow[];
};

function stockStatusOf(stockBase: number): StockStatus {
  if (stockBase <= 0) return 'kritis';
  if (stockBase < 5) return 'menipis';
  return 'aman';
}

function addCount(bucket: Record<string, number>, key: string): void {
  bucket[key] = (bucket[key] ?? 0) + 1;
}

function addNumber(
  bucket: Record<string, number>,
  key: string,
  value: number,
): void {
  bucket[key] = (bucket[key] ?? 0) + value;
}

function toIsoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function safeCategory(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  return text || 'Tanpa Kategori';
}

function safeSubCategory(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  return text || 'Tanpa Subkategori';
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
    const rows = await prisma.convectionItem.findMany({
      where: {
        unit: { equals: 'PCS', mode: 'insensitive' },
      },
      select: {
        code: true,
        name: true,
        category: true,
        subCategory: true,
        unit: true,
        stockBase: true,
        updatedAt: true,
        inboundLines: {
          select: {
            qtyInBase: true,
            inbound: { select: { date: true } },
          },
        },
        outboundLines: {
          select: {
            qtyInBase: true,
            outbound: { select: { date: true } },
          },
        },
      },
      orderBy: [{ category: 'asc' }, { subCategory: 'asc' }, { code: 'asc' }],
    });

    const items: ItemRow[] = rows.map((row) => {
      const inboundValues = row.inboundLines.map((line) => line.qtyInBase);
      const outboundValues = row.outboundLines.map((line) => line.qtyInBase);

      const totalInboundQtyBase = inboundValues.reduce(
        (sum, qty) => sum + qty,
        0,
      );
      const totalOutboundQtyBase = outboundValues.reduce(
        (sum, qty) => sum + qty,
        0,
      );
      const turnoverQtyBase = totalInboundQtyBase + totalOutboundQtyBase;
      const movementBalance = totalInboundQtyBase - totalOutboundQtyBase;
      const netFlow = movementBalance;

      const lastInbound =
        row.inboundLines.length > 0
          ? row.inboundLines
              .map((line) => line.inbound.date)
              .sort((a, b) => b.getTime() - a.getTime())[0]
          : null;

      const lastOutbound =
        row.outboundLines.length > 0
          ? row.outboundLines
              .map((line) => line.outbound.date)
              .sort((a, b) => b.getTime() - a.getTime())[0]
          : null;

      return {
        code: row.code,
        name: row.name,
        category: row.category,
        subCategory: row.subCategory,
        unit: (row.unit ?? 'PCS').toUpperCase(),
        stockBase: row.stockBase,
        stockStatus: stockStatusOf(row.stockBase),
        totalInboundQtyBase,
        totalOutboundQtyBase,
        movementBalance,
        netFlow,
        turnoverQtyBase,
        inboundLinesCount: row.inboundLines.length,
        outboundLinesCount: row.outboundLines.length,
        lastInboundDate: toIsoOrNull(lastInbound),
        lastOutboundDate: toIsoOrNull(lastOutbound),
        updatedAt: row.updatedAt.toISOString(),
      };
    });

    const byCategory: Record<string, number> = {};
    const bySubCategory: Record<string, number> = {};
    const byStockStatus: Record<StockStatus, number> = {
      aman: 0,
      menipis: 0,
      kritis: 0,
    };

    const categoryDetails: Record<string, CategoryDetail> = {};

    for (const item of items) {
      const categoryKey = safeCategory(item.category);
      const subCategoryKey = safeSubCategory(item.subCategory);

      addCount(byCategory, categoryKey);
      addCount(bySubCategory, subCategoryKey);
      byStockStatus[item.stockStatus] += 1;

      if (!categoryDetails[categoryKey]) {
        categoryDetails[categoryKey] = {
          items: 0,
          stockBase: 0,
          totalInboundQtyBase: 0,
          totalOutboundQtyBase: 0,
          byStockStatus: { aman: 0, menipis: 0, kritis: 0 },
        };
      }

      const cat = categoryDetails[categoryKey];
      cat.items += 1;
      cat.stockBase += item.stockBase;
      cat.totalInboundQtyBase += item.totalInboundQtyBase;
      cat.totalOutboundQtyBase += item.totalOutboundQtyBase;
      cat.byStockStatus[item.stockStatus] += 1;
    }

    const totals = {
      items: items.length,
      stockBase: items.reduce((sum, item) => sum + item.stockBase, 0),
      totalInboundQtyBase: items.reduce(
        (sum, item) => sum + item.totalInboundQtyBase,
        0,
      ),
      totalOutboundQtyBase: items.reduce(
        (sum, item) => sum + item.totalOutboundQtyBase,
        0,
      ),
      totalTurnoverQtyBase: items.reduce(
        (sum, item) => sum + item.turnoverQtyBase,
        0,
      ),
    };

    const topStock = [...items]
      .sort((a, b) => b.stockBase - a.stockBase || a.code.localeCompare(b.code))
      .slice(0, 20);

    const lowStock = [...items]
      .sort((a, b) => a.stockBase - b.stockBase || a.code.localeCompare(b.code))
      .slice(0, 20);

    const mostMoved = [...items]
      .sort(
        (a, b) =>
          b.turnoverQtyBase - a.turnoverQtyBase || a.code.localeCompare(b.code),
      )
      .slice(0, 20);

    const outboundDominant = [...items]
      .filter((item) => item.totalOutboundQtyBase > item.totalInboundQtyBase)
      .sort(
        (a, b) =>
          b.totalOutboundQtyBase -
          b.totalInboundQtyBase -
          (a.totalOutboundQtyBase - a.totalInboundQtyBase),
      )
      .slice(0, 20);

    const inactiveNoMovement = [...items]
      .filter((item) => item.turnoverQtyBase === 0)
      .sort((a, b) => b.stockBase - a.stockBase || a.code.localeCompare(b.code))
      .slice(0, 20);

    const report: Report = {
      generatedAt: new Date().toISOString(),
      scope: { source: 'convection', unit: 'PCS' },
      totals,
      byCategory,
      bySubCategory,
      byStockStatus,
      categoryDetails,
      movementHighlights: {
        mostMoved,
        outboundDominant,
        inactiveNoMovement,
      },
      topStock,
      lowStock,
      items,
    };

    const outputDir = path.join(__dirname, 'output');
    mkdirSync(outputDir, { recursive: true });

    const outPath = path.join(outputDir, 'convection-pcs-detailed-report.json');
    writeFileSync(outPath, JSON.stringify(report, null, 2));

    console.log(
      `Convection PCS report generated: items=${totals.items}, stockBase=${totals.stockBase}, inbound=${totals.totalInboundQtyBase}, outbound=${totals.totalOutboundQtyBase}`,
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
