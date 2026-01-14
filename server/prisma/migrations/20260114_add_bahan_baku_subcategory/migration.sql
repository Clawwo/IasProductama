-- Add subCategory column to BahanBaku
ALTER TABLE "BahanBaku" ADD COLUMN "subCategory" TEXT;

-- Backfill subCategory for existing rows
UPDATE "BahanBaku" SET "subCategory" = 'alumunium' WHERE "name" = 'ALUMUNIUM M';
UPDATE "BahanBaku" SET "subCategory" = 'baut' WHERE "name" IN (
  'BAUT UK 10, PANJANG 1,5CM',
  'BAUT UK 10, PANJANG 3CM',
  'BAUT UK 10, PANJANG 4CM'
);
UPDATE "BahanBaku" SET "subCategory" = 'benang' WHERE "name" = 'BENANG WOLL';
UPDATE "BahanBaku" SET "subCategory" = 'besi' WHERE "name" IN (
  'BESI 0,77X15/35',
  'BESI 1,15X19/39',
  'BESI L 28/28 A',
  'BESI TEBAL 0,6CM'
);
UPDATE "BahanBaku" SET "subCategory" = 'cat' WHERE "name" IN (
  'CAT DANA GLOSS',
  'CAT ISAMU CLEAR',
  'CAT ISAMU HITAM',
  'CAT ISAMU PUTIH',
  'CAT ISAMU SILVER',
  'CAT SUZUKA HIJAU',
  'CAT SUZUKA MERAH',
  'CAT SUZUKA ORANGE',
  'CAT VINOTEX HITAM',
  'CLEAR GLOSSY',
  'DEMPUL IMPRA PROPAN'
);
UPDATE "BahanBaku" SET "subCategory" = 'glitter' WHERE "name" IN (
  'GLITER BIRU MUDA',
  'GLITER BIRU TUA',
  'GLITER HIJAU',
  'GLITER HITAM SPARKLE',
  'GLITER MERAH',
  'GLITER ORANGE',
  'GLITER SILVER'
);
UPDATE "BahanBaku" SET "subCategory" = 'hpl' WHERE "name" IN (
  'HPL MOTIF HITAM KRAMIK',
  'HPL MOTIF JATI',
  'HPL PUTIH TULANG'
);
UPDATE "BahanBaku" SET "subCategory" = 'lem' WHERE "name" IN (
  'LEM AIBON SUPER',
  'LEM ALTECO',
  'LEM GESTON',
  'LEM PRESTO',
  'LEM RESIN'
);
UPDATE "BahanBaku" SET "subCategory" = 'mahkota' WHERE "name" = 'MAHKOTA';
UPDATE "BahanBaku" SET "subCategory" = 'mika' WHERE "name" = 'MIKA';
UPDATE "BahanBaku" SET "subCategory" = 'pipa' WHERE "name" IN (
  'PIPA 0,5 INCH',
  'PIPA 1 INCH',
  'PIPA SENAR',
  'PIPA STAINLESS 0,8X3/4ML'
);
UPDATE "BahanBaku" SET "subCategory" = 'plat' WHERE "name" IN (
  'PLAT BESI',
  'PLAT SETRIP 30X3ML'
);
UPDATE "BahanBaku" SET "subCategory" = 'remover' WHERE "name" = 'REMOVER';
UPDATE "BahanBaku" SET "subCategory" = 'tali' WHERE "name" = 'TALI MAYORET';
UPDATE "BahanBaku" SET "subCategory" = 'kayu' WHERE "name" = 'TEAKWOOD';
UPDATE "BahanBaku" SET "subCategory" = 'thiner' WHERE "name" = 'THINER';
UPDATE "BahanBaku" SET "subCategory" = 'triplek' WHERE "name" IN (
  'TRIPLEK TEBAL 2,2MM',
  'TRIPLEK TEBAL 3MM'
);

-- Remove amplas items as requested
DELETE FROM "BahanBaku" WHERE "name" IN (
  'AMPLAS A100',
  'AMPLAS A240',
  'AMPLAS A80'
);
