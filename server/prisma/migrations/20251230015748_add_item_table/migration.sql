-- CreateTable
CREATE TABLE "Item" (
    "code" TEXT NOT NULL,
    "name" TEXT,
    "category" TEXT,
    "subCategory" TEXT,
    "kind" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("code")
);
