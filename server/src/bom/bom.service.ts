import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

function normalize(text: string | null | undefined) {
  return (text ?? '')
    .toLowerCase()
    .replace(/[`"']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string | null | undefined) {
  const normalized = normalize(text);
  if (!normalized) return [] as string[];
  return normalized.split(' ').filter(Boolean);
}

@Injectable()
export class BomService {
  constructor(private readonly prisma: PrismaService) {}

  async findOneByCodeOrName(code?: string, name?: string) {
    const or: Array<Record<string, unknown>> = [];
    if (code) {
      or.push({ productCode: code });
      or.push({ productName: { equals: code, mode: 'insensitive' as const } });
    }
    if (name) {
      or.push({ productCode: name });
      or.push({ productName: { equals: name, mode: 'insensitive' as const } });
    }
    const where = or.length ? { OR: or } : undefined;

    if (!where) throw new NotFoundException('Kode atau nama wajib diisi');

    const bom = await this.prisma.bom.findFirst({
      where,
      include: { lines: { orderBy: { name: 'asc' } } },
    });

    if (bom) return bom;

    const tokens = name && tokenize(name).length
      ? tokenize(name)
      : tokenize(code);

    if (!tokens.length) throw new NotFoundException('BOM tidak ditemukan');

    const allBoms = await this.prisma.bom.findMany({
      include: { lines: { orderBy: { name: 'asc' } } },
    });

    let best:
      | { score: number; extra: number; entry: (typeof allBoms)[number] }
      | null = null;

    for (const entry of allBoms) {
      const entryTokens = new Set([
        ...tokenize(entry.productCode),
        ...tokenize(entry.productName),
      ]);
      if (!entryTokens.size) continue;

      let match = 0;
      for (const token of tokens) {
        if (entryTokens.has(token)) match += 1;
      }
      if (match !== tokens.length) continue;

      const extra = entryTokens.size - match;
      const score = match * 10 - extra;
      if (!best || score > best.score) {
        best = { score, extra, entry };
      }
    }

    if (!best) throw new NotFoundException('BOM tidak ditemukan');
    return best.entry;
  }
}
