import XLSX from "xlsx";

const inch = String.fromCharCode(34);
const wanted = new Set([
  `DRUMBAND-QUART TOM 6${inch} Head Hitam`,
  `DRUMBAND-QUART TOM 6${inch} Head Putih`,
  `DRUMBAND-TRIO TOM 8${inch} Head Hitam`,
  `DRUMBAND-TRIO TOM 8${inch} Head Putih`,
]);
const patterns = [
  "QUART TOM 6",
  "TRIO TOM 8",
  "QUART TOM",
  "TRIO TOM",
].map((p) => p.toLowerCase());

const wb = XLSX.readFile("../rakitan.xlsx");
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
const productCol = Object.keys(rows[0])[0];

const output = {};
const matches = new Set();

for (const row of rows) {
  const product = String(row[productCol] ?? "").trim();
  if (!product || product.toUpperCase() === "DRUMBAND") continue;

  const component = String(row["Komponen"] ?? "").trim();
  const qty = row["Qty"];

  if (!component || component.toUpperCase() === "RINCIAN") continue;

  const lower = product.toLowerCase();
  if (patterns.some((p) => lower.includes(p))) {
    matches.add(product);
  }
  if (wanted.has(product)) {
    if (!output[product]) output[product] = [];
    output[product].push({ component, qty });
  }
}

console.log(JSON.stringify(output, null, 2));
console.log("\nClosest matches:");
console.log(Array.from(matches).sort());
