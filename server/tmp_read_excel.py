import pandas as pd

path = '..\\BAHAN.xlsx'
df = pd.read_excel(path, sheet_name='Sheet1')
col_product = df.columns[0]
mask = df[col_product].astype(str).str.contains('26', na=False)
rows = df[mask]
print(rows[[col_product, 'Komponen', 'Qty']].head(50))
print('\nunique products with 26:')
print(rows[col_product].dropna().unique())
