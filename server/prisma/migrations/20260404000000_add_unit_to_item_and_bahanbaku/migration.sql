-- Add unit column to Item and BahanBaku
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'PCS';
ALTER TABLE "BahanBaku" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'PCS';

-- Backfill known units for existing BahanBaku rows
UPDATE "BahanBaku" SET "unit" = 'GRAM'
WHERE lower(coalesce("subCategory", '')) IN ('cat', 'glitter');

UPDATE "BahanBaku" SET "unit" = 'METER'
WHERE lower(coalesce("subCategory", '')) = 'pipa';
