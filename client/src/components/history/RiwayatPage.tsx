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
import { httpJson } from "@/lib/http"; // Added import for httpJson

// Keep API construction consistent with other pages
type Env = { VITE_API_BASE?: string };
const API_BASE = ((import.meta as { env?: Env }).env?.VITE_API_BASE ?? "")
  .trim()
  .replace(/\/$/, "");
const HISTORY_URL = `${API_BASE}/api/history`;

type UserRef = { id: string; name?: string | null; email?: string | null };
type HistoryLine = {
  code: string;
  name?: string;
  direction: "Masuk" | "Keluar";
  kind: "Barang" | "Bahan";
  category: "Barang" | "Konveksi" | "Bahan baku" | "Produksi";
  qty: number;
  note?: string;
  batchCode?: string;
};

type HistoryDetail = {
  txCode: string;
  direction: "Masuk" | "Keluar";
  kind: "Barang" | "Bahan";
  category: "Barang" | "Konveksi" | "Bahan baku" | "Produksi";
  actor?: string;
  dateRaw: string;
  note?: string;
  lines: HistoryLine[];
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
  category: "Barang" | "Konveksi" | "Bahan baku" | "Produksi";
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

type HistoryResponse = {
  data: Movement[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
  stats: HistoryStats;
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
  const [movements, setMovements] = useState<Movement[]>([]);
  const [stats, setStats] = useState<HistoryStats>({
    total: 0,
    inboundCount: 0,
    outboundCount: 0,
    outboundGoodsCount: 0,
    outboundRawCount: 0,
    inboundQty: 0,
    outboundQty: 0,
    outboundRawQty: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "Masuk" | "Keluar">(
    "all",
  );
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | "Barang" | "Konveksi" | "Bahan baku" | "Produksi"
  >("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<{
    txCode: string;
    direction: Movement["direction"];
    kind: Movement["kind"];
    category: Movement["category"];
    actor?: string;
    date: string;
    note?: string;
    lines: Array<{
      code: string;
      name?: string;
      qty: number;
      note?: string;
      batchCode?: string;
      direction?: Movement["direction"];
      kind?: Movement["kind"];
      category?: Movement["category"];
    }>;
  } | null>(null);
  const perPage = 20;

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("perPage", String(perPage));

      if (typeFilter !== "all") {
        params.set("type", typeFilter);
      }

      if (categoryFilter !== "all") {
        params.set("category", categoryFilter);
      }

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (fromDate) {
        params.set("fromDate", fromDate);
      }

      if (toDate) {
        params.set("toDate", toDate);
      }

      const response = await httpJson<HistoryResponse>(
        `${HISTORY_URL}?${params.toString()}`,
      );

      setMovements(response.data);
      setStats(response.stats);
      setTotal(response.total);
      setPageCount(response.pageCount);
      if (response.page !== page) {
        setPage(response.page);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Gagal memuat riwayat.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, fromDate, page, perPage, search, toDate, typeFilter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Draft API belum tersedia di halaman ini; kosongkan agar kompilasi tetap aman
  const drafts = useMemo<DraftApi[]>(() => [], []);

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

  useEffect(() => {
    setPage(1);
  }, [typeFilter, categoryFilter, search, fromDate, toDate]);

  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * perPage;
  const pageRows = movements;

  const toDateOnly = (value: string, fallback?: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return fallback ?? "";
    return d.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" });
  };

  const buildHistoryRows = (
    rows: Movement[],
  ): Array<Array<string | number>> => {
    const header: string[] = [
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

    const data: Array<Array<string | number>> = rows.map((row) => [
      row.txCode,
      toDateOnly(row.rawTime, formatDateTime(row.rawTime)),
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
  };

  const downloadCsv = (rows: Movement[], filename: string) => {
    if (rows.length === 0) return;

    const table = buildHistoryRows(rows);
    const csv = table
      .map((cols: Array<string | number>) =>
        cols
          .map((col: string | number) => {
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

  const buildHistoryParams = useCallback(
    (targetPage: number, targetPerPage: number) => {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("perPage", String(targetPerPage));

      if (typeFilter !== "all") params.set("type", typeFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (search.trim()) params.set("search", search.trim());
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);

      return params;
    },
    [categoryFilter, fromDate, search, toDate, typeFilter],
  );

  const fetchAllMovementsForExport = useCallback(async () => {
    const first = await httpJson<HistoryResponse>(
      `${HISTORY_URL}?${buildHistoryParams(1, 200).toString()}`,
    );

    if (first.pageCount <= 1) {
      return first.data;
    }

    const allRows = [...first.data];
    for (let p = 2; p <= first.pageCount; p += 1) {
      const next = await httpJson<HistoryResponse>(
        `${HISTORY_URL}?${buildHistoryParams(p, 200).toString()}`,
      );
      allRows.push(...next.data);
    }
    return allRows;
  }, [buildHistoryParams]);

  const openDetail = (row: Movement) => {
    const detail = row.detail;
    const lines = detail?.lines ?? [
      {
        code: row.itemCode,
        name: row.name,
        qty: Math.abs(row.qty),
        note: row.note,
        batchCode: row.batchCode,
        direction: row.direction,
        kind: row.kind,
        category: row.category,
      },
    ];

    setDetailData({
      txCode: detail?.txCode ?? row.txCode,
      direction: detail?.direction ?? row.direction,
      kind: detail?.kind ?? row.kind,
      category: detail?.category ?? row.category,
      actor: detail?.actor ?? row.actor,
      date: formatDateTime(detail?.dateRaw ?? row.rawTime),
      note: detail?.note ?? row.note,
      lines: lines.map((line) => ({
        ...line,
        qty: Math.abs(line.qty),
        direction: line.direction,
        kind: line.kind,
        category: line.category,
      })),
    });
    setDetailOpen(true);
  };

  const exportExcel = async () => {
    const rowsToExport = await fetchAllMovementsForExport();
    if (rowsToExport.length === 0) return;

    const workbook = XLSX.utils.book_new();

    if (typeFilter === "all") {
      const inboundRows = rowsToExport.filter(
        (row) => row.direction === "Masuk",
      );
      const outboundRows = rowsToExport.filter(
        (row) => row.direction === "Keluar",
      );

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

    const data = buildHistoryRows(rowsToExport);
    const sheet = XLSX.utils.aoa_to_sheet(data);
    applySheetStyles(sheet, data);
    XLSX.utils.book_append_sheet(workbook, sheet, typeFilter);
    const filename =
      typeFilter === "Masuk" ? "riwayat-masuk.xlsx" : "riwayat-keluar.xlsx";
    XLSX.writeFile(workbook, filename, { bookType: "xlsx" });
  };

  const exportCsv = async () => {
    const rowsToExport = await fetchAllMovementsForExport();
    if (rowsToExport.length === 0) return;

    if (typeFilter === "all") {
      const inboundRows = rowsToExport.filter(
        (row) => row.direction === "Masuk",
      );
      const outboundRows = rowsToExport.filter(
        (row) => row.direction === "Keluar",
      );
      downloadCsv(inboundRows, "riwayat-masuk.csv");
      downloadCsv(outboundRows, "riwayat-keluar.csv");
      return;
    }

    const filename =
      typeFilter === "Masuk" ? "riwayat-masuk.csv" : "riwayat-keluar.csv";
    downloadCsv(rowsToExport, filename);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Catatan pergerakan stok
          </p>
          <h1 className="text-2xl font-semibold leading-tight">Riwayat</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadHistory} disabled={loading}>
            <RefreshCw className="mr-2 size-4" />
            {loading ? "Memuat..." : "Muat ulang"}
          </Button>
          <Button onClick={exportExcel} disabled={total === 0 || loading}>
            <Download className="mr-2 size-4" />
            Export Excel
          </Button>
          <Button
            variant="secondary"
            onClick={exportCsv}
            disabled={total === 0 || loading}
          >
            <Download className="mr-2 size-4" />
            Export CSV
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
              <p className="text-sm text-muted-foreground">
                Barang masuk (baris)
              </p>
              <p className="text-lg font-semibold">
                {stats.inboundCount} baris
              </p>
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
              <p className="text-sm text-muted-foreground">
                Barang keluar (baris)
              </p>
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
          <p className="text-xs text-muted-foreground">{total} hasil</p>
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
            <option value="Konveksi">Konveksi</option>
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
                        {formatDateTime(row.rawTime)}
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
                              : row.category === "Konveksi"
                                ? "bg-teal-50 text-teal-700"
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
            <p className="text-sm text-muted-foreground">Riwayat draft</p>
            <h2 className="text-lg font-semibold">Draft</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {draftActivities.length} aktivitas
          </p>
        </div>
        <Separator />
        {draftActivities.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Belum ada riwayat draft.
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
              {detailData ? (
                <Badge
                  className={cn(
                    "rounded-full px-2 py-1 text-xs",
                    detailData.category === "Produksi"
                      ? "bg-blue-50 text-blue-700"
                      : detailData.category === "Konveksi"
                        ? "bg-teal-50 text-teal-700"
                        : detailData.category === "Bahan baku"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-700",
                  )}
                >
                  {detailData.category}
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
                  {detailData.category === "Produksi"
                    ? "Pencatat"
                    : detailData.kind === "Bahan"
                      ? "Pengrajin"
                      : detailData.category === "Konveksi" &&
                          detailData.direction === "Keluar"
                        ? "Penerima"
                        : detailData.direction === "Masuk"
                          ? "Vendor"
                          : "Pemesan"}
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
                  {detailData.lines.map((line, idx) => {
                    const lineDirection =
                      line.direction ?? detailData.direction;
                    const lineCategory = line.category ?? detailData.category;
                    const lineKind = line.kind ?? detailData.kind;
                    const isIn = lineDirection === "Masuk";
                    const signedQty = `${isIn ? "+" : "-"}${line.qty}`;
                    return (
                      <div
                        key={`${line.code}-${idx}`}
                        className="px-4 py-3 text-sm"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-medium">
                          <Badge
                            className={cn(
                              "rounded-full px-2 py-0.5",
                              isIn
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-orange-50 text-orange-700",
                            )}
                          >
                            {lineDirection}
                          </Badge>
                          <Badge
                            className={cn(
                              "rounded-full px-2 py-0.5",
                              lineKind === "Bahan"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-700",
                            )}
                          >
                            {lineKind}
                          </Badge>
                          <Badge
                            className={cn(
                              "rounded-full px-2 py-0.5",
                              lineCategory === "Produksi"
                                ? "bg-blue-50 text-blue-700"
                                : lineCategory === "Konveksi"
                                  ? "bg-teal-50 text-teal-700"
                                  : lineCategory === "Bahan baku"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-slate-100 text-slate-700",
                            )}
                          >
                            {lineCategory}
                          </Badge>
                        </div>
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
                          <span className="font-semibold">{signedQty} pcs</span>
                        </div>
                        {line.note ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {line.note}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
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
  rows: Array<Array<string | number>>,
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
