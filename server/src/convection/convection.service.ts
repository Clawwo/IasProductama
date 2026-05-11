import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateConvectionItemDto } from './dto/create-convection-item.dto.js';
import { CreateConvectionInboundDto } from './dto/create-convection-inbound.dto.js';
import { CreateConvectionOutboundDto } from './dto/create-convection-outbound.dto.js';
import { UpdateConvectionItemDto } from './dto/update-convection-item.dto.js';

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

function normalizeUnit(value?: string | null): string {
  const cleaned = (value ?? '').trim().toUpperCase();
  if (!cleaned) return 'KG';
  if (cleaned === 'PASANG') return 'SET';
  if (cleaned === 'M' || cleaned === 'METERS' || cleaned === 'MTR')
    return 'METER';
  if (cleaned === 'PC' || cleaned === 'PIECE' || cleaned === 'PIECES')
    return 'PCS';
  if (cleaned === 'OZ' || cleaned === 'ONZ') return 'ONS';
  return cleaned;
}

function shouldForcePcsUnit(
  category: string | null | undefined,
  subCategory: string | null | undefined,
  name: string | null | undefined,
): boolean {
  const cat = (category ?? '').trim().toLowerCase();
  const sub = (subCategory ?? '').trim().toLowerCase();
  const itemName = (name ?? '').trim().toLowerCase();

  if (cat === 'jarum' || cat === 'benang') return true;
  if (cat === 'resleting') return true;
  if (cat === 'karton' || sub === 'karton') return true;
  if (cat === 'pita satin' || cat === 'pita gold' || cat === 'pita silver')
    return true;
  if (itemName.includes('jamur silver')) return true;

  return false;
}

