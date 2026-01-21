import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';

config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is missing; cannot query products');
  }

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const total = await prisma.product.count();

    const dupCodeRaw = await prisma.$queryRawUnsafe<{ code: string; cnt: bigint }[]>(
      'SELECT code, COUNT(*) AS cnt FROM "Product" GROUP BY code HAVING COUNT(*) > 1 ORDER BY cnt DESC, code ASC LIMIT 20',
    );

    const dupNameRaw = await prisma.$queryRawUnsafe<{ name: string | null; cnt: bigint }[]>(
      "SELECT COALESCE(name, '(null)') AS name, COUNT(*) AS cnt FROM \"Product\" GROUP BY name HAVING COUNT(*) > 1 ORDER BY cnt DESC, name ASC LIMIT 20",
    );

    const dupCode = dupCodeRaw.map((row) => ({ code: row.code, cnt: Number(row.cnt) }));
    const dupName = dupNameRaw.map((row) => ({ name: row.name, cnt: Number(row.cnt) }));

    const examples = await prisma.product.findMany({
      take: 10,
      orderBy: { code: 'asc' },
      select: { code: true, name: true, category: true, subCategory: true },
    });

    console.log(
      JSON.stringify(
        {
          total,
          duplicateCodes: dupCode,
          duplicateNames: dupName,
          sample: examples,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
