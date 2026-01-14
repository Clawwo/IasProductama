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
import { ArrowDownUp, Download, RefreshCw, Search } from "lucide-react";

// Keep API construction consistent with other pages
type Env = { VITE_API_BASE?: string };
const API_BASE = (
  (import.meta as { env?: Env }).env?.VITE_API_BASE ?? "http://localhost:3000"
)
  .trim()
  .replace(/\/$/, "");
const RAW_URL = `${API_BASE}/api/raw-materials`;

export function RawMaterialsPage() {
  const [rows, setRows] = useState<
    Array<{
      code: string;
      name?: string;
      category?: string;
      unit?: string;
      stock: number;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"code" | "name" | "stock">("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(RAW_URL);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as typeof rows;
      setRows(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memuat";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    const sorted = [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "stock") return (a.stock - b.stock) * dir;
      const left = (a[sortKey] ?? "").toString().toLowerCase();
      const right = (b[sortKey] ?? "").toString().toLowerCase();
      return left.localeCompare(right) * dir;
    });
    if (!term) return sorted;
    return sorted.filter((r) =>
      `${r.code} ${r.name ?? ""} ${r.category ?? ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [rows, search, sortDir, sortKey]);

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const header = ["Kode", "Nama", "Kategori", "Satuan", "Stok"];
    const csvRows = filtered.map((r) => [
      r.code,
      r.name ?? "",
      r.category ?? "",
      r.unit ?? "",
      r.stock,
    ]);
    const csv = [header, ...csvRows]
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
    link.download = "bahan-baku.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Daftar bahan baku produksi
          </p>
          <h1 className="text-2xl font-semibold leading-tight">Barang Baku</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 size-4" />
            {loading ? "Memuat..." : "Refresh"}
          </Button>
          <Button onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-wrap gap-3 p-4">
          <div className="flex min-w-60 flex-1 items-center gap-2 rounded-lg border px-3">
            <Search className="size-4 text-muted-foreground" />
            <Input
              className="border-0 shadow-none focus-visible:ring-0"
              placeholder="Cari kode, nama, atau kategori"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => toggleSort("stock")}>
            <ArrowDownUp className="mr-2 size-4" /> Sortir stok
          </Button>
        </div>
        <Separator />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-100">
              <TableRow>
                <TableHead className="font-semibold text-slate-800">
                  <button
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleSort("code")}
                  >
                    Kode
                  </button>
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  <button
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleSort("name")}
                  >
                    Nama
                  </button>
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Kategori
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Satuan
                </TableHead>
                <TableHead className="font-semibold text-slate-800 text-right">
                  Stok
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-6 text-center text-sm text-red-600"
                  >
                    {error}
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    Tidak ada data.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.code} className="odd:bg-slate-50">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.code}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.name ?? row.code}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.category ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.unit ?? "-"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {row.stock}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
          <span>Menampilkan {Math.min(filtered.length, rows.length)} data</span>
          <Badge variant="secondary" className="rounded-full px-3">
            {filtered.length} hasil
          </Badge>
        </div>
      </div>
    </div>
  );
}
