import { Injectable } from '@nestjs/common';
import { CreateInboundDto } from './dto/create-inbound.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class InboundService {
  constructor(private readonly prisma: PrismaService) {}

  async findRecent(limit = 20) {
    const take = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    return this.prisma.inbound.findMany({
      take,
      orderBy: { date: 'desc' },
      include: { lines: true },
    });
  }

  async create(dto: CreateInboundDto) {
    return this.prisma.$transaction(async (tx) => {
      const inbound = await tx.inbound.create({
        data: {
          vendor: dto.vendor,
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

      return inbound;
    });
  }
}
