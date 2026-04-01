import { BadRequestException, Injectable } from '@nestjs/common';
import { BomSourceType, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductionDto } from './dto/create-production.dto.js';

function startOfDay(value: Date) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatTxnCode(prefix: string, date: Date, sequence: number) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${prefix}-${yyyy}${mm}${dd}-${String(sequence).padStart(4, '0')}`;
}

@Injectable()
export class ProductionService {
  constructor(private readonly prisma: PrismaService) {}

  async findRecent(limit = 20) {
    const prisma = this.prisma as unknown as PrismaClient;
    const take =
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    return await prisma.production.findMany({
      take,
      orderBy: { date: 'desc' },
      include: { rawLines: true, finishedLines: true },
    });
  }

  async create(dto: CreateProductionDto) {
    const prisma = this.prisma as unknown as PrismaClient;
    
    // Pre-fetch all items and raw materials
    const rawCodes = dto.rawLines.map((l) => l.code);
    const date = new Date(dto.date);
    const dayStart = startOfDay(date);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [items, raws, sameDayCount] = await Promise.all([
      this.prisma.item.findMany({ where: { code: { in: rawCodes } } }),
      this.prisma.bahanBaku.findMany({ where: { code: { in: rawCodes } } }),
      this.prisma.production.count({
        where: { date: { gte: dayStart, lt: dayEnd } },
      }),
    ]);

    const itemMap = new Map(items.map((i) => [i.code, i]));
    const rawMap = new Map(raws.map((r) => [r.code, r]));

    // Validate all raw materials exist and have sufficient stock before transaction
    for (const line of dto.rawLines) {
      const sourceType = line.sourceType ?? 'BAHAN_BAKU';
      let found = sourceType === 'ITEM' ? itemMap.get(line.code) : rawMap.get(line.code);

      if (!found) {
        // Try fallback
        found = sourceType === 'ITEM' ? rawMap.get(line.code) : itemMap.get(line.code);
      }

      if (!found) {
        throw new BadRequestException(
          `${sourceType === 'ITEM' ? 'Item' : 'Bahan baku'} ${line.code} tidak ditemukan.`,
        );
      }

      if ((found.stock ?? 0) < line.qty) {
        throw new BadRequestException(
          `Stok untuk ${line.code} tidak cukup. Sisa: ${found.stock ?? 0}`,
        );
      }
    }

    return prisma.$transaction(
      async (tx) => {
        const code = formatTxnCode('PROD', dayStart, sameDayCount + 1);

        // Decrement raw materials
        for (const line of dto.rawLines) {
          const sourceType = line.sourceType ?? 'BAHAN_BAKU';
          let found = sourceType === 'ITEM' ? itemMap.get(line.code) : rawMap.get(line.code);

          if (!found) {
            found = sourceType === 'ITEM' ? rawMap.get(line.code) : itemMap.get(line.code);
          }

          const isItem = !(!itemMap.get(line.code) && rawMap.get(line.code));

          if (isItem) {
            await tx.item.update({
              where: { code: line.code },
              data: {
                stock: { decrement: line.qty },
                name: line.name ?? undefined,
                category: line.category ?? undefined,
                subCategory: line.subCategory ?? undefined,
                kind: line.kind ?? undefined,
              },
            });
          } else {
            await tx.bahanBaku.update({
              where: { code: line.code },
              data: {
                stock: { decrement: line.qty },
                name: line.name ?? undefined,
                category: line.category ?? undefined,
                subCategory: line.subCategory ?? undefined,
                kind: line.kind ?? undefined,
              },
            });
          }
        }

        // Increment finished products
        for (const line of dto.finishedLines) {
          await tx.item.upsert({
            where: { code: line.code },
            update: {
              stock: { increment: line.qty },
              name: line.name ?? undefined,
              category: line.category ?? undefined,
              subCategory: line.subCategory ?? undefined,
              kind: line.kind ?? undefined,
            },
            create: {
              code: line.code,
              name: line.name ?? undefined,
              category: line.category ?? undefined,
              subCategory: line.subCategory ?? undefined,
              kind: line.kind ?? undefined,
              stock: line.qty,
            },
          });
        }

        const production = await tx.production.create({
          data: {
            code,
            date,
            note: dto.note,
            rawLines: {
              create: dto.rawLines.map((l) => ({
                code: l.code,
                name: l.name,
                category: l.category,
                subCategory: l.subCategory,
                kind: l.kind,
                qty: l.qty,
                note: l.note,
                sourceType:
                  (l.sourceType as BomSourceType | undefined) ??
                  BomSourceType.BAHAN_BAKU,
              })),
            },
            finishedLines: {
              create: dto.finishedLines.map((l) => ({
                code: l.code,
                name: l.name,
                category: l.category,
                subCategory: l.subCategory,
                kind: l.kind,
                qty: l.qty,
                note: l.note,
              })),
            },
          },
          include: { rawLines: true, finishedLines: true },
        });

        return production;
      },
      {
        timeout: 120000, // 120 seconds timeout
      },
    );
  }
}
