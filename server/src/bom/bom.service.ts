import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BomService {
  constructor(private readonly prisma: PrismaService) {}

  async findOneByCodeOrName(code?: string, name?: string) {
    const where = code
      ? { productCode: code }
      : name
        ? {
            OR: [
              { productCode: name },
              { productName: { equals: name, mode: 'insensitive' as const } },
            ],
          }
        : undefined;

    if (!where) {
      throw new NotFoundException('Kode atau nama wajib diisi');
    }

    const bom = await this.prisma.bom.findFirst({
      where,
      include: { lines: { orderBy: { name: 'asc' } } },
    });

    if (!bom) throw new NotFoundException('BOM tidak ditemukan');
    return bom;
  }
}
