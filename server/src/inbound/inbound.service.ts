import { Injectable } from '@nestjs/common';
import { CreateInboundDto } from './dto/create-inbound.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
export class InboundService {
  constructor(private readonly prisma: PrismaService) {}

  async findRecent(limit = 20) {
    const take =
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    return this.prisma.inbound.findMany({
      take,
      orderBy: { date: 'desc' },
      include: { lines: true },
    });
  }

  async create(dto: CreateInboundDto) {
    return this.prisma.$transaction(async (tx) => {
      const date = new Date(dto.date);
      const dayStart = startOfDay(date);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const sameDayCount = await tx.inbound.count({
        where: { date: { gte: dayStart, lt: dayEnd } },
      });
      const code = formatTxnCode('IN', dayStart, sameDayCount + 1);

      const inbound = await tx.inbound.create({
        data: {
          code,
          vendor: dto.vendor,
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
        const isRaw = (line.category ?? '')
          .toLowerCase()
          .startsWith('bahan baku');

        if (isRaw) {
          await tx.bahanBaku.upsert({
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
              name: line.name,
              category: line.category,
              subCategory: line.subCategory,
              kind: line.kind,
              stock: line.qty,
            },
          });
        } else {
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
              name: line.name,
              category: line.category,
              subCategory: line.subCategory,
              kind: line.kind,
              stock: line.qty,
            },
          });
        }
      }

      return inbound;
    });
  }
}
