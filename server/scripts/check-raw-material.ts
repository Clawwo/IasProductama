import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const code = process.argv[2] || 'BB-RING-HTS-10-LITE-3-RJHOXR';
  console.log('Checking BahanBaku with code:', code);
  const bb = await prisma.bahanBaku.findUnique({ where: { code } });
  if (!bb) {
    console.log('NOT FOUND');
  } else {
    console.log('FOUND:', { code: bb.code, name: bb.name, category: bb.category, subCategory: bb.subCategory, kind: bb.kind, stock: bb.stock });
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
