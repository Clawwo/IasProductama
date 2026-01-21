from pathlib import Path
import json
try:
    import pandas as pd  # type: ignore
except ImportError as exc:
    raise SystemExit(f"pandas not installed: {exc}")

path = Path('D:/Developments/Tech/React/React-Projects/manajemen_jogjadrumband/BAHAN.xlsx')
print('exists:', path.exists())
if not path.exists():
    raise SystemExit('file not found')

xls = pd.ExcelFile(path)
print('sheets:', xls.sheet_names)

sheet_name = xls.sheet_names[0]
df = xls.parse(sheet_name)
print('columns:', df.columns.tolist())
print('head:')
print(df.head(10))
