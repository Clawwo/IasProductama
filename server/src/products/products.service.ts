import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.product.findMany({ orderBy: { code: 'asc' } });
  }

  findOne(code: string) {
    return this.prisma.product.findUnique({ where: { code } });
  }

  create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        code: dto.code,
        name: dto.name,
        category: dto.category,
        subCategory: dto.subCategory,
        size: dto.size,
        color: dto.color,
        stock: dto.stock ?? 0,
      },
    });
  }

  async update(code: string, dto: UpdateProductDto) {
    const exists = await this.prisma.product.findUnique({
      where: { code },
    });
    if (!exists) throw new NotFoundException('Product not found');

    return this.prisma.product.update({
      where: { code },
      data: {
        name: dto.name ?? undefined,
        category: dto.category ?? undefined,
        subCategory: dto.subCategory ?? undefined,
        size: dto.size ?? undefined,
        color: dto.color ?? undefined,
        stock: dto.stock ?? undefined,
      },
    });
  }

  async remove(code: string) {
    const exists = await this.prisma.product.findUnique({
      where: { code },
    });
    if (!exists) throw new NotFoundException('Product not found');
    return this.prisma.product.delete({ where: { code } });
  }
}
