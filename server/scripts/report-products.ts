import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config();

async function main() {
  const prisma = new PrismaClient();
  try {
    const total = await prisma.product.count();

    const names = await prisma.product.findMany({
      select: { code: true, name: true, category: true, subCategory: true },
    });

    const dupNameMap = new Map<string, { count: number; codes: string[] }>();
    const unnamed: string[] = [];

    for (const p of names) {
      const key = (p.name ?? '').trim();
      if (!key) {
        unnamed.push(p.code);
        continue;
      }
      const entry = dupNameMap.get(key) ?? { count: 0, codes: [] };
      entry.count += 1;
      if (entry.codes.length < 5) entry.codes.push(p.code);
      dupNameMap.set(key, entry);
    }

    const duplicates = Array.from(dupNameMap.entries())
      .filter(([, v]) => v.count > 1)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 50);

    console.log('Total products:', total);
    console.log('Products without a name:', unnamed.length);
    if (unnamed.length) {
      console.log('Sample codes without name (up to 10):', unnamed.slice(0, 10));
    }

    console.log('\nTop duplicate names (showing up to 50):');
    duplicates.forEach(([name, info], idx) => {
      console.log(
        `${idx + 1}. ${name} -> ${info.count} entries; sample codes: ${info.codes.join(', ')}`,
      );
    });

    console.log('\nDone.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
