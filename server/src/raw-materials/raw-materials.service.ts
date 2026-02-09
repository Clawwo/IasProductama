import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto.js';
import { CreateRawMaterialOutboundDto } from './dto/create-raw-material-outbound.dto.js';
import { ReceiveRawMaterialOutboundLineDto } from './dto/receive-raw-material-outbound-line.dto.js';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto.js';

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
export class RawMaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.bahanBaku.findMany({ orderBy: { code: 'asc' } });
  }

  findOne(code: string) {
    return this.prisma.bahanBaku.findUnique({ where: { code } });
  }

  create(dto: CreateRawMaterialDto) {
    return this.prisma.bahanBaku.create({
      data: {
        code: dto.code,
        name: dto.name,
        category: dto.category,
        subCategory: dto.subCategory,
        kind: dto.kind,
        stock: dto.stock ?? 0,
      },
    });
  }

  async update(code: string, dto: UpdateRawMaterialDto) {
    const exists = await this.prisma.bahanBaku.findUnique({
      where: { code },
    });
    if (!exists) throw new NotFoundException('Raw material not found');

    return this.prisma.bahanBaku.update({
      where: { code },
      data: {
        name: dto.name ?? undefined,
        category: dto.category ?? undefined,
        subCategory: dto.subCategory ?? undefined,
        kind: dto.kind ?? undefined,
        stock: dto.stock ?? undefined,
      },
    });
  }

  async remove(code: string) {
    const exists = await this.prisma.bahanBaku.findUnique({
      where: { code },
    });
    if (!exists) throw new NotFoundException('Raw material not found');
    await this.prisma.bahanBaku.delete({ where: { code } });
    return { success: true };
  }

  findOutboundRecent(limit = 20) {
    const take =
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    return this.prisma.rawMaterialOutbound.findMany({
      take,
      orderBy: { date: 'desc' },
      include: {
        lines: { orderBy: { createdAt: 'asc' } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async createOutbound(dto: CreateRawMaterialOutboundDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const date = new Date(dto.date);
      const dayStart = startOfDay(date);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const sameDayCount = await tx.rawMaterialOutbound.count({
        where: { date: { gte: dayStart, lt: dayEnd } },
      });
      const code = formatTxnCode('RM-OUT', dayStart, sameDayCount + 1);

      for (const line of dto.lines) {
        const existing = await tx.bahanBaku.findUnique({
          where: { code: line.code },
        });
        if (!existing) {
          throw new BadRequestException(
            `Bahan baku ${line.code} tidak ditemukan.`,
          );
        }
        if ((existing.stock ?? 0) < line.qty) {
          throw new BadRequestException(
            `Stok bahan baku ${line.code} tidak cukup. Sisa: ${existing.stock ?? 0}`,
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

      return tx.rawMaterialOutbound.create({
        data: {
          code,
          artisan: dto.artisan,
          date,
          note: dto.note,
          createdById: userId ?? undefined,
          lines: {
            create: dto.lines.map((line) => ({
              materialCode: line.code,
              materialName: line.name ?? undefined,
              category: line.category ?? undefined,
              subCategory: line.subCategory ?? undefined,
              kind: line.kind ?? undefined,
              batchCode: line.batchCode,
              qty: line.qty,
              note: line.note,
            })),
          },
        },
        include: { lines: { orderBy: { createdAt: 'asc' } } },
      });
    });
  }

  async receiveOutboundLine(
    lineId: string,
    dto: ReceiveRawMaterialOutboundLineDto,
    userId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const line = await tx.rawMaterialOutboundLine.findUnique({
        where: { id: lineId },
      });

      if (!line) {
        throw new NotFoundException('Tracking bahan baku tidak ditemukan');
      }

      if (line.status === 'RECEIVED') {
        return line;
      }

      const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();

      const updated = await tx.rawMaterialOutboundLine.update({
        where: { id: lineId },
        data: {
          status: 'RECEIVED',
          receivedAt,
          receivedBy: dto.receivedBy ?? userId ?? undefined,
        },
      });

      const remaining = await tx.rawMaterialOutboundLine.count({
        where: { outboundId: line.outboundId, status: 'OUT' },
      });

      if (remaining === 0) {
        await tx.rawMaterialOutbound.update({
          where: { id: line.outboundId },
          data: { status: 'RECEIVED', receivedAt },
        });
      }

      return updated;
    });
  }
}
