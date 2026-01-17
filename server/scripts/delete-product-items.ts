import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';

config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function deleteProductItems() {
  try {
    console.log('🔍 Mencari item produk (DRBD-, SEMI-, HTS-)...');
    
    // Hapus dari tabel Item
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

    // Hapus dari tabel BahanBaku (jika ada)
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
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

deleteProductItems();
