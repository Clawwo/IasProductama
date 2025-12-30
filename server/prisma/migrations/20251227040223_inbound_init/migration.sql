-- CreateTable
CREATE TABLE "Inbound" (
    "id" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inbound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundLine" (
    "id" TEXT NOT NULL,
    "inboundId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "InboundLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboundLine_inboundId_idx" ON "InboundLine"("inboundId");

-- AddForeignKey
ALTER TABLE "InboundLine" ADD CONSTRAINT "InboundLine_inboundId_fkey" FOREIGN KEY ("inboundId") REFERENCES "Inbound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
