import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { inventoryItems } from "../../client/src/components/inventory/items.ts";

const prisma = new PrismaClient();

async function main() {
  const rows = inventoryItems.map((item) => ({
    code: item.code,
    name: item.name?.trim() || null,
    category: item.category || null,
    subCategory: item.subCategory || null,
    kind: item.kind || null,
    stock: Number.isFinite(item.stock) ? item.stock : 0,
  }));

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const batch = rows.slice(i, i + chunkSize);
    await prisma.item.createMany({ data: batch, skipDuplicates: true });
    console.log(`Inserted batch ${i / chunkSize + 1} (${batch.length} rows)`);
  }
}

main()
  .catch((err) => {
    console.error("Failed to import items", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
