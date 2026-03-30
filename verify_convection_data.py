import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('server/.env')

conn_str = os.getenv('DATABASE_URL')
if 'sslaccept=' in conn_str:
    parts = conn_str.split('?')
    if len(parts) == 2:
        base_url = parts[0]
        params = parts[1].split('&')
        filtered_params = [p for p in params if not p.startswith('sslaccept=')]
        conn_str = f"{base_url}?{'&'.join(filtered_params)}"

conn = psycopg2.connect(conn_str, sslmode='require')
cur = conn.cursor()

# Check items
cur.execute('SELECT code, name, category, "stockBase", "metersPerKg" FROM "ConvectionItem" ORDER BY code LIMIT 10')
print('\n' + '='*80)
print('=== Sample Items ===')
print('='*80)
for row in cur.fetchall():
    code, name, category, stock, meters = row
    meters_str = f'{meters:.2f}' if meters else 'N/A'
    print(f'{code:<10} {name:<35} {category:<15} Stock: {stock:>8.2f} m/kg: {meters_str:>6}')

# Check counts
cur.execute('SELECT COUNT(*) FROM "ConvectionItem"')
total_items = cur.fetchone()[0]

cur.execute('SELECT COUNT(*) FROM "ConvectionItem" WHERE "stockBase" > 0')
items_with_stock = cur.fetchone()[0]

cur.execute('SELECT COUNT(*) FROM "ConvectionInbound"')
total_inbound = cur.fetchone()[0]

cur.execute('SELECT COUNT(*) FROM "ConvectionInboundLine"')
total_inbound_lines = cur.fetchone()[0]

cur.execute('SELECT COUNT(*) FROM "ConvectionOutbound"')
total_outbound = cur.fetchone()[0]

cur.execute('SELECT COUNT(*) FROM "ConvectionOutboundLine"')
total_outbound_lines = cur.fetchone()[0]

print('\n' + '='*80)
print('=== Summary ===')
print('='*80)
print(f'Total Items          : {total_items}')
print(f'Items with Stock     : {items_with_stock}')
print(f'Total Inbound        : {total_inbound} transactions ({total_inbound_lines} lines)')
print(f'Total Outbound       : {total_outbound} transactions ({total_outbound_lines} lines)')

# Check sample transactions
print('\n' + '='*80)
print('=== Sample Inbound Transactions ===')
print('='*80)
cur.execute('SELECT code, date, vendor FROM "ConvectionInbound" ORDER BY date LIMIT 3')
for row in cur.fetchall():
    print(f'{row[0]} | {row[1].strftime("%Y-%m-%d")} | {row[2]}')

print('\n' + '='*80)
print('=== Sample Outbound Transactions ===')
print('='*80)
cur.execute('SELECT code, date, receiver FROM "ConvectionOutbound" ORDER BY date LIMIT 3')
for row in cur.fetchall():
    print(f'{row[0]} | {row[1].strftime("%Y-%m-%d")} | {row[2]}')

# Check fabric items with conversion
print('\n' + '='*80)
print('=== Fabric Items (with meter conversion) ===')
print('='*80)
cur.execute('''
    SELECT code, name, "stockBase", "metersPerKg", "stockBase" * "metersPerKg" as meters
    FROM "ConvectionItem" 
    WHERE "metersPerKg" IS NOT NULL AND "stockBase" > 0
    ORDER BY "stockBase" DESC
    LIMIT 5
''')
for row in cur.fetchall():
    code, name, stock_kg, m_per_kg, meters = row
    print(f'{code:<10} {name:<35} {stock_kg:>8.2f} KG = {meters:>8.2f} M (@ {m_per_kg:.2f} m/kg)')

cur.close()
conn.close()

print('\n' + '='*80)
print('✅ Data verification complete!')
print('='*80)
