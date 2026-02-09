import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination as Pager,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Eye,
  RefreshCw,
  Search,
  Package2,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// Keep API construction consistent with other pages
type Env = { VITE_API_BASE?: string };
const API_BASE = ((import.meta as { env?: Env }).env?.VITE_API_BASE ?? "")
  .trim()
  .replace(/\/$/, "");
const INBOUND_URL = `${API_BASE}/api/inbound`;
const OUTBOUND_URL = `${API_BASE}/api/outbound`;
const RAW_OUTBOUND_URL = `${API_BASE}/api/raw-materials/outbound`;
const PRODUCTION_URL = `${API_BASE}/api/production`;
const DRAFTS_URL = `${API_BASE}/api/drafts`;
const ITEMS_URL = `${API_BASE}/api/items`;
const RAW_ITEMS_URL = `${API_BASE}/api/raw-materials`;

type UserRef = { id: string; name?: string | null; email?: string | null };
type LineApi = { code: string; qty: number; note?: string; name?: string };
type InboundApi = {
  id: string;
  code?: string;
  vendor?: string;
  date: string;
  note?: string;
  lines: LineApi[];
  createdAt?: string;
  createdBy?: UserRef | null;
};
type OutboundApi = {
  id: string;
  code?: string;
  orderer?: string;
  date: string;
  note?: string;
  lines: LineApi[];
  createdAt?: string;
  createdBy?: UserRef | null;
};

type RawOutboundLineApi = {
  materialCode?: string;
  materialName?: string;
  batchCode?: string;
  qty: number;
  note?: string;
  status?: "OUT" | "RECEIVED";
};

type RawOutboundApi = {
  id: string;
  code: string;
  artisan: string;
  date: string;
  note?: string | null;
  status: "OUT" | "RECEIVED";
  lines: RawOutboundLineApi[];
  createdAt?: string;
  createdBy?: UserRef | null;
};

type ProductionLineApi = {
  code: string;
  qty: number;
  note?: string;
  name?: string;
};

type ProductionApi = {
  id: string;
  code: string;
  date: string;
  note?: string;
  createdAt?: string;
  rawLines: ProductionLineApi[];
  finishedLines: ProductionLineApi[];
  createdBy?: UserRef | null;
};

type DraftApi = {
  id: string;
  type: "INBOUND" | "OUTBOUND" | "PRODUCTION";
  createdAt?: string;
  updatedAt?: string;
  createdBy?: UserRef | null;
  updatedBy?: UserRef | null;
};

type Movement = {
  id: string;
  direction: "Masuk" | "Keluar";
  kind: "Barang" | "Bahan";
  category: "Barang" | "Bahan baku" | "Produksi";
  txCode: string;
  recordId: string;
  itemCode: string;
  name: string;
  qty: number;
  actor?: string;
  time: string;
  rawTime: string;
  timestamp: number;
  note?: string;
  batchCode?: string;
};

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const resolveActor = (user?: UserRef | null) => {
  const name = user?.name?.trim();
  const email = user?.email?.trim();
  return name || email || undefined;
};