function titleCaseWords(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function normalizeCategoryAlias(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  const upper = raw.toUpperCase();
  if (!upper) return '';

  if (/^(B\.?\s*)?SEPATU$/i.test(upper)) return 'Sepatu';
  if (/^PTG\d*$/i.test(upper) || upper === 'PITA GOLD') return 'Pita Gold';
  if (/^PTS\d*$/i.test(upper) || upper === 'PITA SATIN') return 'Pita Satin';
  if (/^PTV\d*$/i.test(upper) || upper === 'PITA SILVER') return 'Pita Silver';
  if (upper === 'KARTON') return 'Karton';
  if (upper === 'JARUM') return 'Jarum';
  if (upper === 'BENANG') return 'Benang';
  if (upper === 'ELASTIS') return 'Elastis';
  if (upper === 'RESLETING') return 'Resleting';

  return titleCaseWords(raw);
}

function normalizeItemCode(value: string): string {
  const upper = (value ?? '').trim().toUpperCase();
  const firstChunk = upper.split(/\s*[-:]\s*/)[0] ?? '';
  return firstChunk.replace(/[^A-Z0-9]/g, '');
}

function normalizeItemName(
  value: string | null | undefined,
  code: string,
): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  let candidate = trimmed;
  if (code) {
    const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${escapedCode}\\s*[-:]?\\s*`, 'i');
    const cleaned = trimmed.replace(re, '').trim();
    if (cleaned) {
      candidate = cleaned;
    }
  }

  const genericPrefix = /^[A-Z0-9]{2,12}\s*[-:]\s*/i;
  const cleanedGeneric = candidate.replace(genericPrefix, '').trim();
  return cleanedGeneric || candidate;
}

function resolveConvectionCategory(
  code: string,
  name: string,
  existing?: string | null,
): string {
  const c = (code ?? '').toUpperCase();
  const n = (name ?? '').toUpperCase();
  const selectedCategory = normalizeCategoryAlias(existing);

  // Respect explicit category chosen by user (except generic aliases).
  if (
    selectedCategory &&
    selectedCategory !== 'Lainnya' &&
    selectedCategory !== 'Produk'
  ) {
    return selectedCategory;
  }

  if (n.includes('PITA GOLD')) return 'Pita Gold';
  if (n.includes('PITA SILVER')) return 'Pita Silver';
  if (n.includes('PITA SATIN')) return 'Pita Satin';
  if (
    n.includes('RESLETING') ||
    /^(YE|YK|JK)\d+/i.test(c) ||
    /^JPH\d+/i.test(c) ||
    /^JPP\d+/i.test(c)
  ) {
    return 'Resleting';
  }
  if (n.includes('JAMUR') || n.includes('ELASTIS')) return 'Elastis';
  if (/^SIZE\s*/i.test(c) || /^SIZE\s*/i.test(n)) return 'Sepatu';
  if (n.includes('JARUM') || c.startsWith('JR')) return 'Jarum';
  if (n.includes('BENANG') || c.startsWith('BB') || c.startsWith('BM'))
    return 'Benang';
  if (n.includes('VINYL') || c.startsWith('V')) return 'Vinyl';
  if (n.includes('PELES') || n.includes('BENDERA') || c.startsWith('PS'))
    return 'Kain Peles';
  if (n.includes('SATIN')) return 'Kain Satin';
  if (n.includes('50F') || c.startsWith('KK50F')) return 'Kain Keras 50F';
  if (n.includes('50N') || c.startsWith('KK50N')) return 'Kain Keras 50N';
  if (
    n.includes('DRILL') ||
    n.includes('DRIL') ||
    c.startsWith('DB') ||
    c.startsWith('DT') ||
    c.startsWith('DL') ||
    c.startsWith('OD')
  ) {
    return 'Kain Drill';
  }

  const fallback = selectedCategory;
  return fallback || 'Lainnya';
}

function computeQtyInBase(
  itemUnit: string | null | undefined,
  lineUnit: string | null | undefined,
  qty: number,
  metersPerKg?: number | null,
) {
  const base = normalizeUnit(itemUnit);
  const unit = normalizeUnit(lineUnit || base);

  if (unit === base) return qty;

  if (base === 'KG') {
    if (unit === 'ONS' || unit === 'OZ' || unit === 'ONZ') {
      return qty / 10;
    }
    if (
      unit === 'M' ||
      unit === 'METER' ||
      unit === 'METERS' ||
      unit === 'MT'
    ) {
      if (!metersPerKg || metersPerKg <= 0) {
        throw new BadRequestException(
          `Konversi meter ke KG tidak tersedia untuk item bersatuan ${itemUnit ?? 'KG'}`,
        );
      }
      return qty / metersPerKg;
    }
  }

  throw new BadRequestException(
    `Unit ${lineUnit ?? unit} tidak kompatibel dengan unit dasar ${itemUnit ?? 'KG'}`,
  );
}

@Injectable()
export class ConvectionService {
  constructor(private readonly prisma: PrismaService) {}

  listItems() {
    return this.prisma.convectionItem.findMany({ orderBy: { code: 'asc' } });
  }

  async createItem(dto: CreateConvectionItemDto) {
    const code = normalizeItemCode(dto.code);
    if (!code) {
      throw new BadRequestException('Kode barang konveksi tidak valid');
    }

    const name = normalizeItemName(dto.name, code);
    if (!name) {
      throw new BadRequestException('Nama barang konveksi tidak valid');
    }

    const category = resolveConvectionCategory(code, name, dto.category);
    const subCategory = (dto.subCategory ?? '').trim() || null;
    const unit = shouldForcePcsUnit(category, subCategory, name)
      ? 'PCS'
      : normalizeUnit(dto.unit);
    const metersPerKg = unit === 'PCS' ? null : dto.metersPerKg;

    const existing = await this.prisma.convectionItem.findUnique({
      where: { code },
      select: { code: true },
    });
    if (existing) {
      throw new BadRequestException(
        `Kode ${code} sudah ada. Silakan edit barang yang sudah ada.`,
      );
    }

    try {
      return await this.prisma.convectionItem.create({
        data: {
          code,
          name,
          category,
          subCategory,
          unit,
          metersPerKg,
          stockBase: dto.stockBase ?? 0,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Kode ${code} sudah ada. Silakan edit barang yang sudah ada.`,
        );
      }
      throw err;
    }
  }

  async updateItem(code: string, dto: UpdateConvectionItemDto) {
    const exists = await this.prisma.convectionItem.findUnique({
      where: { code },
    });
    if (!exists) throw new NotFoundException('Convection item not found');

    const normalizedName =
      dto.name !== undefined
        ? normalizeItemName(dto.name, code)
        : (exists.name ?? '').trim();
    if (!normalizedName) {
      throw new BadRequestException('Nama barang konveksi tidak valid');
    }

    const normalizedCategory = resolveConvectionCategory(
      code,
      normalizedName,
      dto.category ?? exists.category,
    );
    const normalizedSubCategory =
      dto.subCategory !== undefined
        ? (dto.subCategory ?? '').trim() || null
        : exists.subCategory;
    const normalizedUnit = shouldForcePcsUnit(
      normalizedCategory,
      normalizedSubCategory,
      normalizedName,
    )
      ? 'PCS'
      : dto.unit
        ? normalizeUnit(dto.unit)
        : (exists.unit ?? 'KG');
    const normalizedMetersPerKg =
      normalizedUnit === 'PCS' ? null : (dto.metersPerKg ?? undefined);

    return this.prisma.convectionItem.update({
      where: { code },
      data: {
        name: normalizedName,
        category: normalizedCategory,
        subCategory: normalizedSubCategory,
        unit: normalizedUnit,
        metersPerKg: normalizedMetersPerKg,
        stockBase: dto.stockBase ?? undefined,
      },
    });
  }

  async removeItem(code: string) {
    const exists = await this.prisma.convectionItem.findUnique({
      where: { code },
    });
    if (!exists) throw new NotFoundException('Convection item not found');

    const [inboundUsage, outboundUsage] = await Promise.all([
      this.prisma.convectionInboundLine.count({ where: { code } }),
      this.prisma.convectionOutboundLine.count({ where: { code } }),
    ]);
    if (inboundUsage > 0 || outboundUsage > 0) {
      throw new BadRequestException(
        `Barang ${code} tidak bisa dihapus karena sudah dipakai di transaksi.`,
      );
    }

    await this.prisma.convectionItem.delete({ where: { code } });
    return { success: true };
  }

  async findRecentInbound(limit = 20) {
    const take =
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    return this.prisma.convectionInbound.findMany({
      take,
      orderBy: { date: 'desc' },
      include: {
        lines: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findRecentOutbound(limit = 20) {
    const take =
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    return this.prisma.convectionOutbound.findMany({
      take,
      orderBy: { date: 'desc' },
      include: {
        lines: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async createInbound(dto: CreateConvectionInboundDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const date = new Date(dto.date);
      const dayStart = startOfDay(date);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const sameDayCount = await tx.convectionInbound.count({
        where: { date: { gte: dayStart, lt: dayEnd } },
      });
      const code = formatTxnCode('CONV-IN', dayStart, sameDayCount + 1);

      const codes = dto.lines.map((l) => l.code);
      const items = await tx.convectionItem.findMany({
        where: { code: { in: codes } },
      });
      const itemMap = new Map(items.map((it) => [it.code, it]));

      const linesWithQty = dto.lines.map((line) => {
        const item = itemMap.get(line.code);
        if (!item) {
          throw new NotFoundException(
            `Kode ${line.code} tidak ditemukan di konveksi`,
          );
        }
        const qtyInBase = computeQtyInBase(
          item.unit,
          line.unit,
          line.qty,
          item.metersPerKg,
        );
        return { line, item, qtyInBase } as const;
      });

      const inboundId = randomUUID();
      await tx.convectionInbound.create({
        data: {
          id: inboundId,
          code,
          vendor: dto.vendor,
          date,
          note: dto.note,
          createdById: userId ?? undefined,
        },
      });

      if (linesWithQty.length > 0) {
        await tx.convectionInboundLine.createMany({
          data: linesWithQty.map(({ line, qtyInBase }) => ({
            inboundId,
            code: line.code,
            name: line.name,
            category: line.category,
            subCategory: line.subCategory,
            unit: line.unit?.trim() || itemMap.get(line.code)?.unit || 'KG',
            qty: line.qty,
            qtyInBase,
            note: line.note,
          })),
        });
      }

      for (const { line, item, qtyInBase } of linesWithQty) {
        await tx.convectionItem.update({
          where: { code: line.code },
          data: {
            stockBase: { increment: qtyInBase },
            name: line.name ?? undefined,
            category: line.category ?? undefined,
            subCategory: line.subCategory ?? undefined,
            unit: line.unit?.trim() || item.unit || undefined,
          },
        });
      }

      const inbound = await tx.convectionInbound.findUnique({
        where: { id: inboundId },
        include: { lines: true },
      });

      if (!inbound) {
        throw new NotFoundException('Convection inbound not found');
      }

      return inbound;
    });
  }

  async createOutbound(dto: CreateConvectionOutboundDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const date = new Date(dto.date);
      const dayStart = startOfDay(date);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const sameDayCount = await tx.convectionOutbound.count({
        where: { date: { gte: dayStart, lt: dayEnd } },
      });
      const code = formatTxnCode('CONV-OUT', dayStart, sameDayCount + 1);

      const codes = dto.lines.map((l) => l.code);
      const items = await tx.convectionItem.findMany({
        where: { code: { in: codes } },
      });
      const itemMap = new Map(items.map((it) => [it.code, it]));

      const linesWithQty = dto.lines.map((line) => {
        const item = itemMap.get(line.code);
        if (!item) {
          throw new NotFoundException(
            `Kode ${line.code} tidak ditemukan di konveksi`,
          );
        }
        const qtyInBase = computeQtyInBase(
          item.unit,
          line.unit,
          line.qty,
          item.metersPerKg,
        );
        if ((item.stockBase ?? 0) < qtyInBase) {
          throw new BadRequestException(
            `Stok ${line.code} tidak cukup. Sisa: ${item.stockBase ?? 0}`,
          );
        }
        return { line, item, qtyInBase } as const;
      });

      const outboundId = randomUUID();
      await tx.convectionOutbound.create({
        data: {
          id: outboundId,
          code,
          receiver: dto.receiver,
          date,
          note: dto.note,
          createdById: userId ?? undefined,
        },
      });

      if (linesWithQty.length > 0) {
        await tx.convectionOutboundLine.createMany({
          data: linesWithQty.map(({ line, qtyInBase }) => ({
            outboundId,
            code: line.code,
            name: line.name,
            category: line.category,
            subCategory: line.subCategory,
            unit: line.unit?.trim() || itemMap.get(line.code)?.unit || 'KG',
            qty: line.qty,
            qtyInBase,
            note: line.note,
          })),
        });
      }

      for (const { line, item, qtyInBase } of linesWithQty) {
        await tx.convectionItem.update({
          where: { code: line.code },
          data: {
            stockBase: { decrement: qtyInBase },
            name: line.name ?? undefined,
            category: line.category ?? undefined,
            subCategory: line.subCategory ?? undefined,
            unit: line.unit?.trim() || item.unit || undefined,
          },
        });
      }

      const outbound = await tx.convectionOutbound.findUnique({
        where: { id: outboundId },
        include: { lines: true },
      });

      if (!outbound) {
        throw new NotFoundException('Convection outbound not found');
      }

      return outbound;
    });
  }
}
