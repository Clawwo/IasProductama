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
const ITEMS_URL = `${API_BASE}/api/items`;

type LineApi = { code: string; qty: number; note?: string; name?: string };
type InboundApi = {
  id: string;
  code?: string;
  vendor?: string;
  date: string;
  note?: string;
  lines: LineApi[];
  createdAt?: string;
};
type OutboundApi = {
  id: string;
  code?: string;
  orderer?: string;
  date: string;
  note?: string;
  lines: LineApi[];
  createdAt?: string;
};

type Movement = {
  id: string;
  direction: "Masuk" | "Keluar";
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

export function RiwayatPage() {
  const [items, setItems] = useState<Array<{ code: string; name?: string }>>(
    []
  );
  const [inbound, setInbound] = useState<InboundApi[]>([]);
  const [outbound, setOutbound] = useState<OutboundApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "Masuk" | "Keluar">(
    "all"
  );
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<{
    txCode: string;
    direction: Movement["direction"];
    actor?: string;
    date: string;
    note?: string;
    lines: Array<{ code: string; name?: string; qty: number; note?: string }>;
  } | null>(null);
  const perPage = 20;

  useEffect(() => {
    let cancelled = false;
    const loadItems = async () => {
      try {
        const res = await fetch(ITEMS_URL);
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as Array<{
          code: string;
          name?: string;
        }>;
        if (!cancelled) setItems(data);
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
      const [inRes, outRes] = await Promise.all([
        fetch(`${INBOUND_URL}?limit=200`),
        fetch(`${OUTBOUND_URL}?limit=200`),
      ]);
      if (!inRes.ok) throw new Error(await inRes.text());
      if (!outRes.ok) throw new Error(await outRes.text());
      const inboundData = (await inRes.json()) as InboundApi[];
      const outboundData = (await outRes.json()) as OutboundApi[];
      setInbound(inboundData);
      setOutbound(outboundData);
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
    const nameMap = new Map(items.map((it) => [it.code, it.name]));
    const mapLines = (
      rows: Array<InboundApi | OutboundApi>,
      direction: Movement["direction"],
      actorKey: "vendor" | "orderer"
    ) =>
      rows.flatMap((rec) => {
        const sourceDate = rec.createdAt ?? rec.date ?? "";
        return rec.lines.map((line, idx) => ({
          id: `${direction}-${rec.id}-${idx}-${line.code}`,
          direction,
          txCode: rec.code ?? "-",
          recordId: rec.id,
          itemCode: line.code,
          name: line.name ?? nameMap.get(line.code) ?? line.code,
          qty: line.qty,
          actor: (rec as never)[actorKey] as string | undefined,
          time: formatDateTime(sourceDate),
          rawTime: sourceDate,
          timestamp: Date.parse(sourceDate) || 0,
          note: line.note ?? rec.note,
        }));
      });

    const combined = [
      ...mapLines(inbound, "Masuk", "vendor"),
      ...mapLines(outbound, "Keluar", "orderer"),
    ];

    return combined.sort((a, b) => b.timestamp - a.timestamp);
  }, [inbound, outbound, items]);

  const stats = useMemo(() => {
    const total = movements.length;
    const inboundRows = movements.filter((m) => m.direction === "Masuk");
    const outboundRows = movements.filter((m) => m.direction === "Keluar");
    const inboundQty = inboundRows.reduce((sum, row) => sum + row.qty, 0);
    const outboundQty = outboundRows.reduce((sum, row) => sum + row.qty, 0);
    return {
      total,
      inboundCount: inboundRows.length,
      outboundCount: outboundRows.length,
      inboundQty,
      outboundQty,
    };
  }, [movements]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fromTs = fromDate ? Date.parse(`${fromDate}T00:00:00`) : null;
    const toTs = toDate ? Date.parse(`${toDate}T23:59:59`) : null;

    return movements.filter((row) => {
      if (typeFilter !== "all" && row.direction !== typeFilter) return false;
      if (fromTs && row.timestamp < fromTs) return false;
      if (toTs && row.timestamp > toTs) return false;
      if (!term) return true;
      const haystack = `${row.txCode} ${row.itemCode} ${row.name} ${
        row.actor ?? ""
      } ${row.note ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [movements, typeFilter, search, fromDate, toDate]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, search, fromDate, toDate]);

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
      "Vendor/PO",
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
      row.note ?? "",
    ]);
    return [header, ...data];
  };

  const openDetail = (row: Movement) => {
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
        actor: match?.vendor,
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
      actor: match?.orderer,
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
              <p className="text-lg font-semibold">{stats.outboundCount} dok</p>
              <p className="text-xs text-muted-foreground">
                {stats.outboundQty} pcs
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
              placeholder="Cari kode transaksi, barang, vendor, atau catatan"
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
                <TableHead className="font-semibold text-slate-800">
                  Waktu
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Kode transaksi
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Kode barang
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Nama barang
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Jenis
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Qty
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Vendor
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Catatan
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
                pageRows.map((row) => {
                  const isIn = row.direction === "Masuk";
                  return (
                    <TableRow key={row.id} className="odd:bg-slate-50">
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {row.time}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-700">
                        {row.txCode}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {row.itemCode}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <p className="text-xs text-muted-foreground">
                          {row.note}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "rounded-full px-3",
                            isIn
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-orange-50 text-orange-700"
                          )}
                        >
                          {row.direction}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {isIn ? `+${row.qty}` : `-${row.qty}`}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.actor ?? "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.note ?? "-"}
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
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
          <span>
            Menampilkan {pageRows.length} dari {filtered.length} riwayat
          </span>
          <Pager>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) setPage(currentPage - 1);
                  }}
                  aria-disabled={currentPage === 1}
                  tabIndex={currentPage === 1 ? -1 : 0}
                />
              </PaginationItem>
              {Array.from({ length: pageCount }).map((_, idx) => {
                const pageNumber = idx + 1;
                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      isActive={pageNumber === currentPage}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(pageNumber);
                      }}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < pageCount) setPage(currentPage + 1);
                  }}
                  aria-disabled={currentPage === pageCount}
                  tabIndex={currentPage === pageCount ? -1 : 0}
                />
              </PaginationItem>
            </PaginationContent>
          </Pager>
        </div>
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
                      : "bg-orange-50 text-orange-700"
                  )}
                >
                  {detailData.direction}
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
                <p className="text-muted-foreground">Vendor/PO</p>
                <p className="font-medium">{detailData.actor ?? "-"}</p>
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-muted-foreground">Catatan</p>
                <p className="font-medium">{detailData.note ?? "-"}</p>
              </div>
              <div className="rounded-lg border">
                <div className="border-b px-4 py-3 font-semibold">
                  Detail barang
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
