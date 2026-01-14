import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto.js';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto.js';

@Injectable()
export class RawMaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    // Treat any category that starts with "Bahan Baku" (case-insensitive) as a raw material
    return this.prisma.item.findMany({
      where: {
        category: {
          startsWith: 'Bahan Baku',
          mode: 'insensitive',
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  findOne(code: string) {
    return this.prisma.item.findUnique({ where: { code } });
  }

  create(dto: CreateRawMaterialDto) {
    return this.prisma.item.create({
      data: {
        code: dto.code,
        name: dto.name,
        category: dto.category,
        // Item model has no unit; keep other fields aligned
        stock: dto.stock ?? 0,
      },
    });
  }

  async update(code: string, dto: UpdateRawMaterialDto) {
    const exists = await this.prisma.item.findUnique({
      where: { code },
    });
    if (!exists) throw new NotFoundException('Raw material not found');

    return this.prisma.item.update({
      where: { code },
      data: {
        name: dto.name ?? undefined,
        category: dto.category ?? undefined,
        stock: dto.stock ?? undefined,
      },
    });
  }

  async remove(code: string) {
    const exists = await this.prisma.item.findUnique({
      where: { code },
    });
    if (!exists) throw new NotFoundException('Raw material not found');
    await this.prisma.item.delete({ where: { code } });
    return { success: true };
  }
}
