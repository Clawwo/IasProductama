import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOutboundDto } from './dto/create-outbound.dto.js';

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
export class OutboundService {
  constructor(private readonly prisma: PrismaService) {}

  async findRecent(limit = 20) {
    const take =
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    return this.prisma.outbound.findMany({
      take,
      orderBy: { date: 'desc' },
      include: { lines: true },
    });
  }

  async create(dto: CreateOutboundDto) {
    return this.prisma.$transaction(async (tx) => {
      const date = new Date(dto.date);
      const dayStart = startOfDay(date);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const sameDayCount = await tx.outbound.count({
        where: { date: { gte: dayStart, lt: dayEnd } },
      });
      const code = formatTxnCode('OUT', dayStart, sameDayCount + 1);

      const outbound = await tx.outbound.create({
        data: {
          code,
          orderer: dto.orderer,
          date,
          note: dto.note,
          lines: {
            create: dto.lines.map((l) => ({
              code: l.code,
              qty: l.qty,
              note: l.note,
            })),
          },
        },
        include: { lines: true },
      });

      for (const line of dto.lines) {
        const existingItem = await tx.item.findUnique({
          where: { code: line.code },
        });
        const existingRaw = existingItem
          ? null
          : await tx.bahanBaku.findUnique({ where: { code: line.code } });
        const existingProduct =
          existingItem || existingRaw
            ? null
            : await tx.product.findUnique({ where: { code: line.code } });

        const target = existingItem ?? existingRaw ?? existingProduct;
        if (!target) {
          throw new BadRequestException(
            `Kode ${line.code} tidak ditemukan di Item/Bahan Baku/Produk`,
          );
        }

        if ((target.stock ?? 0) < line.qty) {
          throw new BadRequestException(
            `Stok untuk ${line.code} tidak cukup. Sisa: ${target.stock ?? 0}`,
          );
        }

        if (existingItem) {
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
        } else if (existingRaw) {
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
        } else if (existingProduct) {
          await tx.product.update({
            where: { code: line.code },
            data: {
              stock: { decrement: line.qty },
              name: line.name ?? undefined,
              category: line.category ?? undefined,
              subCategory: line.subCategory ?? undefined,
              size: line.kind ?? undefined,
              // color intentionally left untouched
            },
          });
        }
      }

      return outbound;
    });
  }
}
