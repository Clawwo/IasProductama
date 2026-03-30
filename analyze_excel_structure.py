import pandas as pd
import json

excel_path = 'doc/MARET 2026 - PERSEDIAAN KONVEKSI IAS PRODUCTAMA INDONESIA new.xlsx'

# Analyze MASTER sheet
print("=" * 80)
print("MASTER SHEET ANALYSIS")
print("=" * 80)
df_master = pd.read_excel(excel_path, sheet_name='MASTER', header=None)
print(f"Shape: {df_master.shape}")
print("\nFirst 10 rows, first 3 columns:")
print(df_master.iloc[:10, :3])

# Analyze REKAP sheet
print("\n" + "=" * 80)
print("REKAP PERSEDIAAN SHEET ANALYSIS")
print("=" * 80)
df_rekap = pd.read_excel(excel_path, sheet_name='REKAP PERSEDIAAN', skiprows=1)
print(f"Shape: {df_rekap.shape}")
print("\nColumns:", df_rekap.columns.tolist())
print("\nFirst 5 rows:")
print(df_rekap.head())

# Analyze IN sheet
print("\n" + "=" * 80)
print("IN SHEET ANALYSIS")
print("=" * 80)
df_in = pd.read_excel(excel_path, sheet_name='IN', skiprows=2)
print(f"Shape: {df_in.shape}")
print("\nColumns:", df_in.columns.tolist())
print("\nFirst 5 rows:")
print(df_in.head())

# Analyze OUT sheet
print("\n" + "=" * 80)
print("OUT SHEET ANALYSIS")
print("=" * 80)
df_out = pd.read_excel(excel_path, sheet_name='OUT', skiprows=2)
print(f"Shape: {df_out.shape}")
print("\nColumns:", df_out.columns.tolist())
print("\nFirst 5 rows:")
print(df_out.head())
