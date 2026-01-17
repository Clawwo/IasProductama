import { Prisma } from '@prisma/client';

declare module '@prisma/client' {
  interface PrismaClient {
    production: Prisma.ProductionDelegate;
    productionRawLine: Prisma.ProductionRawLineDelegate;
    productionFinishedLine: Prisma.ProductionFinishedLineDelegate;
  }
}
