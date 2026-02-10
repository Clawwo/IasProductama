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
      include: {
        rawLines: true,
        finishedLines: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async create(dto: CreateProductionDto, userId?: string) {
    const prisma = this.prisma as unknown as PrismaClient;
    return prisma.$transaction(async (tx) => {
      const date = new Date(dto.date);
      const dayStart = startOfDay(date);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const sameDayCount = await tx.production.count({
        where: { date: { gte: dayStart, lt: dayEnd } },
      });
      const code = formatTxnCode('PROD', dayStart, sameDayCount + 1);

      for (const line of dto.rawLines) {
        const sourceType = line.sourceType ?? 'BAHAN_BAKU';

        if (sourceType === 'ITEM') {
          const existingItem = await tx.item.findUnique({
            where: { code: line.code },
          });

          if (!existingItem) {
            // Fallback: if mistakenly marked ITEM but lives in bahan baku, try there
            const fallbackRaw = await tx.bahanBaku.findUnique({
              where: { code: line.code },
            });
            if (!fallbackRaw) {
              throw new BadRequestException(
                `Item ${line.code} tidak ditemukan.`,
              );
            }
            if ((fallbackRaw.stock ?? 0) < line.qty) {
              throw new BadRequestException(
                `Stok bahan baku ${line.code} tidak cukup. Sisa: ${fallbackRaw.stock ?? 0}`,
              );
            }
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
            continue;
          }

          if ((existingItem.stock ?? 0) < line.qty) {
            throw new BadRequestException(
              `Stok item ${line.code} tidak cukup. Sisa: ${existingItem.stock ?? 0}`,
            );
          }

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
          const existingRaw = await tx.bahanBaku.findUnique({
            where: { code: line.code },
          });

          if (!existingRaw) {
            // Fallback: if sourceType omitted/mistaken but item exists, consume item
            const fallbackItem = await tx.item.findUnique({
              where: { code: line.code },
            });
            if (!fallbackItem) {
              throw new BadRequestException(
                `Bahan baku ${line.code} tidak ditemukan.`,
              );
            }
            if ((fallbackItem.stock ?? 0) < line.qty) {
              throw new BadRequestException(
                `Stok item ${line.code} tidak cukup. Sisa: ${fallbackItem.stock ?? 0}`,
              );
            }
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
            continue;
          }

          if ((existingRaw.stock ?? 0) < line.qty) {
            throw new BadRequestException(
              `Stok bahan baku ${line.code} tidak cukup. Sisa: ${existingRaw.stock ?? 0}`,
            );
          }

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
          createdById: userId ?? undefined,
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
    });
  }
}
