import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
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
  Pagination as Pager,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  ArrowDownUp,
  Boxes,
  EllipsisVertical,
  Download,
  Filter,
  Layers3,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Trash2,
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
  const [page, setPage] = useState(1);
  const perPage = 15;
  const [sortKey, setSortKey] = useState<"code" | "name" | "stock">("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<"" | StockStatus>("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [bahanSubCategories, setBahanSubCategories] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<(typeof rows)[number] | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<(typeof rows)[number] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    category: "",
    subCategory: "",
    kind: "",
    stock: 0,
  });
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.category && set.add(r.category));
    return Array.from(set).sort();
  }, [rows]);

  const subCategories = useMemo(() => {
  const types = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.subCategory && set.add(r.subCategory));
    return Array.from(set).sort();
  }, [rows]);

  const subCategoriesByCategory = useMemo(() => {
    const map = new Map<string, Set<string>>();
    rows.forEach((r) => {
      if (r.category && r.subCategory) {
        const set = map.get(r.category) ?? new Set<string>();
        set.add(r.subCategory);
        map.set(r.category, set);
      }
    });
    return map;
  }, [rows]);

  const bahanBakuSubOptions = useMemo(() => {
    return Array.from(subCategoriesByCategory.get("Bahan Baku") ?? []).sort();
  }, [subCategoriesByCategory]);

  useEffect(() => {
    if (!selectedCategories.includes("Bahan Baku")) {
      setBahanSubCategories([]);
    }
  }, [selectedCategories]);

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
      const textMatch = `${r.code} ${r.name ?? ""} ${r.category ?? ""} ${
        r.subCategory ?? ""
      } ${r.kind ?? ""}`
        .toLowerCase()
        .includes(term);
      const status = getStatus(r.stock);
      const statusMatch = statusFilter ? status === statusFilter : true;
      const catMatch =
        selectedCategories.length === 0 ||
        (r.category && selectedCategories.includes(r.category));
      const subCatMatch =
        selectedSubCategories.length === 0 ||
        (r.subCategory && selectedSubCategories.includes(r.subCategory));
      const bahanFilterActive =
        selectedCategories.includes("Bahan Baku") && bahanSubCategories.length > 0;
      const bahanSubMatch =
        !bahanFilterActive ||
        r.category !== "Bahan Baku" ||
        (r.subCategory && bahanSubCategories.includes(r.subCategory));
      return textMatch && statusMatch && catMatch && subCatMatch && bahanSubMatch;
    });
  }, [
    rows,
    search,
    sortDir,
    sortKey,
    statusFilter,
    selectedCategories,
    selectedSubCategories,
    bahanSubCategories,
  ]);
      const typeMatch =
        selectedTypes.length === 0 ||
        (r.subCategory && selectedTypes.includes(r.subCategory));
      return textMatch && statusMatch && catMatch && typeMatch;
    });
  }, [rows, search, sortDir, sortKey, statusFilter, selectedCategories, selectedTypes]);

  const totalStock = useMemo(
    () => filtered.reduce((sum, r) => sum + r.stock, 0),
    [filtered]
  );
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, currentPage]);

  function openAddForm() {
    setEditing(null);
    setForm({ code: "", name: "", category: "", subCategory: "", kind: "", stock: 0 });
    setFormError(null);
    setShowForm(true);
  }

  function openEditForm(row: (typeof rows)[number]) {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name ?? "",
      category: row.category ?? "",
      subCategory: row.subCategory ?? "",
      kind: row.kind ?? "",
      stock: row.stock,
    });
    setFormError(null);
    setShowForm(true);
  }

  async function saveForm() {
    setFormError(null);
    if (!form.code.trim() || !form.name.trim()) {
      setFormError("Kode dan nama wajib diisi.");
      return;
    }
    if (form.stock < 0) {
      setFormError("Stok tidak boleh negatif.");
      return;
    }

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      category: form.category.trim() || undefined,
      subCategory: form.subCategory.trim() || undefined,
      kind: form.kind.trim() || undefined,
      stock: form.stock,
    };

    setSaving(true);
    try {
      const targetUrl = editing
        ? `${RAW_URL}/${encodeURIComponent(editing.code)}`
        : RAW_URL;
      const res = await fetch(targetUrl, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
      setShowForm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan.";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(code: string) {
    setDeleting(true);
    try {
      const res = await fetch(`${RAW_URL}/${encodeURIComponent(code)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menghapus.";
      setError(message);
    } finally {
      setDeleting(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await deleteItem(pendingDelete.code);
    setPendingDelete(null);
  }

  function onCloseForm() {
    setShowForm(false);
  }

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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Daftar bahan baku produksi
          </p>
          <h1 className="text-2xl font-semibold leading-tight">Barang Baku</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm min-w-40">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-50 text-sky-600">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Total item
                </p>
                <p className="text-lg font-semibold text-slate-900">{totalItems}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm min-w-40">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                <Layers3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Total stok
                </p>
                <p className="text-lg font-semibold text-slate-900">{totalStock}</p>
              </div>
            </div>
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
          <Button className="bg-sky-600 text-white hover:bg-sky-700" onClick={openAddForm}>
            <Plus className="mr-2 size-4" />
            Tambah Barang
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
                  {selectedCategories.length > 0
                    ? `(${selectedCategories.length})`
                    : ""}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="size-4" /> Subkategori
                  {selectedSubCategories.length > 0
                    ? `(${selectedSubCategories.length})`
                    : ""}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuLabel>Pilih subkategori</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={selectedSubCategories.length === 0}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedSubCategories([]);
                  }}
                >
                  Semua subkategori
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {(selectedCategories.length === 0
                  ? subCategories
                  : Array.from(
                      new Set(
                        selectedCategories.flatMap((cat) =>
                          Array.from(subCategoriesByCategory.get(cat) ?? [])
                        )
                      )
                    ).sort()
                ).map((cat) => (
                  <DropdownMenuCheckboxItem
                    key={cat}
                    checked={selectedSubCategories.includes(cat)}
                    onCheckedChange={(checked) => {
                      setSelectedSubCategories((prev) => {
                        if (checked) return [...prev, cat];
                        return prev.filter((c) => c !== cat);
                      });
                    }}
                  >
                    {cat}
                  <Filter className="size-4" /> Jenis
                  {selectedTypes.length > 0 ? `(${selectedTypes.length})` : ""}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuLabel>Pilih jenis</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={selectedTypes.length === 0}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedTypes([]);
                  }}
                >
                  Semua jenis
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {types.map((t) => (
                  <DropdownMenuCheckboxItem
                    key={t}
                    checked={selectedTypes.includes(t)}
                    onCheckedChange={(checked) => {
                      setSelectedTypes((prev) => {
                        if (checked) return [...prev, t];
                        return prev.filter((x) => x !== t);
                      });
                    }}
                  >
                    {t}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {selectedCategories.includes("Bahan Baku") ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="size-4" /> Subkategori Bahan Baku
                    {bahanSubCategories.length > 0
                      ? `(${bahanSubCategories.length})`
                      : ""}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56">
                  <DropdownMenuLabel>Pilih subkategori (Bahan Baku)</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={bahanSubCategories.length === 0}
                    onCheckedChange={(checked) => {
                      if (checked) setBahanSubCategories([]);
                    }}
                  >
                    Semua subkategori
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {bahanBakuSubOptions.map((sub) => (
                    <DropdownMenuCheckboxItem
                      key={sub}
                      checked={bahanSubCategories.includes(sub)}
                      onCheckedChange={(checked) => {
                        setBahanSubCategories((prev) => {
                          if (checked) return [...prev, sub];
                          return prev.filter((c) => c !== sub);
                        });
                      }}
                    >
                      {sub}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
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
                <TableHead className="w-12 font-semibold text-slate-800">No</TableHead>
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
                <TableHead className="font-semibold text-slate-800">Status</TableHead>
                <TableHead className="font-semibold text-slate-800 text-right">Stok</TableHead>
                <TableHead className="font-semibold text-slate-800 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-sm text-red-600"
                  >
                    {error}
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    Tidak ada data.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((row, idx) => {
                  const rowNumber = (currentPage - 1) * perPage + idx + 1;
                  return (
                    <TableRow key={row.code} className="odd:bg-slate-50">
                      <TableCell className="text-slate-500">{rowNumber}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {row.code}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.name ?? row.code}</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={getStatus(row.stock)} />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {row.stock}
                      </TableCell>
                      <TableCell className="text-right">
                        <ActionsMenu
                          onEdit={() => openEditForm(row)}
                          onDelete={() => setPendingDelete(row)}
                        />
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
            Halaman <span className="font-semibold text-slate-900">{currentPage}</span> dari {totalPages}
          </span>
          <Pager className="justify-end gap-2">
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
                    if (currentPage < totalPages) setPage(currentPage + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pager>
        </div>
      </div>
      {pendingDelete ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Hapus barang?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Barang <span className="font-semibold">{pendingDelete.name ?? pendingDelete.code}</span> akan dihapus.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPendingDelete(null)}>
                Batal
              </Button>
              <Button
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Menghapus..." : "Hapus"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {editing ? "Edit" : "Tambah"} Barang
                </p>
                <h2 className="font-heading text-2xl text-slate-900">
                  {editing ? "Ubah Barang" : "Barang Baru"}
                </h2>
              </div>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-800"
                onClick={onCloseForm}
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Kode</label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="Kode unik"
                  className="h-11"
                  disabled={!!editing}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Nama</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nama barang"
                  className="h-11"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Kategori</label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Kategori"
                  className="h-11"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Subkategori</label>
                <Input
                  value={form.subCategory}
                  onChange={(e) => setForm((f) => ({ ...f, subCategory: e.target.value }))}
                  placeholder="Subkategori"
                  className="h-11"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Jenis</label>
                <Input
                  value={form.kind}
                  onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                  placeholder="Jenis (opsional)"
                  className="h-11"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Stok</label>
                <Input
                  type="number"
                  min={0}
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: Number(e.target.value) }))}
                  className="h-11"
                />
              </div>
              {formError ? (
                <p className="text-sm text-red-600">{formError}</p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={onCloseForm}>
                  Batal
                </Button>
                <Button
                  className="bg-sky-600 text-white hover:bg-sky-700"
                  onClick={saveForm}
                  disabled={saving}
                >
                  {saving ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionsMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 w-9 border border-slate-200 bg-white p-0 text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <EllipsisVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onEdit} className="text-slate-700">
          <PencilLine className="h-4 w-4 text-sky-600" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 className="h-4 w-4" />
          Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
