import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import os
from datetime import datetime
from dotenv import load_dotenv
import uuid

load_dotenv(dotenv_path='server/.env')

# Database connection
conn_string = os.getenv('DATABASE_URL')
# Remove sslaccept parameter that psycopg2 doesn't support
if conn_string and 'sslaccept=' in conn_string:
    # Parse and rebuild connection string without sslaccept
    parts = conn_string.split('?')
    if len(parts) == 2:
        base_url = parts[0]
        params = parts[1].split('&')
        filtered_params = [p for p in params if not p.startswith('sslaccept=')]
        conn_string = f"{base_url}?{'&'.join(filtered_params)}"

conn = psycopg2.connect(conn_string, sslmode='require')
cur = conn.cursor()

# Conversion rules from Rumus_Konveksi.md
conversion_rules = {
    'KAIN DRIL': 3.3,
    'KAIN SATIN': 6.45,
    'KAIN KERAS 50F': 11.5,
    'KAIN KERAS 50N': 12.3,
    'PELES': 10,
    'BENDERA': 10,
    'VINYL': 1 / 0.6,  # 1.667
    'SQUIN': 6.67,
}

def get_meters_per_kg(name):
    """Determine metersPerKg based on item name"""
    name_upper = name.upper()
    
    # Check specific keywords in order of specificity
    if 'KERAS 50F' in name_upper or 'KK50F' in name_upper:
        return 11.5
    elif 'KERAS 50N' in name_upper or 'KK50N' in name_upper:
        return 12.3
    elif 'SATIN' in name_upper:
        return 6.45
    elif 'SQUIN' in name_upper:
        return 6.67
    elif 'VINYL' in name_upper or name.startswith('V') and 'VINYL' in name_upper:
        return 1 / 0.6  # 1.667
    elif 'PELES' in name_upper or 'BENDERA' in name_upper:
        return 10
    # DRILL/DRIL - check prefixes that are typically drill fabric
    elif 'DRILL' in name_upper or 'DRIL' in name_upper or name.startswith(('DB', 'DT', 'DL', 'OD')):
        return 3.3
    
    # Check if it's any fabric (KAIN) but no specific conversion found
    if 'KAIN' in name_upper:
        print(f"  ⚠️ No conversion rule for fabric: {name}")
    
    return None

def format_code(name):
    """Extract code from name like 'DB01 - Putih' -> 'DB01'"""
    parts = name.split('-')
    if len(parts) >= 1:
        return parts[0].strip()
    return name.strip()

def import_master_items():
    """Import item codes from MASTER sheet"""
    print("=" * 80)
    print("📦 Importing MASTER items...")
    print("=" * 80)
    
    excel_path = 'doc/MARET 2026 - PERSEDIAAN KONVEKSI IAS PRODUCTAMA INDONESIA new.xlsx'
    df = pd.read_excel(excel_path, sheet_name='MASTER', header=None)
    
    items = []
    seen_codes = set()
    
    for col in df.columns:
        for val in df[col].dropna():
            val_str = str(val).strip()
            if val_str and val_str != 'nan':
                code = format_code(val_str)
                
                # Skip if already seen
                if code in seen_codes:
                    continue
                seen_codes.add(code)
                
                meters_per_kg = get_meters_per_kg(val_str)
                
                # Determine category based on code prefix
                if code.startswith('DB') or code.startswith('DT') or code.startswith('DL') or code.startswith('OD'):
                    category = 'KAIN DRILL'
                elif code.startswith('BB') or code.startswith('BM'):
                    category = 'BENANG'
                elif code.startswith('PS'):
                    category = 'PELES'
                elif code.startswith('P'):
                    category = 'PRODUK'
                elif 'VINYL' in val_str.upper() or code.startswith('V'):
                    category = 'VINYL'
                else:
                    category = 'LAINNYA'
                
                items.append((code, val_str, category, '', 'KG', meters_per_kg, 0))
    
    print(f"Found {len(items)} unique items")
    
    # Upsert items
    query = """
        INSERT INTO "ConvectionItem" (code, name, category, "subCategory", unit, "metersPerKg", "stockBase", "createdAt", "updatedAt")
        VALUES %s
        ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            unit = EXCLUDED.unit,
            "metersPerKg" = EXCLUDED."metersPerKg",
            "updatedAt" = NOW()
    """
    
    # Add timestamps to items
    now = datetime.now()
    items_with_ts = [(code, name, cat, subcat, unit, mpk, stock, now, now) 
                     for code, name, cat, subcat, unit, mpk, stock in items]
    
    execute_values(cur, query, items_with_ts)
    conn.commit()
    print(f"✅ Imported {len(items)} items")

