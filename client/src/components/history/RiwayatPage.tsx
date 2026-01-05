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
  RefreshCw,
  Search,
} from "lucide-react";

// Keep API construction consistent with other pages
type Env = { VITE_API_BASE?: string };
const API_BASE = ((import.meta as { env?: Env }).env?.VITE_API_BASE ?? "")
  .trim()
  .replace(/\/$/, "");
const INBOUND_URL = `${API_BASE}/api/inbound`;
const OUTBOUND_URL = `${API_BASE}/api/outbound`;

type LineApi = { code: string; qty: number; note?: string; name?: string };
type InboundApi = {
  id: string;
  vendor?: string;
  date: string;
  note?: string;
  lines: LineApi[];
  createdAt?: string;
};
type OutboundApi = {
  id: string;
  orderer?: string;
  date: string;
  note?: string;
  lines: LineApi[];
  createdAt?: string;
};

type Movement = {
  id: string;
  direction: "Masuk" | "Keluar";
  code: string;
  name: string;
  qty: number;
  actor?: string;
  time: string;
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
  const perPage = 20;

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
          code: line.code,
          name: line.name ?? line.code,
          qty: line.qty,
          actor: (rec as never)[actorKey] as string | undefined,
          time: formatDateTime(sourceDate),
          timestamp: Date.parse(sourceDate) || 0,
          note: line.note ?? rec.note,
        }));
      });

    const combined = [
      ...mapLines(inbound, "Masuk", "vendor"),
      ...mapLines(outbound, "Keluar", "orderer"),
    ];

    return combined.sort((a, b) => b.timestamp - a.timestamp);
  }, [inbound, outbound]);

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
      const haystack = `${row.code} ${row.name} ${row.actor ?? ""} ${
        row.note ?? ""
      }`.toLowerCase();
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

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const header = [
      "Waktu",
      "Kode barang",
      "Nama barang",
      "Jenis",
      "Qty",
      "Vendor",
      "Catatan",
    ];
    const rows = filtered.map((row) => [
      row.time,
      row.code,
      row.name,
      row.direction,
      row.direction === "Masuk" ? `+${row.qty}` : `-${row.qty}`,
      row.actor ?? "",
      row.note ?? "",
    ]);
    const csv = [header, ...rows]
      .map((cols) =>
        cols
          .map((col) => {
            const value = String(col ?? "");
            return value.includes(",") || value.includes("\n")
              ? `"${value.replace(/"/g, '""')}"`
              : value;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "riwayat-pergerakan.csv";
    link.click();
    URL.revokeObjectURL(url);
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
          <Button onClick={exportCsv} disabled={filtered.length === 0}>
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
          <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border px-3">
            <Search className="size-4 text-muted-foreground" />
            <Input
              className="border-0 shadow-none focus-visible:ring-0"
              placeholder="Cari barang, vendor, atau catatan"
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
            className="h-10 w-[160px]"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            placeholder="Dari"
          />
          <Input
            type="date"
            className="h-10 w-[160px]"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            placeholder="Sampai"
          />
        </div>
        <Separator />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Kode barang</TableHead>
                <TableHead>Nama barang</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    Memuat riwayat...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-6 text-center text-sm text-red-600"
                  >
                    {error}
                  </TableCell>
                </TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    Tidak ada data. Ubah filter atau catat transaksi baru.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => {
                  const isIn = row.direction === "Masuk";
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {row.time}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {row.code}
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
    </div>
  );
}
