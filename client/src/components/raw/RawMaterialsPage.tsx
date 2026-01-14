import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDownUp,
  Download,
  Filter,
  RefreshCw,
  Search,
} from "lucide-react";

// Keep API construction consistent with other pages
type Env = { VITE_API_BASE?: string };
type StockStatus = "aman" | "menipis" | "kritis";
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
      subCategory?: string;
      kind?: string;
      stock: number;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"code" | "name" | "stock">("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<"" | StockStatus>("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.category && set.add(r.category));
    return Array.from(set).sort();
  }, [rows]);

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
    return sorted.filter((r) => {
      const textMatch = `${r.code} ${r.name ?? ""} ${r.category ?? ""} ${r.subCategory ?? ""} ${r.kind ?? ""}`
        .toLowerCase()
        .includes(term);
      const status = getStatus(r.stock);
      const statusMatch = statusFilter ? status === statusFilter : true;
      const catMatch =
        selectedCategories.length === 0 ||
        (r.category && selectedCategories.includes(r.category));
      return textMatch && statusMatch && catMatch;
    });
  }, [rows, search, sortDir, sortKey, statusFilter, selectedCategories]);

  const totalStock = useMemo(
    () => filtered.reduce((sum, r) => sum + r.stock, 0),
    [filtered]
  );

  function StatusTab({
    label,
    active,
    onClick,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        className={
          "rounded-full px-3 py-1.5 text-xs sm:text-sm " +
          (active
            ? "bg-slate-900 text-white shadow-sm"
            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50")
        }
        onClick={onClick}
      >
        {label}
      </button>
    );
  }

function getStatus(stock: number): StockStatus {
  if (stock <= 5) return "kritis";
  if (stock <= 14) return "menipis";
  return "aman";
}

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const header = ["Kode", "Nama", "Kategori", "Subkategori", "Jenis", "Stok"];
    const csvRows = filtered.map((r) => [
      r.code,
      r.name ?? "",
      r.category ?? "",
      r.subCategory ?? "",
      r.kind ?? "",
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

  function StatusBadge({ status }: { status: StockStatus }) {
    const map = {
      aman: {
        label: "Aman",
        cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      },
      menipis: {
        label: "Menipis",
        cls: "bg-amber-50 text-amber-700 border-amber-200",
      },
      kritis: {
        label: "Kritis",
        cls: "bg-red-50 text-red-700 border-red-200",
      },
    } as const;
    const cfg = map[status];
    return (
      <Badge
        variant="outline"
        className={cn(
          "flex items-center gap-2 px-3 py-1 text-xs font-semibold",
          cfg.cls
        )}
      >
        <span className="size-2 rounded-full bg-current" />
        <span className="truncate">{cfg.label}</span>
      </Badge>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Daftar bahan baku produksi
          </p>
          <h1 className="text-2xl font-semibold leading-tight">Barang Baku</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="rounded-full px-3">
              {filtered.length} item
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3">
              {totalStock} stok total
            </Badge>
          </div>
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
              placeholder="Cari kode, nama, kategori, subkategori, atau jenis"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="size-4" /> Kategori
                  {selectedCategories.length > 0 ? `(${selectedCategories.length})` : ""}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuLabel>Pilih kategori</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={selectedCategories.length === 0}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedCategories([]);
                  }}
                >
                  Semua kategori
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {categories.map((cat) => (
                  <DropdownMenuCheckboxItem
                    key={cat}
                    checked={selectedCategories.includes(cat)}
                    onCheckedChange={(checked) => {
                      setSelectedCategories((prev) => {
                        if (checked) return [...prev, cat];
                        return prev.filter((c) => c !== cat);
                      });
                    }}
                  >
                    {cat}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              <StatusTab
                label="Semua"
                active={!statusFilter}
                onClick={() => setStatusFilter("")}
              />
              <StatusTab
                label="Aman"
                active={statusFilter === "aman"}
                onClick={() => setStatusFilter("aman")}
              />
              <StatusTab
                label="Menipis"
                active={statusFilter === "menipis"}
                onClick={() => setStatusFilter("menipis")}
              />
              <StatusTab
                label="Kritis"
                active={statusFilter === "kritis"}
                onClick={() => setStatusFilter("kritis")}
              />
            </div>
            <Button variant="outline" onClick={() => toggleSort("stock")}>
              <ArrowDownUp className="mr-2 size-4" /> Sortir stok
            </Button>
          </div>
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
                  Subkategori
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Jenis
                </TableHead>
                <TableHead className="font-semibold text-slate-800">
                  Status
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
                    colSpan={7}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    Memuat data...
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
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
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
                      {row.subCategory ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.kind ?? "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={getStatus(row.stock)} />
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