def import_rekap_stocks():
    """Import opening balances from REKAP sheet"""
    print("\n" + "=" * 80)
    print("📊 Importing REKAP opening balances...")
    print("=" * 80)
    
    excel_path = 'doc/MARET 2026 - PERSEDIAAN KONVEKSI IAS PRODUCTAMA INDONESIA new.xlsx'
    df = pd.read_excel(excel_path, sheet_name='REKAP PERSEDIAAN', skiprows=1)
    
    updates = []
    not_found = []
    
    for _, row in df.iterrows():
        code = row.get('Code')
        stok_akhir = row.get('Stok Akhir', 0)
        
        if pd.isna(code) or pd.isna(stok_akhir):
            continue
            
        code_str = str(code).strip()
        stok_val = float(stok_akhir) if not pd.isna(stok_akhir) else 0
        
        # Check if item exists
        cur.execute('SELECT code FROM "ConvectionItem" WHERE code = %s', (code_str,))
        if cur.fetchone():
            updates.append((stok_val, code_str))
        else:
            not_found.append(code_str)
    
    if updates:
        cur.executemany(
            'UPDATE "ConvectionItem" SET "stockBase" = %s WHERE code = %s',
            updates
        )
        conn.commit()
    
    print(f"✅ Updated {len(updates)} stocks")
    if not_found:
        print(f"⚠️ {len(not_found)} codes not found in master: {not_found[:10]}")

