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
    // Pre-fetch all items OUTSIDE transaction to validate stock early
    const codes = dto.lines.map((l) => l.code);
    const [items, raws, products, sameDayCount] = await Promise.all([
      this.prisma.item.findMany({ where: { code: { in: codes } } }),
      this.prisma.bahanBaku.findMany({ where: { code: { in: codes } } }),
      this.prisma.product.findMany({ where: { code: { in: codes } } }),
      this.prisma.outbound.count({
        where: {
          date: {
            gte: startOfDay(new Date(dto.date)),
            lt: (() => {
              const d = startOfDay(new Date(dto.date));
              d.setDate(d.getDate() + 1);
              return d;
            })(),
          },
        },
      }),
    ]);

    // Create a map for quick lookup and validate stock
    const itemMap = new Map(items.map((i) => [i.code, { type: 'item', data: i }]));
    const rawMap = new Map(raws.map((r) => [r.code, { type: 'raw', data: r }]));
    const productMap = new Map(
      products.map((p) => [p.code, { type: 'product', data: p }]),
    );

    // Validate all items exist and have sufficient stock
    for (const line of dto.lines) {
      const found = itemMap.get(line.code) ?? rawMap.get(line.code) ?? productMap.get(line.code);
      if (!found) {
        throw new BadRequestException(
          `Kode ${line.code} tidak ditemukan di Item/Bahan Baku/Produk`,
        );
      }
      if ((found.data.stock ?? 0) < line.qty) {
        throw new BadRequestException(
          `Stok untuk ${line.code} tidak cukup. Sisa: ${found.data.stock ?? 0}`,
        );
      }
    }

    // Now do minimal transaction - only write operations
    return this.prisma.$transaction(
      async (tx) => {
        const date = new Date(dto.date);
        const dayStart = startOfDay(date);
        const code = formatTxnCode('OUT', dayStart, sameDayCount + 1);

        // Create outbound with lines
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

        // Update all items - separate loops to reduce transaction conflicts
        const itemUpdates = dto.lines.filter((l) => itemMap.has(l.code));
        for (const line of itemUpdates) {
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
        }

        // Update raw materials
        const rawUpdates = dto.lines.filter((l) => rawMap.has(l.code));
        for (const line of rawUpdates) {
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

        // Update products
        const productUpdates = dto.lines.filter((l) => productMap.has(l.code));
        for (const line of productUpdates) {
          await tx.product.update({
            where: { code: line.code },
            data: {
              stock: { decrement: line.qty },
              name: line.name ?? undefined,
              category: line.category ?? undefined,
              subCategory: line.subCategory ?? undefined,
              size: line.kind ?? undefined,
            },
          });
        }

        return outbound;
      },
      {
        timeout: 120000, // 120 seconds timeout
      },
    );
  }
}
