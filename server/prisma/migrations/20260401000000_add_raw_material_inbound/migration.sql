-- CreateTable
CREATE TABLE IF NOT EXISTS "RawMaterialInbound" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "RawMaterialInbound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RawMaterialInbound_code_key" ON "RawMaterialInbound"("code");
CREATE INDEX IF NOT EXISTS "RawMaterialInbound_createdById_idx" ON "RawMaterialInbound"("createdById");
CREATE INDEX IF NOT EXISTS "RawMaterialInbound_date_idx" ON "RawMaterialInbound"("date");

-- CreateTable
CREATE TABLE IF NOT EXISTS "RawMaterialInboundLine" (
    "id" TEXT NOT NULL,
    "inboundId" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "materialName" TEXT,
    "category" TEXT,
    "subCategory" TEXT,
    "kind" TEXT,
    "qty" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawMaterialInboundLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RawMaterialInboundLine_inboundId_idx" ON "RawMaterialInboundLine"("inboundId");
CREATE INDEX IF NOT EXISTS "RawMaterialInboundLine_materialCode_idx" ON "RawMaterialInboundLine"("materialCode");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "RawMaterialInbound"
  ADD CONSTRAINT "RawMaterialInbound_createdById_fkey" FOREIGN KEY ("createdById")
  REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "RawMaterialInboundLine"
  ADD CONSTRAINT "RawMaterialInboundLine_inboundId_fkey" FOREIGN KEY ("inboundId")
  REFERENCES "RawMaterialInbound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "RawMaterialInboundLine"
  ADD CONSTRAINT "RawMaterialInboundLine_materialCode_fkey" FOREIGN KEY ("materialCode")
  REFERENCES "BahanBaku"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
