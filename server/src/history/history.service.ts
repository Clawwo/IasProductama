import { Injectable } from '@nestjs/common';
import { Prisma, RawMaterialOutboundStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export type HistoryDirection = 'Masuk' | 'Keluar';
export type HistoryKind = 'Barang' | 'Bahan';
export type HistoryCategory = 'Barang' | 'Konveksi' | 'Bahan baku' | 'Produksi';

type HistoryQuery = {
  page?: number;
  perPage?: number;
  type?: HistoryDirection | 'all';
  category?: HistoryCategory | 'all';
  search?: string;
  fromDate?: string;
  toDate?: string;
};

type HistoryDetailLine = {
  code: string;
  name?: string;
  qty: number;
  note?: string;
  batchCode?: string;
  direction: HistoryDirection;
  kind: HistoryKind;
  category: HistoryCategory;
};

type HistoryDetail = {
  txCode: string;
  direction: HistoryDirection;
  kind: HistoryKind;
  category: HistoryCategory;
  actor?: string;
  dateRaw: string;
  note?: string;
  lines: HistoryDetailLine[];
};

export type HistoryMovement = {
  id: string;
  direction: HistoryDirection;
  kind: HistoryKind;
  category: HistoryCategory;
  txCode: string;
  recordId: string;
  itemCode: string;
  name: string;
  qty: number;
  actor?: string;
  rawTime: string;
  timestamp: number;
  note?: string;
  batchCode?: string;
  detail: HistoryDetail;
};

type HistoryStats = {
  total: number;
  inboundCount: number;
  outboundCount: number;
  outboundGoodsCount: number;
  outboundRawCount: number;
  inboundQty: number;
  outboundQty: number;
  outboundRawQty: number;
};

function resolveActor(
  user?: { name?: string | null; email?: string | null } | null,
) {
  const name = user?.name?.trim();
  const email = user?.email?.trim();
  return name || email || undefined;
}

function parseDateRange(
  fromDate?: string,
  toDate?: string,
): Prisma.DateTimeFilter | undefined {
  const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
  const to = toDate ? new Date(`${toDate}T23:59:59`) : null;

  const hasFrom = !!from && !Number.isNaN(from.getTime());
  const hasTo = !!to && !Number.isNaN(to.getTime());

  if (!hasFrom && !hasTo) return undefined;

  return {
    ...(hasFrom ? { gte: from } : {}),
    ...(hasTo ? { lte: to } : {}),
  };
}

function sanitizePage(value?: number) {
  return Number.isFinite(value) && (value ?? 0) > 0
    ? Math.floor(value as number)
    : 1;
}

function sanitizePerPage(value?: number) {
  const raw =
    Number.isFinite(value) && (value ?? 0) > 0
      ? Math.floor(value as number)
      : 20;
  return Math.min(raw, 200);
}

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findPaged(query: HistoryQuery) {
    const page = sanitizePage(query.page);
    const perPage = sanitizePerPage(query.perPage);
    const dateFilter = parseDateRange(query.fromDate, query.toDate);

    const [items, raws, products] = await Promise.all([
      this.prisma.item.findMany({ select: { code: true, name: true } }),
      this.prisma.bahanBaku.findMany({ select: { code: true, name: true } }),
      this.prisma.product.findMany({ select: { code: true, name: true } }),
    ]);

    const nameMap = new Map<string, string>();
    for (const row of [...items, ...raws, ...products]) {
      if (row.name) nameMap.set(row.code, row.name);
    }

    const [
      inbound,
      outbound,
      convectionInbound,
      convectionOutbound,
      rawOutbound,
      production,
    ] = await Promise.all([
      this.prisma.inbound.findMany({
        where: dateFilter ? { date: dateFilter } : undefined,
        include: {
          lines: true,
          createdBy: { select: { name: true, email: true } },
        },
      }),
      this.prisma.outbound.findMany({
        where: dateFilter ? { date: dateFilter } : undefined,
        include: {
          lines: true,
          createdBy: { select: { name: true, email: true } },
        },
      }),
      this.prisma.convectionInbound.findMany({
        where: dateFilter ? { date: dateFilter } : undefined,
        include: {
          lines: true,
          createdBy: { select: { name: true, email: true } },
        },
      }),
      this.prisma.convectionOutbound.findMany({
        where: dateFilter ? { date: dateFilter } : undefined,
        include: {
          lines: true,
          createdBy: { select: { name: true, email: true } },
        },
      }),
      this.prisma.rawMaterialOutbound.findMany({
        where: {
          ...(dateFilter ? { date: dateFilter } : {}),
          status: RawMaterialOutboundStatus.RECEIVED,
        },
        include: {
          lines: true,
          createdBy: { select: { name: true, email: true } },
        },
      }),
      this.prisma.production.findMany({
        where: dateFilter ? { date: dateFilter } : undefined,
        include: {
          rawLines: true,
          finishedLines: true,
          createdBy: { select: { name: true, email: true } },
        },
      }),
    ]);

    const movements: HistoryMovement[] = [];

    for (const rec of inbound) {
      const txCode = rec.code;
      const sourceDate = rec.createdAt ?? rec.date;
      const rawTime = sourceDate.toISOString();
      const detailLines: HistoryDetailLine[] = rec.lines.map((line) => ({
        code: line.code,
        name: nameMap.get(line.code) ?? line.code,
        qty: line.qty,
        note: line.note ?? rec.note ?? undefined,
        direction: 'Masuk',
        kind: 'Barang',
        category: 'Barang',
      }));

      for (let idx = 0; idx < rec.lines.length; idx += 1) {
        const line = rec.lines[idx];
        const detail: HistoryDetail = {
          txCode,
          direction: 'Masuk',
          kind: 'Barang',
          category: 'Barang',
          actor: rec.vendor,
          dateRaw: rawTime,
          note: rec.note ?? undefined,
          lines: detailLines,
        };

        movements.push({
          id: `IN-${rec.id}-${idx}-${line.code}`,
          direction: 'Masuk',
          kind: 'Barang',
          category: 'Barang',
          txCode,
          recordId: rec.id,
          itemCode: line.code,
          name: nameMap.get(line.code) ?? line.code,
          qty: line.qty,
          actor: resolveActor(rec.createdBy),
          rawTime,
          timestamp: Date.parse(rawTime) || 0,
          note: line.note ?? rec.note ?? undefined,
          detail,
        });
      }
    }

    for (const rec of outbound) {
      const txCode = rec.code;
      const sourceDate = rec.createdAt ?? rec.date;
      const rawTime = sourceDate.toISOString();
      const detailLines: HistoryDetailLine[] = rec.lines.map((line) => ({
        code: line.code,
        name: nameMap.get(line.code) ?? line.code,
        qty: line.qty,
        note: line.note ?? rec.note ?? undefined,
        direction: 'Keluar',
        kind: 'Barang',
        category: 'Barang',
      }));

      for (let idx = 0; idx < rec.lines.length; idx += 1) {
        const line = rec.lines[idx];
        const detail: HistoryDetail = {
          txCode,
          direction: 'Keluar',
          kind: 'Barang',
          category: 'Barang',
          actor: rec.orderer,
          dateRaw: rawTime,
          note: rec.note ?? undefined,
          lines: detailLines,
        };

        movements.push({
          id: `OUT-${rec.id}-${idx}-${line.code}`,
          direction: 'Keluar',
          kind: 'Barang',
          category: 'Barang',
          txCode,
          recordId: rec.id,
          itemCode: line.code,
          name: nameMap.get(line.code) ?? line.code,
          qty: line.qty,
          actor: resolveActor(rec.createdBy),
          rawTime,
          timestamp: Date.parse(rawTime) || 0,
          note: line.note ?? rec.note ?? undefined,
          detail,
        });
      }
    }

    for (const rec of convectionInbound) {
      const txCode = rec.code;
      const sourceDate = rec.createdAt ?? rec.date;
      const rawTime = sourceDate.toISOString();
      const detailLines: HistoryDetailLine[] = rec.lines.map((line) => ({
        code: line.code,
        name: line.name ?? nameMap.get(line.code) ?? line.code,
        qty: Number(line.qty),
        note: line.note ?? rec.note ?? undefined,
        direction: 'Masuk',
        kind: 'Barang',
        category: 'Konveksi',
      }));

      for (let idx = 0; idx < rec.lines.length; idx += 1) {
        const line = rec.lines[idx];
        const detail: HistoryDetail = {
          txCode,
          direction: 'Masuk',
          kind: 'Barang',
          category: 'Konveksi',
          actor: rec.vendor,
          dateRaw: rawTime,
          note: rec.note ?? undefined,
          lines: detailLines,
        };

        movements.push({
          id: `CONV-IN-${rec.id}-${idx}-${line.code}`,
          direction: 'Masuk',
          kind: 'Barang',
          category: 'Konveksi',
          txCode,
          recordId: rec.id,
          itemCode: line.code,
          name: line.name ?? nameMap.get(line.code) ?? line.code,
          qty: Number(line.qty),
          actor: resolveActor(rec.createdBy),
          rawTime,
          timestamp: Date.parse(rawTime) || 0,
          note: line.note ?? rec.note ?? undefined,
          detail,
        });
      }
    }

    for (const rec of convectionOutbound) {
      const txCode = rec.code;
      const sourceDate = rec.createdAt ?? rec.date;
      const rawTime = sourceDate.toISOString();
      const detailLines: HistoryDetailLine[] = rec.lines.map((line) => ({
        code: line.code,
        name: line.name ?? nameMap.get(line.code) ?? line.code,
        qty: Number(line.qty),
        note: line.note ?? rec.note ?? undefined,
        direction: 'Keluar',
        kind: 'Barang',
        category: 'Konveksi',
      }));

      for (let idx = 0; idx < rec.lines.length; idx += 1) {
        const line = rec.lines[idx];
        const detail: HistoryDetail = {
          txCode,
          direction: 'Keluar',
          kind: 'Barang',
          category: 'Konveksi',
          actor: rec.receiver,
          dateRaw: rawTime,
          note: rec.note ?? undefined,
          lines: detailLines,
        };

        movements.push({
          id: `CONV-OUT-${rec.id}-${idx}-${line.code}`,
          direction: 'Keluar',
          kind: 'Barang',
          category: 'Konveksi',
          txCode,
          recordId: rec.id,
          itemCode: line.code,
          name: line.name ?? nameMap.get(line.code) ?? line.code,
          qty: Number(line.qty),
          actor: resolveActor(rec.createdBy),
          rawTime,
          timestamp: Date.parse(rawTime) || 0,
          note: line.note ?? rec.note ?? undefined,
          detail,
        });
      }
    }

    for (const rec of rawOutbound) {
      const txCode = rec.code;
      const sourceDate = rec.createdAt ?? rec.date;
      const rawTime = sourceDate.toISOString();
      const validLines = rec.lines.filter(
        (line) => line.status === RawMaterialOutboundStatus.RECEIVED,
      );
      const detailLines: HistoryDetailLine[] = validLines.map((line) => ({
        code: line.materialCode,
        name:
          line.materialName ??
          nameMap.get(line.materialCode) ??
          line.materialCode,
        qty: line.qty,
        note: line.note ?? rec.note ?? undefined,
        batchCode: line.batchCode,
        direction: 'Keluar',
        kind: 'Bahan',
        category: 'Bahan baku',
      }));

      for (let idx = 0; idx < validLines.length; idx += 1) {
        const line = validLines[idx];
        const detail: HistoryDetail = {
          txCode,
          direction: 'Keluar',
          kind: 'Bahan',
          category: 'Bahan baku',
          actor: rec.artisan,
          dateRaw: rawTime,
          note: rec.note ?? undefined,
          lines: detailLines,
        };

        movements.push({
          id: `RAW-${rec.id}-${idx}-${line.materialCode}`,
          direction: 'Keluar',
          kind: 'Bahan',
          category: 'Bahan baku',
          txCode,
          recordId: rec.id,
          itemCode: line.materialCode,
          name:
            line.materialName ??
            nameMap.get(line.materialCode) ??
            line.materialCode,
          qty: line.qty,
          actor: resolveActor(rec.createdBy),
          rawTime,
          timestamp: Date.parse(rawTime) || 0,
          note: line.note ?? rec.note ?? undefined,
          batchCode: line.batchCode,
          detail,
        });
      }
    }

    for (const rec of production) {
      const txCode = rec.code;
      const sourceDate = rec.createdAt ?? rec.date;
      const rawTime = sourceDate.toISOString();

      const detailLines: HistoryDetailLine[] = [
        ...rec.finishedLines.map((line) => ({
          code: line.code,
          name: line.name ?? nameMap.get(line.code) ?? line.code,
          qty: line.qty,
          note: line.note ?? rec.note ?? undefined,
          direction: 'Masuk' as const,
          kind: 'Barang' as const,
          category: 'Produksi' as const,
        })),
        ...rec.rawLines.map((line) => ({
          code: line.code,
          name: line.name ?? nameMap.get(line.code) ?? line.code,
          qty: line.qty,
          note: line.note ?? rec.note ?? undefined,
          direction: 'Keluar' as const,
          kind: 'Bahan' as const,
          category: 'Produksi' as const,
        })),
      ];

      rec.finishedLines.forEach((line, idx) => {
        const detail: HistoryDetail = {
          txCode,
          direction: 'Masuk',
          kind: 'Barang',
          category: 'Produksi',
          actor: undefined,
          dateRaw: rawTime,
          note: rec.note ?? undefined,
          lines: detailLines,
        };

        movements.push({
          id: `PROD-IN-${rec.id}-${idx}-${line.code}`,
          direction: 'Masuk',
          kind: 'Barang',
          category: 'Produksi',
          txCode,
          recordId: rec.id,
          itemCode: line.code,
          name: line.name ?? nameMap.get(line.code) ?? line.code,
          qty: line.qty,
          actor: undefined,
          rawTime,
          timestamp: Date.parse(rawTime) || 0,
          note: line.note ?? rec.note ?? undefined,
          detail,
        });
      });

      rec.rawLines.forEach((line, idx) => {
        const detail: HistoryDetail = {
          txCode,
          direction: 'Keluar',
          kind: 'Bahan',
          category: 'Produksi',
          actor: undefined,
          dateRaw: rawTime,
          note: rec.note ?? undefined,
          lines: detailLines,
        };

        movements.push({
          id: `PROD-OUT-${rec.id}-${idx}-${line.code}`,
          direction: 'Keluar',
          kind: 'Bahan',
          category: 'Produksi',
          txCode,
          recordId: rec.id,
          itemCode: line.code,
          name: line.name ?? nameMap.get(line.code) ?? line.code,
          qty: line.qty,
          actor: undefined,
          rawTime,
          timestamp: Date.parse(rawTime) || 0,
          note: line.note ?? rec.note ?? undefined,
          detail,
        });
      });
    }

    let filtered = movements;

    if (query.type && query.type !== 'all') {
      filtered = filtered.filter((row) => row.direction === query.type);
    }

    if (query.category && query.category !== 'all') {
      filtered = filtered.filter((row) => row.category === query.category);
    }

    const term = (query.search ?? '').trim().toLowerCase();
    if (term) {
      filtered = filtered.filter((row) => {
        const haystack = `${row.txCode} ${row.itemCode} ${row.name} ${
          row.actor ?? ''
        } ${row.detail.actor ?? ''} ${row.note ?? ''} ${row.batchCode ?? ''}`.toLowerCase();
        return haystack.includes(term);
      });
    }

    filtered = filtered.sort((a, b) => b.timestamp - a.timestamp);

    const total = filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / perPage));
    const currentPage = Math.min(page, pageCount);
    const start = (currentPage - 1) * perPage;
    const data = filtered.slice(start, start + perPage);

    const inboundRows = filtered.filter((row) => row.direction === 'Masuk');
    const outboundRows = filtered.filter((row) => row.direction === 'Keluar');
    const outboundGoods = outboundRows.filter((row) => row.kind === 'Barang');
    const outboundRaw = outboundRows.filter((row) => row.kind === 'Bahan');

    const stats: HistoryStats = {
      total,
      inboundCount: inboundRows.length,
      outboundCount: outboundRows.length,
      outboundGoodsCount: outboundGoods.length,
      outboundRawCount: outboundRaw.length,
      inboundQty: inboundRows.reduce((sum, row) => sum + row.qty, 0),
      outboundQty: outboundRows.reduce((sum, row) => sum + row.qty, 0),
      outboundRawQty: outboundRaw.reduce((sum, row) => sum + row.qty, 0),
    };

    return {
      data,
      total,
      page: currentPage,
      perPage,
      pageCount,
      stats,
    };
  }
}
