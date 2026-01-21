import pandas as pd
from pathlib import Path

root = Path(__file__).resolve().parents[2]
path = root / "BAHAN.xlsx"

pat = "30\"|32\"|34\"|36\""

if not path.exists():
    raise SystemExit(f"Missing {path}")

df = pd.read_excel(path, sheet_name="Sheet1")
col = df.columns[0]
sub = df[df[col].astype(str).str.contains(pat, na=False)]
print(sub[[col, "Komponen", "Qty"]].to_string(index=False))
