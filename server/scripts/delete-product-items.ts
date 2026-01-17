import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';

config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL tidak diset di environment');
  process.exit(1);
}

const ssl =
  process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
    ? { rejectUnauthorized: false }
    : undefined;

const pool = new Pool({ connectionString, ssl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function deleteProductItems() {
  console.log('🔍 Mencari item produk (DRBD-, SEMI-, HTS-)...');
  try {
    const deletedItems = await prisma.item.deleteMany({
      where: {
        OR: [
          { code: { startsWith: 'DRBD-' } },
          { code: { startsWith: 'SEMI-' } },
          { code: { startsWith: 'HTS-' } },
        ],
      },
    });

    console.log(`✅ Dihapus ${deletedItems.count} item dari tabel Item`);

    const deletedBahanBaku = await prisma.bahanBaku.deleteMany({
      where: {
        OR: [
          { code: { startsWith: 'DRBD-' } },
          { code: { startsWith: 'SEMI-' } },
          { code: { startsWith: 'HTS-' } },
        ],
      },
    });

    console.log(`✅ Dihapus ${deletedBahanBaku.count} item dari tabel BahanBaku`);

    console.log('✨ Selesai! Data produk sudah dibersihkan.');
    return 0;
  } catch (error) {
    console.error('❌ Error:', error);
    return 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

deleteProductItems()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
