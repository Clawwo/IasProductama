-- CreateTable
CREATE TABLE "Outbound" (
    "id" TEXT NOT NULL,
    "orderer" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outbound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundLine" (
    "id" TEXT NOT NULL,
    "outboundId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "OutboundLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboundLine_outboundId_idx" ON "OutboundLine"("outboundId");

-- AddForeignKey
ALTER TABLE "OutboundLine" ADD CONSTRAINT "OutboundLine_outboundId_fkey" FOREIGN KEY ("outboundId") REFERENCES "Outbound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
