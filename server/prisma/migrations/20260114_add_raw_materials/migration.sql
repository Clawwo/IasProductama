-- Create RawMaterial table
CREATE TABLE "RawMaterial" (
    "code" TEXT NOT NULL,
    "name" TEXT,
    "category" TEXT,
    "unit" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawMaterial_pkey" PRIMARY KEY ("code")
);

-- Trigger to maintain updatedAt
CREATE OR REPLACE FUNCTION set_rawmaterial_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rawmaterial_set_updated_at ON "RawMaterial";
CREATE TRIGGER rawmaterial_set_updated_at
BEFORE UPDATE ON "RawMaterial"
FOR EACH ROW
EXECUTE FUNCTION set_rawmaterial_updated_at();