export function RiwayatPage() {
  const [items, setItems] = useState<Array<{ code: string; name?: string }>>(
    [],
  );
  const [rawItems, setRawItems] = useState<
    Array<{ code: string; name?: string }>
  >([]);
  const [inbound, setInbound] = useState<InboundApi[]>([]);
  const [outbound, setOutbound] = useState<OutboundApi[]>([]);
  const [rawOutbound, setRawOutbound] = useState<RawOutboundApi[]>([]);
  const [production, setProduction] = useState<ProductionApi[]>([]);
  const [drafts, setDrafts] = useState<DraftApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "Masuk" | "Keluar">(
    "all",
  );
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | "Barang" | "Bahan baku" | "Produksi"
  >("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<{
    txCode: string;
    direction: Movement["direction"];
    kind: Movement["kind"];
    actor?: string;
    date: string;
    note?: string;
    lines: Array<{
      code: string;
      name?: string;
      qty: number;
      note?: string;
      batchCode?: string;
    }>;
  } | null>(null);
  const perPage = 20;

  useEffect(() => {
    let cancelled = false;
    const loadItems = async () => {
      try {
        const [resItems, resRaw] = await Promise.all([
          fetch(ITEMS_URL),
          fetch(RAW_ITEMS_URL),
        ]);
        if (!resItems.ok) throw new Error(await resItems.text());
        if (!resRaw.ok) throw new Error(await resRaw.text());
        const data = (await resItems.json()) as Array<{
          code: string;
          name?: string;
        }>;
        const rawData = (await resRaw.json()) as Array<{
          code: string;
          name?: string;
        }>;
        if (!cancelled) {
          setItems(data);
          setRawItems(rawData);
        }
      } catch (err) {
        // leave items empty if it fails; riwayat will fallback to code
        console.warn("Gagal memuat data barang untuk riwayat", err);
      }
    };
    loadItems();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inRes, outRes, rawOutRes, prodRes, draftRes] = await Promise.all([
        fetch(`${INBOUND_URL}?limit=200`),
        fetch(`${OUTBOUND_URL}?limit=200`),
        fetch(`${RAW_OUTBOUND_URL}?limit=200`),
        fetch(`${PRODUCTION_URL}?limit=200`),
        fetch(`${DRAFTS_URL}?limit=200`),
      ]);
      if (!inRes.ok) throw new Error(await inRes.text());
      if (!outRes.ok) throw new Error(await outRes.text());
      if (!rawOutRes.ok) throw new Error(await rawOutRes.text());
      if (!prodRes.ok) throw new Error(await prodRes.text());
      if (!draftRes.ok) throw new Error(await draftRes.text());
      const inboundData = (await inRes.json()) as InboundApi[];
      const outboundData = (await outRes.json()) as OutboundApi[];
      const rawOutboundData = (await rawOutRes.json()) as RawOutboundApi[];
      const productionData = (await prodRes.json()) as ProductionApi[];
      const draftData = (await draftRes.json()) as DraftApi[];
      setInbound(inboundData);
      setOutbound(outboundData);
      setRawOutbound(rawOutboundData);
      setProduction(productionData);
      setDrafts(draftData);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Gagal memuat riwayat.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const movements: Movement[] = useMemo(() => {
    const nameMap = new Map(
      [...items, ...rawItems].map((it) => [it.code, it.name]),
    );
    const mapLines = (
      rows: Array<InboundApi | OutboundApi>,
      direction: Movement["direction"],
    ): Movement[] =>
      rows.flatMap((rec) => {
        const sourceDate = rec.createdAt ?? rec.date ?? "";
        return rec.lines.map((line, idx) => ({
          id: `${direction}-${rec.id}-${idx}-${line.code}`,
          direction,
          kind: "Barang" as const,
          category: "Barang" as const,
          txCode: rec.code ?? "-",
          recordId: rec.id,
          itemCode: line.code,
          name: line.name ?? nameMap.get(line.code) ?? line.code,
          qty: line.qty,
          actor: resolveActor(rec.createdBy),
          time: formatDateTime(sourceDate),
          rawTime: sourceDate,
          timestamp: Date.parse(sourceDate) || 0,
          note: line.note ?? rec.note,
        }));
      });

    const rawLines = rawOutbound
      .filter((rec) => rec.status === "RECEIVED")
      .flatMap((rec) => {
        const sourceDate = rec.createdAt ?? rec.date ?? "";
        return rec.lines
          .filter((line) => line.status === "RECEIVED" || !line.status)
          .map((line, idx) => {
            const code = line.materialCode ?? "";
            const name = line.materialName ?? nameMap.get(code) ?? code;
            return {
              id: `Bahan-${rec.id}-${idx}-${code}`,
              direction: "Keluar" as const,
              kind: "Bahan" as const,
              category: "Bahan baku" as const,
              txCode: rec.code ?? "-",
              recordId: rec.id,
              itemCode: code,
              name,
              qty: line.qty,
              actor: resolveActor(rec.createdBy),
              time: formatDateTime(sourceDate),
              rawTime: sourceDate,
              timestamp: Date.parse(sourceDate) || 0,
              note: line.note ?? rec.note ?? undefined,
              batchCode: line.batchCode,
            };
          });
      });

    const productionLines = production.flatMap((rec) => {
      const sourceDate = rec.createdAt ?? rec.date ?? "";
      const actor = resolveActor(rec.createdBy);

      const raw = rec.rawLines.map((line, idx) => ({
        id: `Produksi-raw-${rec.id}-${idx}-${line.code}`,
        direction: "Keluar" as const,
        kind: "Bahan" as const,
        category: "Produksi" as const,
        txCode: rec.code ?? "-",
        recordId: rec.id,
        itemCode: line.code,
        name: line.name ?? nameMap.get(line.code) ?? line.code,
        qty: line.qty,
        actor,
        time: formatDateTime(sourceDate),
        rawTime: sourceDate,
        timestamp: Date.parse(sourceDate) || 0,
        note: line.note ?? rec.note ?? undefined,
      }));

      const finished = rec.finishedLines.map((line, idx) => ({
        id: `Produksi-finished-${rec.id}-${idx}-${line.code}`,
        direction: "Masuk" as const,
        kind: "Barang" as const,
        category: "Produksi" as const,
        txCode: rec.code ?? "-",
        recordId: rec.id,
        itemCode: line.code,
        name: line.name ?? nameMap.get(line.code) ?? line.code,
        qty: line.qty,
        actor,
        time: formatDateTime(sourceDate),
        rawTime: sourceDate,
        timestamp: Date.parse(sourceDate) || 0,
        note: line.note ?? rec.note ?? undefined,
      }));

      return [...raw, ...finished];
    });

    const combined = [
      ...mapLines(inbound, "Masuk"),
      ...mapLines(outbound, "Keluar"),
      ...rawLines,
      ...productionLines,
    ];

    return combined.sort((a, b) => b.timestamp - a.timestamp);
  }, [inbound, outbound, rawOutbound, production, items, rawItems]);

  const stats = useMemo(() => {
    const total = movements.length;
    const inboundRows = movements.filter((m) => m.direction === "Masuk");
    const outboundRows = movements.filter((m) => m.direction === "Keluar");
    const outboundGoods = outboundRows.filter((m) => m.kind === "Barang");
    const outboundRaw = outboundRows.filter((m) => m.kind === "Bahan");
    const inboundQty = inboundRows.reduce((sum, row) => sum + row.qty, 0);
    const outboundQty = outboundRows.reduce((sum, row) => sum + row.qty, 0);
    const outboundRawQty = outboundRaw.reduce((sum, row) => sum + row.qty, 0);
    return {
      total,
      inboundCount: inboundRows.length,
      outboundCount: outboundRows.length,
      outboundGoodsCount: outboundGoods.length,
      outboundRawCount: outboundRaw.length,
      inboundQty,
      outboundQty,
      outboundRawQty,
    };
  }, [movements]);

  const draftActivities = useMemo(() => {
    return drafts
      .map((draft) => {
        const rawTime = draft.updatedAt ?? draft.createdAt ?? "";
        return {
          id: draft.id,
          time: formatDateTime(rawTime),
          rawTime,
          timestamp: Date.parse(rawTime) || 0,
          actor: resolveActor(draft.updatedBy ?? draft.createdBy),
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [drafts]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fromTs = fromDate ? Date.parse(`${fromDate}T00:00:00`) : null;
    const toTs = toDate ? Date.parse(`${toDate}T23:59:59`) : null;

    return movements.filter((row) => {
      if (typeFilter !== "all" && row.direction !== typeFilter) return false;
      if (categoryFilter !== "all" && row.category !== categoryFilter)
        return false;
      if (fromTs && row.timestamp < fromTs) return false;
      if (toTs && row.timestamp > toTs) return false;
      if (!term) return true;
      const haystack = `${row.txCode} ${row.itemCode} ${row.name} ${
        row.actor ?? ""
      } ${row.note ?? ""} ${row.batchCode ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [movements, typeFilter, categoryFilter, search, fromDate, toDate]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, categoryFilter, search, fromDate, toDate]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * perPage;
  const pageRows = filtered.slice(start, start + perPage);

  const toDateOnly = (value: string, fallback?: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return fallback ?? "";
    return d.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" });
  };

  const buildHistoryRows = (rows: Movement[]) => {
    const header = [
      "Kode Transaksi",
      "Tanggal",
      "Kode Barang",
      "Nama Barang",
      "Jumlah",
      "Satuan",
      "Akun",
      "Tipe",
      "Batch",
      "Keterangan",
    ];
    const data = rows.map((row) => [
      row.txCode,
      toDateOnly(row.rawTime, row.time),
      row.itemCode,
      row.name,
      Math.abs(row.qty),
      "pcs",
      row.actor ?? "",
      row.kind,
      row.batchCode ?? "",
      row.note ?? "",
    ]);
    return [header, ...data];
    const csv = [header, ...csvRows]
      .map((cols) =>
        cols
          .map((col) => {
            const value = String(col ?? "");
            return value.includes(",") || value.includes("\n")
              ? `"${value.replace(/"/g, '""')}"`
              : value;
          })
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openDetail = (row: Movement) => {
    if (row.category === "Produksi") {
      const match =
        production.find((rec) => rec.code === row.txCode) ??
        production.find((rec) => rec.id === row.recordId);

      const rawLines = (match?.rawLines ?? []).map((line) => ({
        code: line.code,
        name: line.name ? `Bahan: ${line.name}` : `Bahan: ${line.code}`,
        qty: Math.abs(line.qty),
        note: line.note ?? match?.note,
      }));

      const finishedLines = (match?.finishedLines ?? []).map((line) => ({
        code: line.code,
        name: line.name
          ? `Barang jadi: ${line.name}`
          : `Barang jadi: ${line.code}`,
        qty: Math.abs(line.qty),
        note: line.note ?? match?.note,
      }));

      const lines =
        rawLines.length + finishedLines.length > 0
          ? [...rawLines, ...finishedLines]
          : [
              {
                code: row.itemCode,
                name: row.name,
                qty: Math.abs(row.qty),
                note: row.note,
              },
            ];

      setDetailData({
        txCode: match?.code ?? row.txCode,
        direction: row.direction,
        kind: row.kind,
        actor: resolveActor(match?.createdBy) ?? row.actor,
        date: formatDateTime(match?.date ?? row.rawTime),
        note: match?.note ?? row.note,
        lines,
      });
      setDetailOpen(true);
      return;
    }

    if (row.direction === "Masuk") {
      const match =
        inbound.find((rec) => rec.code === row.txCode) ??
        inbound.find((rec) => rec.id === row.recordId);
      const lines = match?.lines ?? [
        {
          code: row.itemCode,
          name: row.name,
          qty: Math.abs(row.qty),
          note: row.note,
        },
      ];
      setDetailData({
        txCode: match?.code ?? row.txCode,
        direction: row.direction,
        kind: "Barang",
        actor: resolveActor(match?.createdBy) ?? row.actor,
        date: formatDateTime(match?.date ?? row.rawTime),
        note: match?.note ?? row.note,
        lines,
      });
      setDetailOpen(true);
      return;
    }

    if (row.kind === "Bahan") {
      const match =
        rawOutbound.find((rec) => rec.code === row.txCode) ??
        rawOutbound.find((rec) => rec.id === row.recordId);
      const lines = (
        match?.lines ?? [
          {
            materialCode: row.itemCode,
            materialName: row.name,
            qty: Math.abs(row.qty),
            note: row.note,
            batchCode: row.batchCode,
          },
        ]
      ).map((l) => ({
        code: l.materialCode ?? row.itemCode,
        name: l.materialName ?? row.name,
        qty: Math.abs(l.qty),
        note: l.note ?? row.note,
        batchCode: l.batchCode ?? row.batchCode,
      }));
      setDetailData({
        txCode: match?.code ?? row.txCode,
        direction: row.direction,
        kind: row.kind,
        actor: resolveActor(match?.createdBy) ?? row.actor,
        date: formatDateTime(match?.date ?? row.rawTime),
        note: match?.note ?? row.note,
        lines,
      });
      setDetailOpen(true);
      return;
    }

    const match =
      outbound.find((rec) => rec.code === row.txCode) ??
      outbound.find((rec) => rec.id === row.recordId);
    const lines = match?.lines ?? [
      {
        code: row.itemCode,
        name: row.name,
        qty: Math.abs(row.qty),
        note: row.note,
      },
    ];
    setDetailData({
      txCode: match?.code ?? row.txCode,
      direction: row.direction,
      kind: row.kind,
      actor: resolveActor(match?.createdBy) ?? row.actor,
      date: formatDateTime(match?.date ?? row.rawTime),
      note: match?.note ?? row.note,
      lines,
    });
    setDetailOpen(true);
  };

  const exportExcel = () => {
    if (filtered.length === 0) return;

    const workbook = XLSX.utils.book_new();

    if (typeFilter === "all") {
      const inboundRows = filtered.filter((row) => row.direction === "Masuk");
      const outboundRows = filtered.filter((row) => row.direction === "Keluar");

      if (inboundRows.length > 0) {
        const data = buildHistoryRows(inboundRows);
        const sheet = XLSX.utils.aoa_to_sheet(data);
        applySheetStyles(sheet, data);
        XLSX.utils.book_append_sheet(workbook, sheet, "Masuk");
      }

      if (outboundRows.length > 0) {
        const data = buildHistoryRows(outboundRows);
        const sheet = XLSX.utils.aoa_to_sheet(data);
        applySheetStyles(sheet, data);
        XLSX.utils.book_append_sheet(workbook, sheet, "Keluar");
      }

      XLSX.writeFile(workbook, "riwayat.xlsx", { bookType: "xlsx" });
      return;
    }

    const data = buildHistoryRows(filtered);
    const sheet = XLSX.utils.aoa_to_sheet(data);
    applySheetStyles(sheet, data);
    XLSX.utils.book_append_sheet(workbook, sheet, typeFilter);
    const filename =
      typeFilter === "Masuk" ? "riwayat-masuk.xlsx" : "riwayat-keluar.xlsx";
    XLSX.writeFile(workbook, filename, { bookType: "xlsx" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Audit trail pergerakan stok
          </p>
          <h1 className="text-2xl font-semibold leading-tight">Riwayat</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadHistory} disabled={loading}>
            <RefreshCw className="mr-2 size-4" />
            {loading ? "Memuat..." : "Refresh"}
          </Button>
          <Button onClick={exportExcel} disabled={filtered.length === 0}>
            <Download className="mr-2 size-4" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total transaksi</p>
          <p className="mt-1 text-2xl font-semibold">{stats.total}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
              <ArrowDownLeft className="size-4" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Barang masuk</p>
              <p className="text-lg font-semibold">{stats.inboundCount} dok</p>
              <p className="text-xs text-muted-foreground">
                {stats.inboundQty} pcs
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-amber-50 text-amber-700">
              <ArrowUpRight className="size-4" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Barang keluar</p>
              <p className="text-lg font-semibold">
                {stats.outboundGoodsCount} baris
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.outboundQty - stats.outboundRawQty} pcs
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-amber-50 text-amber-700">
              <Package2 className="size-4" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Bahan baku keluar</p>
              <p className="text-lg font-semibold">
                {stats.outboundRawCount} baris
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.outboundRawQty} pcs
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Filter aktif</p>
          <p className="text-lg font-semibold">
            {typeFilter === "all" ? "Semua jenis" : typeFilter}
          </p>
          <p className="text-xs text-muted-foreground">
            {filtered.length} hasil
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-wrap gap-3 p-4">
          <div className="flex min-w-60 flex-1 items-center gap-2 rounded-lg border px-3">
            <Search className="size-4 text-muted-foreground" />
            <Input
              className="border-0 shadow-none focus-visible:ring-0"
              placeholder="Cari kode transaksi, barang, akun, atau catatan"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-lg border px-3 text-sm shadow-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          >
            <option value="all">Semua</option>
            <option value="Masuk">Masuk</option>
            <option value="Keluar">Keluar</option>
          </select>
          <select
            className="h-10 rounded-lg border px-3 text-sm shadow-sm"
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as typeof categoryFilter)
            }
          >
            <option value="all">Semua kategori</option>
            <option value="Barang">Barang</option>
            <option value="Bahan baku">Bahan baku</option>
            <option value="Produksi">Produksi</option>
          </select>
          <Input
            type="date"
            className="h-10 w-40"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            placeholder="Dari"
          />
          <Input
            type="date"
            className="h-10 w-40"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            placeholder="Sampai"
          />
        </div>
        <Separator />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-100">
              <TableRow>
                <TableHead className="font-semibold text-slate-800 w-12">
                  No
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Waktu
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Kode transaksi
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Nama barang
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Jenis
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Kategori
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Qty
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Akun
                </TableHead>
                <TableHead className="font-semibold text-slate-800 text-center">
                  Detail
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    Memuat riwayat...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-6 text-center text-sm text-red-600"
                  >
                    {error}
                  </TableCell>
                </TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    Tidak ada data. Ubah filter atau catat transaksi baru.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row, idx) => {
                  const isIn = row.direction === "Masuk";
                  return (
                    <TableRow key={row.id} className="odd:bg-slate-50">
                      <TableCell className="text-muted-foreground">
                        {start + idx + 1}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {row.time}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-700">
                        {row.txCode}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.itemCode}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "rounded-full px-3",
                            isIn
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-orange-50 text-orange-700",
                          )}
                        >
                          {row.direction}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "rounded-full px-3",
                            row.category === "Barang"
                              ? "bg-slate-100 text-slate-700"
                              : row.category === "Bahan baku"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-blue-50 text-blue-700",
                          )}
                        >
                          {row.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {isIn ? `+${row.qty}` : `-${row.qty}`}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.actor ?? "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          className="inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                          onClick={() => openDetail(row)}
                        >
                          <Eye className="mr-1 size-4" />
                          Detail
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <Pager className="justify-between px-4 py-3 text-sm text-muted-foreground">
          <div>
            Halaman{" "}
            <span className="font-semibold text-slate-900">{currentPage}</span>{" "}
            dari {pageCount}
          </div>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) setPage(currentPage - 1);
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive size="default">
                {currentPage}
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < pageCount) setPage(currentPage + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pager>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Riwayat perubahan draft
            </p>
            <h2 className="text-lg font-semibold">Draft</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {draftActivities.length} aktivitas
          </p>
        </div>
        <Separator />
        {draftActivities.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Belum ada aktivitas draft.
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto divide-y">
            {draftActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {activity.actor ?? "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-base">
              {detailData?.txCode ?? "Detail transaksi"}
              {detailData ? (
                <Badge
                  className={cn(
                    "rounded-full px-2 py-1 text-xs",
                    detailData.direction === "Masuk"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-orange-50 text-orange-700",
                  )}
                >
                  {detailData.direction}
                </Badge>
              ) : null}
              {detailData ? (
                <Badge
                  className={cn(
                    "rounded-full px-2 py-1 text-xs",
                    detailData.kind === "Bahan"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-700",
                  )}
                >
                  {detailData.kind}
                </Badge>
              ) : null}
            </SheetTitle>
            <SheetDescription>
              {detailData?.date ?? "Pilih baris untuk melihat detail."}
            </SheetDescription>
          </SheetHeader>

          {detailData ? (
            <div className="px-4 pb-6 space-y-4">
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-muted-foreground">
                  Akun
                </p>
                <p className="font-medium">{detailData.actor ?? "-"}</p>
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-muted-foreground">Catatan</p>
                <p className="font-medium">{detailData.note ?? "-"}</p>
              </div>
              <div className="rounded-lg border">
                <div className="border-b px-4 py-3 font-semibold">
                  Detail barang/bahan
                </div>
                <div className="max-h-80 overflow-y-auto divide-y">
                  {detailData.lines.map((line, idx) => (
                    <div
                      key={`${line.code}-${idx}`}
                      className="px-4 py-3 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">
                            {line.name ?? line.code}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {line.code}
                          </p>
                          {line.batchCode ? (
                            <p className="text-[11px] text-muted-foreground">
                              Batch: {line.batchCode}
                            </p>
                          ) : null}
                        </div>
                        <span className="font-semibold">{line.qty} pcs</span>
                      </div>
                      {line.note ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {line.note}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function applySheetStyles(
  worksheet: XLSX.WorkSheet,
  rows: Array<Array<string | number>>
) {
  const ref = worksheet["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const border = {
    top: { style: "thin", color: { rgb: "D1D5DB" } },
    bottom: { style: "thin", color: { rgb: "D1D5DB" } },
    left: { style: "thin", color: { rgb: "D1D5DB" } },
    right: { style: "thin", color: { rgb: "D1D5DB" } },
  };

  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[addr];
      if (!cell) continue;
      const isHeader = r === 0;
      cell.s = {
        font: { bold: isHeader },
        border,
        alignment: { vertical: "center", wrapText: true },
      };
    }
  }

  const cols = rows[0]?.map((_, colIdx) => {
    let max = 0;
    rows.forEach((row) => {
      const value = row[colIdx];
      const len = String(value ?? "").length;
      if (len > max) max = len;
    });
    return { wch: Math.min(Math.max(max + 2, 10), 60) };
  });
  if (cols && cols.length > 0) {
    worksheet["!cols"] = cols;
  }
}
