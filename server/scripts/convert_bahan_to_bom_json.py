from pathlib import Path
import json
import math

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
XLSX_PATH = ROOT / "BAHAN.xlsx"
OUTPUT_PATH = ROOT / "client" / "src" / "data" / "bom.json"


def normalize_qty(value):
  if value is None or (isinstance(value, float) and math.isnan(value)):
    return 1
  try:
    num = float(value)
    if math.isnan(num):
      return 1
    # prefer ints when whole
    if num.is_integer():
      return int(num)
    return num
  except Exception:
    return 1


def main():
  if not XLSX_PATH.exists():
    raise SystemExit(f"Missing file: {XLSX_PATH}")

  df = pd.read_excel(XLSX_PATH, sheet_name="Sheet1")

  product_col = df.columns[0]
  component_col = "Komponen"
  qty_col = "Qty"

  bom = {}

  for _, row in df.iterrows():
    product = row.get(product_col)
    component = row.get(component_col)
    qty_raw = row.get(qty_col)

    # skip header or empty rows
    if pd.isna(product) or str(product).strip().upper() == "DRUMBAND":
      continue
    if isinstance(component, str) and component.strip().upper() == "RINCIAN":
      continue
    if pd.isna(component):
      continue

    product_name = str(product).strip()
    component_name = str(component).strip()
    qty = normalize_qty(qty_raw)

    if not product_name or not component_name:
      continue

    entry = bom.setdefault(product_name, {"category": "Produk", "lines": []})
    entry["lines"].append({"component": component_name, "qty": qty})

  OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
  with OUTPUT_PATH.open("w", encoding="utf-8") as f:
    json.dump(bom, f, ensure_ascii=False, indent=2)

  print(f"Wrote {len(bom)} BOM headers to {OUTPUT_PATH}")


if __name__ == "__main__":
  main()
