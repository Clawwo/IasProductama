import { Injectable } from '@nestjs/common';
import { CreateInboundDto } from './dto/create-inbound.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class InboundService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInboundDto) {
    const created = await this.prisma.inbound.create({
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

    return created;
  }
}
