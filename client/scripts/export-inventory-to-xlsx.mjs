import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const itemsPath = path.resolve(
  __dirname,
  "../src/components/inventory/items.ts"
);
const outputPath = path.resolve(__dirname, "../inventory.xlsx");

function parseInventoryItems() {
  const source = readFileSync(itemsPath, "utf8");
  const marker = "export const inventoryItems";
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1)
    throw new Error("inventoryItems array not found in items.ts");

  const start = source.indexOf("[", markerIndex);
  const end = source.lastIndexOf("];");
  if (start === -1 || end === -1)
    throw new Error("Could not locate array boundaries in items.ts");

  const arraySource = source.slice(start, end + 1);
  const parsed = Function('"use strict"; return (' + arraySource + ");")();
  if (!Array.isArray(parsed))
    throw new Error("Parsed inventoryItems is not an array");
  return parsed;
}

function deriveKind(item) {
  const category = item.category?.toLowerCase() ?? "";
  const name = item.name?.toLowerCase() ?? "";

  if (category.includes("ring")) return "RING";
  if (category.includes("lug")) return "LUG";
  if (category.includes("harness")) return "HARNESS";
  if (category.includes("stick")) return "STICK";
  if (category.includes("cymbal")) return "SIMBAL";
  if (category.includes("head")) return "HEAD";
  if (category.includes("strainer")) return "STRAINER";
  if (category.includes("stand")) return "STAND";
  if (category.includes("bell")) return "BELL";
  if (category.includes("mahkota")) return "MAHKOTA";
  if (category.includes("hpl")) return "FIN-HPL";
  if (category.includes("mika")) return "FIN-MIKA";
  if (category.includes("pipa")) return "PIPE";
  if (category.includes("connector")) return "BRACKET";
  if (category.includes("holder")) return "HOLDER";
  if (category.includes("pearl")) return "RIM";

  if (category.includes("body")) {
    if (name.includes("snare")) return "BODY-SNARE";
    if (name.includes("tom")) return "BODY-TOM";
    if (name.includes("bass")) return "BODY-BASS";
    return "BODY-GENERAL";
  }

  if (category.includes("tom") || category.includes("bass")) return "BRACKET";
  if (
    category.includes("kaki") ||
    category.includes("kunci") ||
    category.includes("baut") ||
    category.includes("claw")
  )
    return "SPAREPART";

  if (category.includes("lainnya")) {
    if (
      name.includes("pancing") ||
      name.includes("strap") ||
      name.includes("harness")
    )
      return "HOLDER";
    return "SPAREPART";
  }

  return "SPAREPART";
}

function exportToWorkbook(items) {
  const rows = items.map(({ code, name, category, stock }) => {
    const kind = deriveKind({ name, category });
    return {
      Code: code,
      Kind: kind,
      Name: name,
      Category: category,
      Stock: stock,
    };
  });

  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.json_to_sheet(rows);
  xlsx.utils.book_append_sheet(workbook, worksheet, "Inventory");
  xlsx.writeFile(workbook, outputPath);
  return { rows: rows.length, outputPath };
}

const items = parseInventoryItems();
const { rows, outputPath: savedPath } = exportToWorkbook(items);
console.log(
  `Exported ${rows} rows to ${path.relative(
    path.resolve(__dirname, ".."),
    savedPath
  )}`
);
