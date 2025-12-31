-- CreateTable
CREATE TABLE "Item" (
    "code" TEXT NOT NULL,
    "name" TEXT,
    "category" TEXT,
    "subCategory" TEXT,
    "kind" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Item_pkey" PRIMARY KEY ("code")
);

-- Trigger to update updatedAt on update (Postgres)
CREATE OR REPLACE FUNCTION set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS item_set_updated_at ON "Item";
CREATE TRIGGER item_set_updated_at
BEFORE UPDATE ON "Item"
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp_updated_at();
