import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is missing');
}

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const products = [
  // DRUMBAND - Tenor Drum
  { code: 'DRBD-TD-10-WHT', name: 'DRUMBAND-TENOR DRUM 10" (Head Putih)', category: 'DRUMBAND', subCategory: 'TENOR DRUM', size: '10"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-TD-10-BLK', name: 'DRUMBAND-TENOR DRUM 10" (Head Hitam)', category: 'DRUMBAND', subCategory: 'TENOR DRUM', size: '10"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-TD-12-WHT', name: 'DRUMBAND-TENOR DRUM 12" (Head Putih)', category: 'DRUMBAND', subCategory: 'TENOR DRUM', size: '12"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-TD-12-BLK', name: 'DRUMBAND-TENOR DRUM 12" (Head Hitam)', category: 'DRUMBAND', subCategory: 'TENOR DRUM', size: '12"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-TD-13-WHT', name: 'DRUMBAND-TENOR DRUM 13" (Head Putih)', category: 'DRUMBAND', subCategory: 'TENOR DRUM', size: '13"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-TD-13-BLK', name: 'DRUMBAND-TENOR DRUM 13" (Head Hitam)', category: 'DRUMBAND', subCategory: 'TENOR DRUM', size: '13"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-TD-14-WHT', name: 'DRUMBAND-TENOR DRUM 14" (Head Putih)', category: 'DRUMBAND', subCategory: 'TENOR DRUM', size: '14"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-TD-14-BLK', name: 'DRUMBAND-TENOR DRUM 14" (Head Hitam)', category: 'DRUMBAND', subCategory: 'TENOR DRUM', size: '14"', color: 'Head Hitam', stock: 0 },

  // DRUMBAND - Snare Drum
  { code: 'DRBD-SD-10-WHT', name: 'DRUMBAND-SNARE DRUM 10" (Head Putih)', category: 'DRUMBAND', subCategory: 'SNARE DRUM', size: '10"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-SD-10-BLK', name: 'DRUMBAND-SNARE DRUM 10" (Head Hitam)', category: 'DRUMBAND', subCategory: 'SNARE DRUM', size: '10"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-SD-12-WHT', name: 'DRUMBAND-SNARE DRUM 12" (Head Putih)', category: 'DRUMBAND', subCategory: 'SNARE DRUM', size: '12"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-SD-12-BLK', name: 'DRUMBAND-SNARE DRUM 12" (Head Hitam)', category: 'DRUMBAND', subCategory: 'SNARE DRUM', size: '12"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-SD-13-WHT', name: 'DRUMBAND-SNARE DRUM 13" (Head Putih)', category: 'DRUMBAND', subCategory: 'SNARE DRUM', size: '13"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-SD-13-BLK', name: 'DRUMBAND-SNARE DRUM 13" (Head Hitam)', category: 'DRUMBAND', subCategory: 'SNARE DRUM', size: '13"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-SD-14-WHT', name: 'DRUMBAND-SNARE DRUM 14" (Head Putih)', category: 'DRUMBAND', subCategory: 'SNARE DRUM', size: '14"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-SD-14-BLK', name: 'DRUMBAND-SNARE DRUM 14" (Head Hitam)', category: 'DRUMBAND', subCategory: 'SNARE DRUM', size: '14"', color: 'Head Hitam', stock: 0 },

  // DRUMBAND - Bass Drum
  { code: 'DRBD-BD-13-WHT', name: 'DRUMBAND-BASS DRUM 13" (Head Putih)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '13"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-BD-13-BLK', name: 'DRUMBAND-BASS DRUM 13" (Head Hitam)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '13"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-BD-14-WHT', name: 'DRUMBAND-BASS DRUM 14" (Head Putih)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '14"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-BD-14-BLK', name: 'DRUMBAND-BASS DRUM 14" (Head Hitam)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '14"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-BD-16-WHT', name: 'DRUMBAND-BASS DRUM 16" (Head Putih)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '16"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-BD-16-BLK', name: 'DRUMBAND-BASS DRUM 16" (Head Hitam)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '16"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-BD-18-WHT', name: 'DRUMBAND-BASS DRUM 18" (Head Putih)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '18"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-BD-18-BLK', name: 'DRUMBAND-BASS DRUM 18" (Head Hitam)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '18"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-BD-20-WHT', name: 'DRUMBAND-BASS DRUM 20" (Head Putih)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '20"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-BD-20-BLK', name: 'DRUMBAND-BASS DRUM 20" (Head Hitam)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '20"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-BD-22-WHT', name: 'DRUMBAND-BASS DRUM 22" (Head Putih)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '22"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-BD-22-BLK', name: 'DRUMBAND-BASS DRUM 22" (Head Hitam)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '22"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-BD-24-WHT', name: 'DRUMBAND-BASS DRUM 24" (Head Putih)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '24"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-BD-24-BLK', name: 'DRUMBAND-BASS DRUM 24" (Head Hitam)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '24"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-BD-26-WHT', name: 'DRUMBAND-BASS DRUM 26" (Head Putih)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '26"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-BD-26-BLK', name: 'DRUMBAND-BASS DRUM 26" (Head Hitam)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '26"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-BD-28-WHT', name: 'DRUMBAND-BASS DRUM 28" (Head Putih)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '28"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-BD-28-BLK', name: 'DRUMBAND-BASS DRUM 28" (Head Hitam)', category: 'DRUMBAND', subCategory: 'BASS DRUM', size: '28"', color: 'Head Hitam', stock: 0 },

  // DRUMBAND - Trio Tom
  { code: 'DRBD-TT-08-WHT', name: 'DRUMBAND-TRIO TOM 8" Head Putih', category: 'DRUMBAND', subCategory: 'TRIO TOM', size: '8"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-TT-10-WHT', name: 'DRUMBAND-TRIO TOM 10" Head Putih', category: 'DRUMBAND', subCategory: 'TRIO TOM', size: '10"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-TT-12-WHT', name: 'DRUMBAND-TRIO TOM 12" Head Putih', category: 'DRUMBAND', subCategory: 'TRIO TOM', size: '12"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-TT-08-BLK', name: 'DRUMBAND-TRIO TOM 8" Head Hitam', category: 'DRUMBAND', subCategory: 'TRIO TOM', size: '8"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-TT-10-BLK', name: 'DRUMBAND-TRIO TOM 10" Head Hitam', category: 'DRUMBAND', subCategory: 'TRIO TOM', size: '10"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-TT-12-BLK', name: 'DRUMBAND-TRIO TOM 12" Head Hitam', category: 'DRUMBAND', subCategory: 'TRIO TOM', size: '12"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-TT-13-WHT', name: 'DRUMBAND-TRIO TOM 13" Head Putih', category: 'DRUMBAND', subCategory: 'TRIO TOM', size: '13"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-TT-13-BLK', name: 'DRUMBAND-TRIO TOM 13" Head Hitam', category: 'DRUMBAND', subCategory: 'TRIO TOM', size: '13"', color: 'Head Hitam', stock: 0 },

  // DRUMBAND - Quart Tom
  { code: 'DRBD-QT-06-WHT', name: 'DRUMBAND-QUART TOM 6" Head Putih', category: 'DRUMBAND', subCategory: 'QUART TOM', size: '6"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-QT-08-WHT', name: 'DRUMBAND-QUART TOM 8" Head Putih', category: 'DRUMBAND', subCategory: 'QUART TOM', size: '8"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-QT-10-WHT', name: 'DRUMBAND-QUART TOM 10" Head Putih', category: 'DRUMBAND', subCategory: 'QUART TOM', size: '10"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-QT-12-WHT', name: 'DRUMBAND-QUART TOM 12" Head Putih', category: 'DRUMBAND', subCategory: 'QUART TOM', size: '12"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-QT-06-BLK', name: 'DRUMBAND-QUART TOM 6" Head Hitam', category: 'DRUMBAND', subCategory: 'QUART TOM', size: '6"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-QT-08-BLK', name: 'DRUMBAND-QUART TOM 8" Head Hitam', category: 'DRUMBAND', subCategory: 'QUART TOM', size: '8"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-QT-10-BLK', name: 'DRUMBAND-QUART TOM 10" Head Hitam', category: 'DRUMBAND', subCategory: 'QUART TOM', size: '10"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-QT-12-BLK', name: 'DRUMBAND-QUART TOM 12" Head Hitam', category: 'DRUMBAND', subCategory: 'QUART TOM', size: '12"', color: 'Head Hitam', stock: 0 },
  { code: 'DRBD-QT-13-WHT', name: 'DRUMBAND-QUART TOM 13" Head Putih', category: 'DRUMBAND', subCategory: 'QUART TOM', size: '13"', color: 'Head Putih', stock: 0 },
  { code: 'DRBD-QT-13-BLK', name: 'DRUMBAND-QUART TOM 13" Head Hitam', category: 'DRUMBAND', subCategory: 'QUART TOM', size: '13"', color: 'Head Hitam', stock: 0 },

  // SEMI - Snare Drum
  { code: 'SEMI-SD-TK', name: 'SEMI-SNARE DRUM SEMI TK', category: 'SEMI', subCategory: 'SNARE DRUM', size: 'TK', color: null, stock: 0 },
  { code: 'SEMI-SD-SMP', name: 'SEMI-SNARE DRUM SEMI SMP', category: 'SEMI', subCategory: 'SNARE DRUM', size: 'SMP', color: null, stock: 0 },
  { code: 'SEMI-SD-SMA', name: 'SEMI-SNARE DRUM SEMI SMA', category: 'SEMI', subCategory: 'SNARE DRUM', size: 'SMA', color: null, stock: 0 },

  // SEMI - Quart Tom HTS TK
  { code: 'SEMI-QTH-06-UTK', name: 'SEMI-QUART TOM HTS 6" ULTIMATE TK', category: 'SEMI', subCategory: 'QUART TOM HTS', size: '6"', color: 'ULTIMATE TK', stock: 0 },
  { code: 'SEMI-QTH-08-UTK', name: 'SEMI-QUART TOM HTS 8" ULTIMATE TK', category: 'SEMI', subCategory: 'QUART TOM HTS', size: '8"', color: 'ULTIMATE TK', stock: 0 },
  { code: 'SEMI-QTH-10-UTK', name: 'SEMI-QUART TOM HTS 10" ULTIMATE TK', category: 'SEMI', subCategory: 'QUART TOM HTS', size: '10"', color: 'ULTIMATE TK', stock: 0 },
  { code: 'SEMI-QTH-12-UTK', name: 'SEMI-QUART TOM HTS 12" ULTIMATE TK', category: 'SEMI', subCategory: 'QUART TOM HTS', size: '12"', color: 'ULTIMATE TK', stock: 0 },

  // SEMI - Quart Tom HTS SD
  { code: 'SEMI-QTH-06-USD', name: 'SEMI-QUART TOM HTS 6" ULTIMATE SD', category: 'SEMI', subCategory: 'QUART TOM HTS', size: '6"', color: 'ULTIMATE SD', stock: 0 },
  { code: 'SEMI-QTH-08-USD', name: 'SEMI-QUART TOM HTS 8" ULTIMATE SD', category: 'SEMI', subCategory: 'QUART TOM HTS', size: '8"', color: 'ULTIMATE SD', stock: 0 },
  { code: 'SEMI-QTH-10-USD', name: 'SEMI-QUART TOM HTS 10" ULTIMATE SD', category: 'SEMI', subCategory: 'QUART TOM HTS', size: '10"', color: 'ULTIMATE SD', stock: 0 },
  { code: 'SEMI-QTH-12-USD', name: 'SEMI-QUART TOM HTS 12" ULTIMATE SD', category: 'SEMI', subCategory: 'QUART TOM HTS', size: '12"', color: 'ULTIMATE SD', stock: 0 },

  // SEMI - Quart Tom HTS SMP-SMA
  { code: 'SEMI-QTH-08-USMP', name: 'SEMI-QUART TOM HTS 8" ULTIMATE SMP-SMA', category: 'SEMI', subCategory: 'QUART TOM HTS', size: '8"', color: 'ULTIMATE SMP-SMA', stock: 0 },
  { code: 'SEMI-QTH-10-USMP', name: 'SEMI-QUART TOM HTS 10" ULTIMATE SMP-SMA', category: 'SEMI', subCategory: 'QUART TOM HTS', size: '10"', color: 'ULTIMATE SMP-SMA', stock: 0 },
  { code: 'SEMI-QTH-12-USMP', name: 'SEMI-QUART TOM HTS 12" ULTIMATE SMP-SMA', category: 'SEMI', subCategory: 'QUART TOM HTS', size: '12"', color: 'ULTIMATE SMP-SMA', stock: 0 },
  { code: 'SEMI-QTH-13-USMP', name: 'SEMI-QUART TOM HTS 13" ULTIMATE SMP-SMA', category: 'SEMI', subCategory: 'QUART TOM HTS', size: '13"', color: 'ULTIMATE SMP-SMA', stock: 0 },

  // SEMI - Quint Tom HTS ULTIMATE
  { code: 'SEMI-QNTH-06-ULT', name: 'SEMI-QUINT TOM HTS 6" ULTIMATE', category: 'SEMI', subCategory: 'QUINT TOM HTS', size: '6"', color: 'ULTIMATE', stock: 0 },
  { code: 'SEMI-QNTH-08-ULT', name: 'SEMI-QUINT TOM HTS 8" ULTIMATE', category: 'SEMI', subCategory: 'QUINT TOM HTS', size: '8"', color: 'ULTIMATE', stock: 0 },
  { code: 'SEMI-QNTH-10-ULT', name: 'SEMI-QUINT TOM HTS 10" ULTIMATE', category: 'SEMI', subCategory: 'QUINT TOM HTS', size: '10"', color: 'ULTIMATE', stock: 0 },
  { code: 'SEMI-QNTH-12-ULT', name: 'SEMI-QUINT TOM HTS 12" ULTIMATE', category: 'SEMI', subCategory: 'QUINT TOM HTS', size: '12"', color: 'ULTIMATE', stock: 0 },
  { code: 'SEMI-QNTH-13-ULT', name: 'SEMI-QUINT TOM HTS 13" ULTIMATE', category: 'SEMI', subCategory: 'QUINT TOM HTS', size: '13"', color: 'ULTIMATE', stock: 0 },

  // SEMI - Quint Tom HTS PREMIUM
  { code: 'SEMI-QNTH-06-PRM', name: 'SEMI-QUINT TOM HTS 6" PREMIUM', category: 'SEMI', subCategory: 'QUINT TOM HTS', size: '6"', color: 'PREMIUM', stock: 0 },
  { code: 'SEMI-QNTH-08-PRM', name: 'SEMI-QUINT TOM HTS 8" PREMIUM', category: 'SEMI', subCategory: 'QUINT TOM HTS', size: '8"', color: 'PREMIUM', stock: 0 },
  { code: 'SEMI-QNTH-10-PRM', name: 'SEMI-QUINT TOM HTS 10" PREMIUM', category: 'SEMI', subCategory: 'QUINT TOM HTS', size: '10"', color: 'PREMIUM', stock: 0 },
  { code: 'SEMI-QNTH-12-PRM', name: 'SEMI-QUINT TOM HTS 12" PREMIUM', category: 'SEMI', subCategory: 'QUINT TOM HTS', size: '12"', color: 'PREMIUM', stock: 0 },
  { code: 'SEMI-QNTH-13-PRM', name: 'SEMI-QUINT TOM HTS 13" PREMIUM', category: 'SEMI', subCategory: 'QUINT TOM HTS', size: '13"', color: 'PREMIUM', stock: 0 },

  // HTS - Snare Drum
  { code: 'HTS-SD-10-UTK', name: 'HTS-SNARE DRUM HTS 10" ULTIMATE (TK)', category: 'HTS', subCategory: 'SNARE DRUM', size: '10"', color: 'ULTIMATE (TK)', stock: 0 },
  { code: 'HTS-SD-10-PTK', name: 'HTS-SNARE DRUM HTS 10" PREMIUM (TK)', category: 'HTS', subCategory: 'SNARE DRUM', size: '10"', color: 'PREMIUM (TK)', stock: 0 },
  { code: 'HTS-SD-12-PTK', name: 'HTS-SNARE DRUM HTS 12" PREMIUM (TK)', category: 'HTS', subCategory: 'SNARE DRUM', size: '12"', color: 'PREMIUM (TK)', stock: 0 },
  { code: 'HTS-SD-10-USD', name: 'HTS-SNARE DRUM HTS 10" ULTIMATE (SD)', category: 'HTS', subCategory: 'SNARE DRUM', size: '10"', color: 'ULTIMATE (SD)', stock: 0 },
  { code: 'HTS-SD-12-USD', name: 'HTS-SNARE DRUM HTS 12" ULTIMATE (SD)', category: 'HTS', subCategory: 'SNARE DRUM', size: '12"', color: 'ULTIMATE (SD)', stock: 0 },
  { code: 'HTS-SD-12-PSD', name: 'HTS-SNARE DRUM HTS 12" PREMIUM (SD)', category: 'HTS', subCategory: 'SNARE DRUM', size: '12"', color: 'PREMIUM (SD)', stock: 0 },
  { code: 'HTS-SD-13-USMP', name: 'HTS-SNARE DRUM HTS 13" ULTIMATE (SMP)', category: 'HTS', subCategory: 'SNARE DRUM', size: '13"', color: 'ULTIMATE (SMP)', stock: 0 },
  { code: 'HTS-SD-13-PSMP', name: 'HTS-SNARE DRUM HTS 13" PREMIUM (SMP)', category: 'HTS', subCategory: 'SNARE DRUM', size: '13"', color: 'PREMIUM (SMP)', stock: 0 },
  { code: 'HTS-SD-14-USMA', name: 'HTS-SNARE DRUM HTS 14" ULTIMATE (SMA)', category: 'HTS', subCategory: 'SNARE DRUM', size: '14"', color: 'ULTIMATE (SMA)', stock: 0 },
  { code: 'HTS-SD-14-PSMP', name: 'HTS-SNARE DRUM HTS 14" PREMIUM (SMP)', category: 'HTS', subCategory: 'SNARE DRUM', size: '14"', color: 'PREMIUM (SMP)', stock: 0 },

  // HTS - Bass Drum ULTIMATE TK
  { code: 'HTS-BD-13-UW-TK', name: 'HTS-BASS DRUM HTS 13" ULTIMATE (Head Putih) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '13"', color: 'ULTIMATE WHT TK', stock: 0 },
  { code: 'HTS-BD-14-UW-TK', name: 'HTS-BASS DRUM HTS 14" ULTIMATE (Head Putih) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '14"', color: 'ULTIMATE WHT TK', stock: 0 },
  { code: 'HTS-BD-14-UB-TK', name: 'HTS-BASS DRUM HTS 14" ULTIMATE (Head Hitam) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '14"', color: 'ULTIMATE BLK TK', stock: 0 },
  { code: 'HTS-BD-16-UW-TK', name: 'HTS-BASS DRUM HTS 16" ULTIMATE (Head Putih) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '16"', color: 'ULTIMATE WHT TK', stock: 0 },
  { code: 'HTS-BD-16-UB-TK', name: 'HTS-BASS DRUM HTS 16" ULTIMATE (Head Hitam) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '16"', color: 'ULTIMATE BLK TK', stock: 0 },
  { code: 'HTS-BD-18-UW-TK', name: 'HTS-BASS DRUM HTS 18" ULTIMATE (Head Putih) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '18"', color: 'ULTIMATE WHT TK', stock: 0 },
  { code: 'HTS-BD-18-UB-TK', name: 'HTS-BASS DRUM HTS 18" ULTIMATE (Head Hitam) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '18"', color: 'ULTIMATE BLK TK', stock: 0 },
  { code: 'HTS-BD-20-UW-TK', name: 'HTS-BASS DRUM HTS 20" ULTIMATE (Head Putih) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '20"', color: 'ULTIMATE WHT TK', stock: 0 },
  { code: 'HTS-BD-20-UB-TK', name: 'HTS-BASS DRUM HTS 20" ULTIMATE (Head Hitam) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '20"', color: 'ULTIMATE BLK TK', stock: 0 },
  { code: 'HTS-BD-22-UW-TK', name: 'HTS-BASS DRUM HTS 22" ULTIMATE (Head Putih) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '22"', color: 'ULTIMATE WHT TK', stock: 0 },
  { code: 'HTS-BD-22-UB-TK', name: 'HTS-BASS DRUM HTS 22" ULTIMATE (Head Hitam) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '22"', color: 'ULTIMATE BLK TK', stock: 0 },

  // HTS - Bass Drum ULTIMATE 33
  { code: 'HTS-BD-13-UW-33', name: 'HTS-BASS DRUM HTS 13" ULTIMATE (Head Putih) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '13"', color: 'ULTIMATE WHT 33', stock: 0 },
  { code: 'HTS-BD-13-UB-33', name: 'HTS-BASS DRUM HTS 13" ULTIMATE (Head Hitam) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '13"', color: 'ULTIMATE BLK 33', stock: 0 },
  { code: 'HTS-BD-14-UW-33', name: 'HTS-BASS DRUM HTS 14" ULTIMATE (Head Putih) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '14"', color: 'ULTIMATE WHT 33', stock: 0 },
  { code: 'HTS-BD-14-UB-33', name: 'HTS-BASS DRUM HTS 14" ULTIMATE (Head Hitam) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '14"', color: 'ULTIMATE BLK 33', stock: 0 },
  { code: 'HTS-BD-16-UW-33', name: 'HTS-BASS DRUM HTS 16" ULTIMATE (Head Putih) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '16"', color: 'ULTIMATE WHT 33', stock: 0 },
  { code: 'HTS-BD-16-UB-33', name: 'HTS-BASS DRUM HTS 16" ULTIMATE (Head Hitam) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '16"', color: 'ULTIMATE BLK 33', stock: 0 },
  { code: 'HTS-BD-18-UW-33', name: 'HTS-BASS DRUM HTS 18" ULTIMATE (Head Putih) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '18"', color: 'ULTIMATE WHT 33', stock: 0 },
  { code: 'HTS-BD-18-UB-33', name: 'HTS-BASS DRUM HTS 18" ULTIMATE (Head Hitam) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '18"', color: 'ULTIMATE BLK 33', stock: 0 },
  { code: 'HTS-BD-20-UW-33', name: 'HTS-BASS DRUM HTS 20" ULTIMATE (Head Putih) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '20"', color: 'ULTIMATE WHT 33', stock: 0 },
  { code: 'HTS-BD-20-UB-33', name: 'HTS-BASS DRUM HTS 20" ULTIMATE (Head Hitam) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '20"', color: 'ULTIMATE BLK 33', stock: 0 },
  { code: 'HTS-BD-22-UW-33', name: 'HTS-BASS DRUM HTS 22" ULTIMATE (Head Putih) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '22"', color: 'ULTIMATE WHT 33', stock: 0 },
  { code: 'HTS-BD-22-UB-33', name: 'HTS-BASS DRUM HTS 22" ULTIMATE (Head Hitam) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '22"', color: 'ULTIMATE BLK 33', stock: 0 },

  // HTS - Bass Drum ULTIMATE 35
  { code: 'HTS-BD-14-UW-35', name: 'HTS-BASS DRUM HTS 14" ULTIMATE (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '14"', color: 'ULTIMATE WHT 35', stock: 0 },
  { code: 'HTS-BD-14-UB-35', name: 'HTS-BASS DRUM HTS 14" ULTIMATE (Head Hitam) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '14"', color: 'ULTIMATE BLK 35', stock: 0 },
  { code: 'HTS-BD-16-UW-35', name: 'HTS-BASS DRUM HTS 16" ULTIMATE (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '16"', color: 'ULTIMATE WHT 35', stock: 0 },
  { code: 'HTS-BD-16-UB-35', name: 'HTS-BASS DRUM HTS 16" ULTIMATE (Head Hitam) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '16"', color: 'ULTIMATE BLK 35', stock: 0 },
  { code: 'HTS-BD-18-UW-35', name: 'HTS-BASS DRUM HTS 18" ULTIMATE (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '18"', color: 'ULTIMATE WHT 35', stock: 0 },
  { code: 'HTS-BD-18-UB-35', name: 'HTS-BASS DRUM HTS 18" ULTIMATE (Head Hitam) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '18"', color: 'ULTIMATE BLK 35', stock: 0 },
  { code: 'HTS-BD-20-UW-35', name: 'HTS-BASS DRUM HTS 20" ULTIMATE (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '20"', color: 'ULTIMATE WHT 35', stock: 0 },
  { code: 'HTS-BD-20-UB-35', name: 'HTS-BASS DRUM HTS 20" ULTIMATE (Head Hitam) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '20"', color: 'ULTIMATE BLK 35', stock: 0 },
  { code: 'HTS-BD-22-UW-35', name: 'HTS-BASS DRUM HTS 22" ULTIMATE (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '22"', color: 'ULTIMATE WHT 35', stock: 0 },
  { code: 'HTS-BD-22-UB-35', name: 'HTS-BASS DRUM HTS 22" ULTIMATE (Head Hitam) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '22"', color: 'ULTIMATE BLK 35', stock: 0 },
  { code: 'HTS-BD-24-UW-35', name: 'HTS-BASS DRUM HTS 24" ULTIMATE (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '24"', color: 'ULTIMATE WHT 35', stock: 0 },
  { code: 'HTS-BD-24-UB-35', name: 'HTS-BASS DRUM HTS 24" ULTIMATE (Head Hitam) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '24"', color: 'ULTIMATE BLK 35', stock: 0 },
  { code: 'HTS-BD-26-UW-35', name: 'HTS-BASS DRUM HTS 26" ULTIMATE (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '26"', color: 'ULTIMATE WHT 35', stock: 0 },
  { code: 'HTS-BD-26-UB-35', name: 'HTS-BASS DRUM HTS 26" ULTIMATE (Head Hitam) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '26"', color: 'ULTIMATE BLK 35', stock: 0 },
  { code: 'HTS-BD-28-UW-35', name: 'HTS-BASS DRUM HTS 28" ULTIMATE (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '28"', color: 'ULTIMATE WHT 35', stock: 0 },
  { code: 'HTS-BD-28-UB-35', name: 'HTS-BASS DRUM HTS 28" ULTIMATE (Head Hitam) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '28"', color: 'ULTIMATE BLK 35', stock: 0 },

  // HTS - Bass Drum PREMIUM TK
  { code: 'HTS-BD-13-PW-TK', name: 'HTS-BASS DRUM HTS 13" PREMIUM (Head Putih)TK', category: 'HTS', subCategory: 'BASS DRUM', size: '13"', color: 'PREMIUM WHT TK', stock: 0 },
  { code: 'HTS-BD-13-PB-TK', name: 'HTS-BASS DRUM HTS 13" PREMIUM (Head Hitam) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '13"', color: 'PREMIUM BLK TK', stock: 0 },
  { code: 'HTS-BD-14-PW-TK', name: 'HTS-BASS DRUM HTS 14" PREMIUM (Head Putih) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '14"', color: 'PREMIUM WHT TK', stock: 0 },
  { code: 'HTS-BD-14-PB-TK', name: 'HTS-BASS DRUM HTS 14" PREMIUM (Head Hitam) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '14"', color: 'PREMIUM BLK TK', stock: 0 },
  { code: 'HTS-BD-16-PW-TK', name: 'HTS-BASS DRUM HTS 16" PREMIUM (Head Putih) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '16"', color: 'PREMIUM WHT TK', stock: 0 },
  { code: 'HTS-BD-16-PB-TK', name: 'HTS-BASS DRUM HTS 16" PREMIUM (Head Hitam) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '16"', color: 'PREMIUM BLK TK', stock: 0 },
  { code: 'HTS-BD-18-PW-TK', name: 'HTS-BASS DRUM HTS 18" PREMIUM (Head Putih) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '18"', color: 'PREMIUM WHT TK', stock: 0 },
  { code: 'HTS-BD-18-PB-TK', name: 'HTS-BASS DRUM HTS 18" PREMIUM (Head Hitam) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '18"', color: 'PREMIUM BLK TK', stock: 0 },
  { code: 'HTS-BD-20-PW-TK', name: 'HTS-BASS DRUM HTS 20" PREMIUM (Head Putih) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '20"', color: 'PREMIUM WHT TK', stock: 0 },
  { code: 'HTS-BD-20-PB-TK', name: 'HTS-BASS DRUM HTS 20" PREMIUM (Head Hitam) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '20"', color: 'PREMIUM BLK TK', stock: 0 },
  { code: 'HTS-BD-22-PW-TK', name: 'HTS-BASS DRUM HTS 22" PREMIUM (Head Putih) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '22"', color: 'PREMIUM WHT TK', stock: 0 },
  { code: 'HTS-BD-22-PB-TK', name: 'HTS-BASS DRUM HTS 22" PREMIUM (Head Hitam) TK', category: 'HTS', subCategory: 'BASS DRUM', size: '22"', color: 'PREMIUM BLK TK', stock: 0 },

  // HTS - Bass Drum PREMIUM 33
  { code: 'HTS-BD-13-PW-33', name: 'HTS-BASS DRUM HTS 13" PREMIUM (Head Putih) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '13"', color: 'PREMIUM WHT 33', stock: 0 },
  { code: 'HTS-BD-13-PB-33', name: 'HTS-BASS DRUM HTS 13" PREMIUM (Head Hitam) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '13"', color: 'PREMIUM BLK 33', stock: 0 },
  { code: 'HTS-BD-14-PW-33', name: 'HTS-BASS DRUM HTS 14" PREMIUM (Head Putih) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '14"', color: 'PREMIUM WHT 33', stock: 0 },
  { code: 'HTS-BD-14-PB-33', name: 'HTS-BASS DRUM HTS 14" PREMIUM (Head Hitam) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '14"', color: 'PREMIUM BLK 33', stock: 0 },
  { code: 'HTS-BD-16-PW-33', name: 'HTS-BASS DRUM HTS 16" PREMIUM (Head Putih) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '16"', color: 'PREMIUM WHT 33', stock: 0 },
  { code: 'HTS-BD-16-PB-33', name: 'HTS-BASS DRUM HTS 16" PREMIUM (Head Hitam) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '16"', color: 'PREMIUM BLK 33', stock: 0 },
  { code: 'HTS-BD-18-PW-33', name: 'HTS-BASS DRUM HTS 18" PREMIUM (Head Putih) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '18"', color: 'PREMIUM WHT 33', stock: 0 },
  { code: 'HTS-BD-18-PB-33', name: 'HTS-BASS DRUM HTS 18" PREMIUM (Head Hitam) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '18"', color: 'PREMIUM BLK 33', stock: 0 },
  { code: 'HTS-BD-20-PW-33', name: 'HTS-BASS DRUM HTS 20" PREMIUM (Head Putih) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '20"', color: 'PREMIUM WHT 33', stock: 0 },
  { code: 'HTS-BD-20-PB-33', name: 'HTS-BASS DRUM HTS 20" PREMIUM (Head Hitam) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '20"', color: 'PREMIUM BLK 33', stock: 0 },
  { code: 'HTS-BD-22-PW-33', name: 'HTS-BASS DRUM HTS 22" PREMIUM (Head Putih) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '22"', color: 'PREMIUM WHT 33', stock: 0 },
  { code: 'HTS-BD-22-PB-33', name: 'HTS-BASS DRUM HTS 22" PREMIUM (Head Hitam) 33', category: 'HTS', subCategory: 'BASS DRUM', size: '22"', color: 'PREMIUM BLK 33', stock: 0 },

  // HTS - Bass Drum PREMIUM 35
  { code: 'HTS-BD-14-PW-35A', name: 'HTS-BASS DRUM HTS 14" PREMIUM (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '14"', color: 'PREMIUM WHT 35', stock: 0 },
  { code: 'HTS-BD-14-PW-35B', name: 'HTS-BASS DRUM HTS 14" PREMIUM (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '14"', color: 'PREMIUM WHT 35', stock: 0 },
  { code: 'HTS-BD-14-PB-35', name: 'HTS-BASS DRUM HTS 14" PREMIUM (Head Hitam) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '14"', color: 'PREMIUM BLK 35', stock: 0 },
  { code: 'HTS-BD-16-PW-35', name: 'HTS-BASS DRUM HTS 16" PREMIUM (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '16"', color: 'PREMIUM WHT 35', stock: 0 },
  { code: 'HTS-BD-16-PB-35', name: 'HTS-BASS DRUM HTS 16" PREMIUM (Head Hitam) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '16"', color: 'PREMIUM BLK 35', stock: 0 },
  { code: 'HTS-BD-18-PW-35', name: 'HTS-BASS DRUM HTS 18" PREMIUM (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '18"', color: 'PREMIUM WHT 35', stock: 0 },
  { code: 'HTS-BD-18-PB-35', name: 'HTS-BASS DRUM HTS 18" PREMIUM (Head Hitam) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '18"', color: 'PREMIUM BLK 35', stock: 0 },
  { code: 'HTS-BD-20-PW-35', name: 'HTS-BASS DRUM HTS 20" PREMIUM (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '20"', color: 'PREMIUM WHT 35', stock: 0 },
  { code: 'HTS-BD-20-PB-35', name: 'HTS-BASS DRUM HTS 20" PREMIUM (Head Hitam) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '20"', color: 'PREMIUM BLK 35', stock: 0 },
  { code: 'HTS-BD-22-PW-35', name: 'HTS-BASS DRUM HTS 22" PREMIUM (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '22"', color: 'PREMIUM WHT 35', stock: 0 },
  { code: 'HTS-BD-22-PB-35', name: 'HTS-BASS DRUM HTS 22" PREMIUM (Head Hitam) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '22"', color: 'PREMIUM BLK 35', stock: 0 },
  { code: 'HTS-BD-24-PW-35', name: 'HTS-BASS DRUM HTS 24" PREMIUM (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '24"', color: 'PREMIUM WHT 35', stock: 0 },
  { code: 'HTS-BD-24-PB-35', name: 'HTS-BASS DRUM HTS 24" PREMIUM (Head Hitam) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '24"', color: 'PREMIUM BLK 35', stock: 0 },
  { code: 'HTS-BD-26-PW-35', name: 'HTS-BASS DRUM HTS 26" PREMIUM (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '26"', color: 'PREMIUM WHT 35', stock: 0 },
  { code: 'HTS-BD-26-PB-35', name: 'HTS-BASS DRUM HTS 26" PREMIUM (Head Hitam) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '26"', color: 'PREMIUM BLK 35', stock: 0 },
  { code: 'HTS-BD-28-PW-35', name: 'HTS-BASS DRUM HTS 28" PREMIUM (Head Putih) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '28"', color: 'PREMIUM WHT 35', stock: 0 },
  { code: 'HTS-BD-28-PB-35', name: 'HTS-BASS DRUM HTS 28" PREMIUM (Head Hitam) 35', category: 'HTS', subCategory: 'BASS DRUM', size: '28"', color: 'PREMIUM BLK 35', stock: 0 },

  // HTS - Quart Tom ULTIMATE TK
  { code: 'HTS-QT-06-UTK', name: 'HTS-QUART TOM HTS 6" ULTIMATE (TK)', category: 'HTS', subCategory: 'QUART TOM', size: '6"', color: 'ULTIMATE (TK)', stock: 0 },
  { code: 'HTS-QT-08-UTK', name: 'HTS-QUART TOM HTS 8" ULTIMATE (TK)', category: 'HTS', subCategory: 'QUART TOM', size: '8"', color: 'ULTIMATE (TK)', stock: 0 },
  { code: 'HTS-QT-10-UTK', name: 'HTS-QUART TOM HTS 10" ULTIMATE (TK)', category: 'HTS', subCategory: 'QUART TOM', size: '10"', color: 'ULTIMATE (TK)', stock: 0 },
  { code: 'HTS-QT-12-UTK', name: 'HTS-QUART TOM HTS 12" ULTIMATE (TK)', category: 'HTS', subCategory: 'QUART TOM', size: '12"', color: 'ULTIMATE (TK)', stock: 0 },

  // HTS - Quart Tom PREMIUM TK
  { code: 'HTS-QT-06-PTK', name: 'HTS-QUART TOM HTS 6" PREMIUM (TK)', category: 'HTS', subCategory: 'QUART TOM', size: '6"', color: 'PREMIUM (TK)', stock: 0 },
  { code: 'HTS-QT-08-PTK', name: 'HTS-QUART TOM HTS 8" PREMIUM (TK)', category: 'HTS', subCategory: 'QUART TOM', size: '8"', color: 'PREMIUM (TK)', stock: 0 },
  { code: 'HTS-QT-10-PTK', name: 'HTS-QUART TOM HTS 10" PREMIUM (TK)', category: 'HTS', subCategory: 'QUART TOM', size: '10"', color: 'PREMIUM (TK)', stock: 0 },
  { code: 'HTS-QT-12-PTK', name: 'HTS-QUART TOM HTS 12" PREMIUM (TK)', category: 'HTS', subCategory: 'QUART TOM', size: '12"', color: 'PREMIUM (TK)', stock: 0 },

  // HTS - Quart/Quint Tom ULTIMATE
  { code: 'HTS-QT-06-ULT', name: 'HTS-QUART TOM HTS 6" ULTIMATE', category: 'HTS', subCategory: 'QUART TOM', size: '6"', color: 'ULTIMATE', stock: 0 },
  { code: 'HTS-QNT-08-ULT', name: 'HTS-QUINT TOM HTS 8" ULTIMATE', category: 'HTS', subCategory: 'QUINT TOM', size: '8"', color: 'ULTIMATE', stock: 0 },
  { code: 'HTS-QT-10-ULT', name: 'HTS-QUART TOM HTS 10" ULTIMATE', category: 'HTS', subCategory: 'QUART TOM', size: '10"', color: 'ULTIMATE', stock: 0 },
  { code: 'HTS-QNT-12-ULT', name: 'HTS-QUINT TOM HTS 12" ULTIMATE', category: 'HTS', subCategory: 'QUINT TOM', size: '12"', color: 'ULTIMATE', stock: 0 },
  { code: 'HTS-QNT-13-ULT', name: 'HTS-QUINT TOM HTS 13" ULTIMATE', category: 'HTS', subCategory: 'QUINT TOM', size: '13"', color: 'ULTIMATE', stock: 0 },

  // HTS - Quart/Quint Tom PREMIUM
  { code: 'HTS-QT-06-PRM', name: 'HTS-QUART TOM HTS 6" PREMIUM', category: 'HTS', subCategory: 'QUART TOM', size: '6"', color: 'PREMIUM', stock: 0 },
  { code: 'HTS-QT-08-PRM', name: 'HTS-QUART TOM HTS 8" PREMIUM', category: 'HTS', subCategory: 'QUART TOM', size: '8"', color: 'PREMIUM', stock: 0 },
  { code: 'HTS-QT-10-PRM', name: 'HTS-QUART TOM HTS 10" PREMIUM', category: 'HTS', subCategory: 'QUART TOM', size: '10"', color: 'PREMIUM', stock: 0 },
  { code: 'HTS-QNT-12-PRM', name: 'HTS-QUINT TOM HTS 12" PREMIUM', category: 'HTS', subCategory: 'QUINT TOM', size: '12"', color: 'PREMIUM', stock: 0 },
  { code: 'HTS-QT-13-PRM', name: 'HTS-QUART TOM HTS 13" PREMIUM', category: 'HTS', subCategory: 'QUART TOM', size: '13"', color: 'PREMIUM', stock: 0 },
];

async function main() {
  console.log('Seeding products...');
  
  for (const product of products) {
    await prisma.product.upsert({
      where: { code: product.code },
      update: product,
      create: product,
    });
  }

  console.log(`Seeded ${products.length} products successfully!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
