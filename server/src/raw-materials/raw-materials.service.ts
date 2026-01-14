import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto.js';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto.js';

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
}