def import_inbound_transactions():
    """Import IN transactions"""
    print("\n" + "=" * 80)
    print("📥 Importing IN transactions...")
    print("=" * 80)
    
    excel_path = 'doc/MARET 2026 - PERSEDIAAN KONVEKSI IAS PRODUCTAMA INDONESIA new.xlsx'
    df = pd.read_excel(excel_path, sheet_name='IN', skiprows=2)
    
    # Process both sections (BAHAN BAKU and BARANG JADI)
    transactions = {}
    
    # Section 1: BAHAN BAKU (TANGGAL, NAMA BARANG, JUMLAH, SATUAN, KETERANGAN)
    for _, row in df.iterrows():
        date = row.get('TANGGAL')
        name = row.get('NAMA BARANG')
        qty = row.get('JUMLAH')
        unit = row.get('SATUAN', 'KG')
        note = row.get('KETERANGAN', '')
        
        if pd.notna(date) and pd.notna(name) and pd.notna(qty):
            if isinstance(date, str):
                date = pd.to_datetime(date)
            
            date_str = date.strftime('%Y%m%d')
            key = f"{date_str}_BAHAN_BAKU"
            
            if key not in transactions:
                transactions[key] = {'date': date, 'vendor': 'Import', 'lines': []}
            
            code = format_code(str(name))
            transactions[key]['lines'].append({
                'code': code,
                'name': str(name),
                'qty': float(qty),
                'unit': str(unit) if pd.notna(unit) else 'KG',
                'note': str(note) if pd.notna(note) else ''
            })
    
    # Section 2: BARANG JADI (TANGGAL.1, NAMA BARANG.1, JUMLAH.1, KETERANGAN.1)
    for _, row in df.iterrows():
        date = row.get('TANGGAL.1')
        name = row.get('NAMA BARANG.1')
        qty = row.get('JUMLAH.1')
        note = row.get('KETERANGAN.1', '')
        
        if pd.notna(date) and pd.notna(name) and pd.notna(qty):
            if isinstance(date, str):
                date = pd.to_datetime(date)
            
            date_str = date.strftime('%Y%m%d')
            key = f"{date_str}_BARANG_JADI"
            
            if key not in transactions:
                transactions[key] = {'date': date, 'vendor': 'Import', 'lines': []}
            
            code = format_code(str(name))
            transactions[key]['lines'].append({
                'code': code,
                'name': str(name),
                'qty': float(qty),
                'unit': 'KG',
                'note': str(note) if pd.notna(note) else ''
            })
    
    print(f"Grouped into {len(transactions)} transactions")
    
    imported = 0
    for key, txn in transactions.items():
        date = txn['date']
        vendor = txn['vendor']
        lines = txn['lines']
        
        # Generate code
        date_str = date.strftime('%Y%m%d')
        prefix = f"CONV-IN-{date_str}"
        
        cur.execute(
            'SELECT code FROM "ConvectionInbound" WHERE code LIKE %s ORDER BY code DESC LIMIT 1',
            (f"{prefix}%",)
        )
        result = cur.fetchone()
        seq = 1
        if result:
            last_code = result[0]
            seq = int(last_code[-4:]) + 1
        
        code = f"{prefix}-{seq:04d}"
        
        # Generate UUID
        inbound_id = str(uuid.uuid4())
        
        # Insert transaction
        cur.execute(
            'INSERT INTO "ConvectionInbound" (id, code, date, vendor, "createdAt", "updatedAt") VALUES (%s, %s, %s, %s, NOW(), NOW())',
            (inbound_id, code, date, vendor)
        )
        
        # Insert lines
        for line in lines:
            line_id = str(uuid.uuid4())
            cur.execute(
                '''INSERT INTO "ConvectionInboundLine" 
                   (id, "inboundId", code, name, category, "subCategory", qty, "qtyInBase", unit, note)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
                (line_id, inbound_id, line['code'], line['name'], '', '', 
                 line['qty'], line['qty'], line['unit'], line['note'])
            )
        
        conn.commit()
        imported += 1
    
    print(f"✅ Imported {imported} inbound transactions")

def import_outbound_transactions():
    """Import OUT transactions"""
    print("\n" + "=" * 80)
    print("📤 Importing OUT transactions...")
    print("=" * 80)
    
    excel_path = 'doc/MARET 2026 - PERSEDIAAN KONVEKSI IAS PRODUCTAMA INDONESIA new.xlsx'
    df = pd.read_excel(excel_path, sheet_name='OUT', skiprows=2)
    
    transactions = {}
    
    # Section 1: BAHAN BAKU
    for _, row in df.iterrows():
        date = row.get('TANGGAL')
        name = row.get('NAMA BARANG')
        qty = row.get('JUMLAH')
        unit = row.get('SATUAN', 'KG')
        note = row.get('KETERANGAN', '')
        
        if pd.notna(date) and pd.notna(name) and pd.notna(qty):
            if isinstance(date, str):
                date = pd.to_datetime(date)
            
            date_str = date.strftime('%Y%m%d')
            receiver = str(note) if pd.notna(note) else 'Unknown'
            key = f"{date_str}_{receiver[:20]}"
            
            if key not in transactions:
                transactions[key] = {'date': date, 'receiver': receiver, 'lines': []}
            
            code = format_code(str(name))
            transactions[key]['lines'].append({
                'code': code,
                'name': str(name),
                'qty': float(qty),
                'unit': str(unit) if pd.notna(unit) else 'KG',
                'note': receiver
            })
    
    # Section 2: BARANG JADI
    for _, row in df.iterrows():
        date = row.get('TANGGAL.1')
        name = row.get('NAMA BARANG.1')
        qty = row.get('JUMLAH.1')
        note = row.get('KETERANGAN.1', '')
        
        if pd.notna(date) and pd.notna(name) and pd.notna(qty):
            if isinstance(date, str):
                date = pd.to_datetime(date)
            
            date_str = date.strftime('%Y%m%d')
            receiver = str(note) if pd.notna(note) else 'Unknown'
            key = f"{date_str}_{receiver[:20]}_BJ"
            
            if key not in transactions:
                transactions[key] = {'date': date, 'receiver': receiver, 'lines': []}
            
            code = format_code(str(name))
            transactions[key]['lines'].append({
                'code': code,
                'name': str(name),
                'qty': float(qty),
                'unit': 'KG',
                'note': receiver
            })
    
    print(f"Grouped into {len(transactions)} transactions")
    
    imported = 0
    for key, txn in transactions.items():
        date = txn['date']
        receiver = txn['receiver']
        lines = txn['lines']
        
        # Generate code
        date_str = date.strftime('%Y%m%d')
        prefix = f"CONV-OUT-{date_str}"
        
        cur.execute(
            'SELECT code FROM "ConvectionOutbound" WHERE code LIKE %s ORDER BY code DESC LIMIT 1',
            (f"{prefix}%",)
        )
        result = cur.fetchone()
        seq = 1
        if result:
            last_code = result[0]
            seq = int(last_code[-4:]) + 1
        
        code = f"{prefix}-{seq:04d}"
        
        # Generate UUID
        outbound_id = str(uuid.uuid4())
        
        # Insert transaction
        cur.execute(
            'INSERT INTO "ConvectionOutbound" (id, code, date, receiver, "createdAt", "updatedAt") VALUES (%s, %s, %s, %s, NOW(), NOW())',
            (outbound_id, code, date, receiver)
        )
        
        # Insert lines
        for line in lines:
            line_id = str(uuid.uuid4())
            cur.execute(
                '''INSERT INTO "ConvectionOutboundLine" 
                   (id, "outboundId", code, name, category, "subCategory", qty, "qtyInBase", unit, note)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
                (line_id, outbound_id, line['code'], line['name'], '', '', 
                 line['qty'], line['qty'], line['unit'], line['note'])
            )
        
        conn.commit()
        imported += 1
    
    print(f"✅ Imported {imported} outbound transactions")

def main():
    try:
        print("🚀 Starting convection data import...")
        print()
        
        import_master_items()
        import_rekap_stocks()
        import_inbound_transactions()
        import_outbound_transactions()
        
        print("\n" + "=" * 80)
        print("✨ Import completed successfully!")
        print("=" * 80)
    except Exception as e:
        print(f"\n❌ Import failed: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
