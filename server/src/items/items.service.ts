import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateItemDto } from './dto/create-item.dto.js';
import { UpdateItemDto } from './dto/update-item.dto.js';

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.item.findMany({ orderBy: { code: 'asc' } });
  }

  findOne(code: string) {
    return this.prisma.item.findUnique({ where: { code } });
  }

  async create(dto: CreateItemDto) {
    return this.prisma.item.create({
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

  async update(code: string, dto: UpdateItemDto) {
    const exists = await this.prisma.item.findUnique({ where: { code } });
    if (!exists) throw new NotFoundException('Item not found');

    return this.prisma.item.update({
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
    const exists = await this.prisma.item.findUnique({ where: { code } });
    if (!exists) throw new NotFoundException('Item not found');
    await this.prisma.item.delete({ where: { code } });
    return { success: true };
  }
}
