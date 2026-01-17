-- Idempotent migration to add Product, Bom, and BomLine plus ProductionRawLine.sourceType
-- Safe for re-run: uses IF NOT EXISTS guards.

-- 1) Enum BomSourceType
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bom_source_type') THEN
    CREATE TYPE "BomSourceType" AS ENUM ('ITEM', 'BAHAN_BAKU');
  END IF;
END $$;

-- 2) Product table
CREATE TABLE IF NOT EXISTS "Product" (
  "code"      TEXT PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "category"  TEXT NOT NULL,
  "subCategory" TEXT,
  "size"      TEXT,
  "color"     TEXT,
  "stock"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) Bom header table
CREATE TABLE IF NOT EXISTS "Bom" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "productCode" TEXT UNIQUE NOT NULL,
  "productName" TEXT,
  "category"    TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4) BomLine table
CREATE TABLE IF NOT EXISTS "BomLine" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "bomId"      UUID NOT NULL,
  "sourceType" "BomSourceType" NOT NULL DEFAULT 'BAHAN_BAKU',
  "code"       TEXT,
  "name"       TEXT,
  "qty"        DOUBLE PRECISION NOT NULL,
  CONSTRAINT "BomLine_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE CASCADE
);

-- index for bomId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'BomLine_bomId_idx'
  ) THEN
    CREATE INDEX "BomLine_bomId_idx" ON "BomLine"("bomId");
  END IF;
END $$;

-- 5) ProductionRawLine.sourceType column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ProductionRawLine' AND column_name = 'sourceType'
  ) THEN
    ALTER TABLE "ProductionRawLine"
    ADD COLUMN "sourceType" "BomSourceType" NOT NULL DEFAULT 'BAHAN_BAKU';
  END IF;
END $$;

-- 6) trigger updatedAt on Product and Bom
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW."updatedAt" = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

CREATE TRIGGER IF NOT EXISTS "Product_updatedAt_trg"
  BEFORE UPDATE ON "Product"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER IF NOT EXISTS "Bom_updatedAt_trg"
  BEFORE UPDATE ON "Bom"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
