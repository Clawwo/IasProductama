import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const CANONICAL_RAW_CATEGORY = 'Bahan Baku';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set. Please add it to server/.env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: url,
    ssl:
      process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
        ? { rejectUnauthorized: false }
        : undefined,
  });

  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const items = await prisma.item.findMany({
      where: {
        category: {
          equals: 'Bahan baku',
          mode: 'insensitive',
        },
      },
      orderBy: { code: 'asc' },
    });

    console.log(`Found ${items.length} Item rows in category "Bahan baku"`);

    let created = 0;
    let updated = 0;

    for (const item of items) {
      const exists = await prisma.bahanBaku.findUnique({
        where: { code: item.code },
        select: { code: true },
      });

      if (!exists) {
        await prisma.bahanBaku.create({
          data: {
            code: item.code,
            name: item.name,
            category: CANONICAL_RAW_CATEGORY,
            subCategory: item.subCategory,
            kind: item.kind,
            stock: item.stock ?? 0,
          },
        });
        created++;
        continue;
      }

      await prisma.bahanBaku.update({
        where: { code: item.code },
        data: {
          name: item.name ?? undefined,
          category: CANONICAL_RAW_CATEGORY,
          subCategory: item.subCategory ?? undefined,
          kind: item.kind ?? undefined,
          // Stock intentionally not overwritten on existing BahanBaku rows.
        },
      });
      updated++;
    }

    console.log(`Done. Created: ${created}, Updated: ${updated}`);
  } finally {
    await prisma.$disconnect().catch(() => {});
    await pool.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Failed to sync BahanBaku from Item', err);
  process.exit(1);
});
