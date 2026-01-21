import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const ssl =
  process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
    ? { rejectUnauthorized: false }
    : undefined;

const pool = new Pool({ connectionString, ssl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const bom = await prisma.bom.findFirst({
    orderBy: { productCode: 'asc' },
    include: { lines: { orderBy: { name: 'asc' } } },
  });
  if (!bom) {
    console.log('No BOM found');
    return;
  }

  const output = {
    productCode: bom.productCode,
    productName: bom.productName,
    category: bom.category,
    lines: bom.lines.map((l) => ({
      sourceType: l.sourceType,
      code: l.code,
      name: l.name,
      qty: l.qty,
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
