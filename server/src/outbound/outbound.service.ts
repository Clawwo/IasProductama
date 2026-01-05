import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOutboundDto } from './dto/create-outbound.dto.js';

@Injectable()
export class OutboundService {
  constructor(private readonly prisma: PrismaService) {}

  async findRecent(limit = 20) {
    const take = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    return this.prisma.outbound.findMany({
      take,
      orderBy: { date: 'desc' },
      include: { lines: true },
    });
  }

  async create(dto: CreateOutboundDto) {
    return this.prisma.$transaction(async (tx) => {
      const outbound = await tx.outbound.create({
        data: {
          orderer: dto.orderer,
          date: new Date(dto.date),
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
        const existing = await tx.item.findUnique({ where: { code: line.code } });
        if (!existing || existing.stock < line.qty) {
          throw new BadRequestException(
            `Stok untuk ${line.code} tidak cukup. Sisa: ${existing?.stock ?? 0}`,
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
      }

      return outbound;
    });
  }
}
