import { config } from 'dotenv';
import { PrismaClient } from "@prisma/client";

config();

const prisma = new PrismaClient();

async function main() {
  try {
    // Get all convection items with their units
    const items = await prisma.convectionItem.findMany({
      select: {
        code: true,
        name: true,
        unit: true,
        category: true,
      },
      orderBy: { code: "asc" },
    });

    console.log("\n=== DAFTAR BARANG KONVEKSI ===\n");
    console.log(`Total items: ${items.length}\n`);

    // Get unique units
    const uniqueUnits = new Set<string | null>();
    const unitGroups: Record<string, typeof items> = {};

    items.forEach((item) => {
      uniqueUnits.add(item.unit);
      const unit = item.unit || "NULL";
      if (!unitGroups[unit]) {
        unitGroups[unit] = [];
      }
      unitGroups[unit].push(item);
    });

    console.log("=== SATUAN YANG ADA ===\n");
    Array.from(uniqueUnits)
      .sort()
      .forEach((unit, idx) => {
        const displayUnit = unit || "(kosong)";
        const count = unitGroups[unit || "NULL"].length;
        console.log(`${idx + 1}. ${displayUnit}: ${count} item(s)`);
      });

    console.log("\n=== DETAIL ITEM PER SATUAN ===\n");
    Array.from(uniqueUnits)
      .sort()
      .forEach((unit) => {
        const displayUnit = unit || "(kosong)";
        const itemsWithUnit = unitGroups[unit || "NULL"];

        console.log(`\n📦 SATUAN: ${displayUnit} (${itemsWithUnit.length} items)`);
        console.log("─".repeat(80));

        itemsWithUnit.slice(0, 10).forEach((item) => {
          console.log(
            `  ${item.code.padEnd(15)} | ${item.name?.substring(0, 40).padEnd(40)} | ${item.category || "(no category)"}`,
          );
        });

        if (itemsWithUnit.length > 10) {
          console.log(`  ... dan ${itemsWithUnit.length - 10} item(s) lainnya`);
        }
      });

    console.log("\n");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
