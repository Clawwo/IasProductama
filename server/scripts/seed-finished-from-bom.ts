/// <reference types="node" />
// Legacy shim to import finished goods from BOM into Item table.
import './import-finished-from-bom.js';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type BomLine = { component: string; qty: number };
type BomMap = Record<string, BomLine[]>;

function slugify(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const upper = cleaned.toUpperCase() || 'PROD';
  return upper.slice(0, 48);
}

async function main() {
  const bomPath = path.resolve(__dirname, '../../client/src/data/bom.json');
  if (!fs.existsSync(bomPath)) {
    throw new Error(`BOM file not found at ${bomPath}`);
  }
  const bomMap = JSON.parse(fs.readFileSync(bomPath, 'utf-8')) as BomMap;
  const entries = Object.keys(bomMap);

  let created = 0;
  let updated = 0;

  for (const name of entries) {
    const code = `PROD-${slugify(name)}`;
    const existing = await prisma.item.findUnique({ where: { code } });
    if (existing) {
      await prisma.item.update({ where: { code }, data: { name, category: 'Produk' } });
      updated += 1;
    } else {
      await prisma.item.create({
        data: {
          code,
          name,
          category: 'Produk',
          subCategory: null,
          kind: null,
          stock: 0,
        },
      });
      created += 1;
    }
  }

  console.log(`Finished items upserted. Created: ${created}, Updated: ${updated}, Total processed: ${entries.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
