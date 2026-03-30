import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

type CodeRemap = {
  from: string;
  to: string;
};

const REMAPS: CodeRemap[] = [
  { from: 'YEE20', to: 'YE20' },
  { from: 'YEE22', to: 'YE22' },
];

async function remapCode(prisma: PrismaClient, map: CodeRemap) {
  const source = await prisma.convectionItem.findUnique({
    where: { code: map.from },
  });
  const target = await prisma.convectionItem.findUnique({
    where: { code: map.to },
  });

  if (!source || !target) {
    return {
      from: map.from,
      to: map.to,
      status: 'skipped-missing' as const,
      movedInbound: 0,
      movedOutbound: 0,
      movedStockBase: 0,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const inboundUpdated = await tx.convectionInboundLine.updateMany({
      where: { code: map.from },
      data: {
        code: map.to,
        name: target.name ?? source.name,
        category: target.category,
        subCategory: target.subCategory,
        unit: target.unit,
      },
    });

    const outboundUpdated = await tx.convectionOutboundLine.updateMany({
      where: { code: map.from },
      data: {
        code: map.to,
        name: target.name ?? source.name,
        category: target.category,
        subCategory: target.subCategory,
        unit: target.unit,
      },
    });

    await tx.convectionItem.update({
      where: { code: map.to },
      data: { stockBase: { increment: source.stockBase } },
    });

    await tx.convectionItem.delete({ where: { code: map.from } });

    return {
      movedInbound: inboundUpdated.count,
      movedOutbound: outboundUpdated.count,
      movedStockBase: source.stockBase,
    };
  });

  return {
    from: map.from,
    to: map.to,
    status: 'remapped' as const,
    ...result,
  };
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
    const results = [] as Array<Awaited<ReturnType<typeof remapCode>>>;

    for (const map of REMAPS) {
      results.push(await remapCode(prisma, map));
    }

    console.log(
      JSON.stringify({ remapsTried: REMAPS.length, results }, null, 2),
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
