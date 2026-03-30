import { useCallback, useEffect, useMemo, useState } from "react";
import { httpJson } from "@/lib/http";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  Pagination as Pager,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import {
  Boxes,
  EllipsisVertical,
  Filter,
  Layers3,
  PackageSearch,
  PencilLine,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

type Env = { VITE_API_BASE?: string };
const API_BASE = (
  (import.meta as { env?: Env }).env?.VITE_API_BASE ?? "http://localhost:3000"
)
  .trim()
  .replace(/\/$/, "");
const CONVECTION_ITEMS_URL = `${API_BASE}/api/convection/items`;

type ConvectionItem = {
  code: string;
  name: string | null;
  category: string | null;
  unit: string | null;
  metersPerKg: number | null;
  stockBase: number;
};

type ConvectionForm = {
  code: string;
  name: string;
  category: string;
  unit: string;
  metersPerKg: number;
  stockBase: number;
};

const UNIT_OPTIONS = ["ONS", "KG", "METER", "PCS", "SET"] as const;

function normalizeUnitLabel(value: string | null | undefined): string {
  const cleaned = (value ?? "").trim().toUpperCase();
  if (!cleaned) return "KG";
  if (cleaned === "PASANG") return "SET";
  if (cleaned === "M" || cleaned === "METERS" || cleaned === "MTR")
    return "METER";
  if (cleaned === "PC" || cleaned === "PIECE" || cleaned === "PIECES")
    return "PCS";
  if (cleaned === "OZ" || cleaned === "ONZ") return "ONS";
  return cleaned;
}

function toUnitDisplayLabel(value: string | null | undefined): string {
  return normalizeUnitLabel(value).toLowerCase();
}

function toCategoryLabel(value: string | null | undefined): string {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return "-";
  return text.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function canonicalizeConvectionCategory(
  value: string | null | undefined,
  code?: string | null,
  name?: string | null,
): string {
  const raw = (value ?? "").trim();
  const upper = raw.toUpperCase();
  const c = (code ?? "").trim().toUpperCase();
  const n = (name ?? "").trim().toUpperCase();
  const combined = `${c} ${n} ${upper}`;
  if (!upper) return "";

  if (/^PTG\d+(\.\d+)?CM$/i.test(c) || combined.includes("PITA GOLD"))
    return "Pita Gold";
  if (/^PTS\d+(\.\d+)?CM$/i.test(c) || combined.includes("PITA SATIN"))
    return "Pita Satin";
  if (/^PTV\d+(\.\d+)?CM$/i.test(c) || combined.includes("PITA SILVER"))
    return "Pita Silver";
  if (
    combined.includes("RESLETING") ||
    /^(YE|YK|JK)\d+/i.test(c) ||
    /^JPH\d+/i.test(c) ||
    /^JPP\d+/i.test(c)
  ) {
    return "Resleting";
  }
  if (combined.includes("JAMUR") || combined.includes("ELASTIS")) {
    return "Elastis";
  }

  if (/^(B\.?\s*)?SEPATU$/i.test(upper)) return "Sepatu";
  if (/^PTG[\d.]*CM?$/i.test(upper) || upper === "PITA GOLD")
    return "Pita Gold";
  if (/^PTS[\d.]*CM?$/i.test(upper) || upper === "PITA SATIN")
    return "Pita Satin";
  if (/^PTV[\d.]*CM?$/i.test(upper) || upper === "PITA SILVER")
    return "Pita Silver";
  if (upper === "KARTON") return "Karton";
  if (upper === "JARUM") return "Jarum";
  if (upper === "BENANG") return "Benang";
  if (upper === "ELASTIS") return "Elastis";
  if (upper === "RESLETING") return "Resleting";
  if (upper === "PELES") return "Kain Peles";
  if (upper === "PRODUK") {
    if (c.startsWith("PTG")) return "Pita Gold";
    if (c.startsWith("PTS")) return "Pita Satin";
    if (c.startsWith("PTV")) return "Pita Silver";
    return "Kain Peles";
  }
  if (upper === "LAINNYA") {
    if (/^SIZE\s*/i.test(c) || /^SIZE\s*/i.test(n)) return "Sepatu";
    if (combined.includes("RESLETING")) return "Resleting";
  }

  return toCategoryLabel(raw);
}

type StockStatus = "all" | "aman" | "menipis" | "kritis";

function getStockStatus(stockBase: number): Exclude<StockStatus, "all"> {
  if (stockBase <= 0) return "kritis";
  if (stockBase < 5) return "menipis";
  return "aman";
}

function getMeters(item: ConvectionItem): number | null {
  if (item.metersPerKg === null) return null;
  return item.stockBase * item.metersPerKg;
}

function isSepatuLabel(value: string): boolean {
  return value.trim().toLowerCase() === "sepatu";
}

function formatStockValue(
  stockBase: number,
  unit: string | null | undefined,
): string {
  const normalizedUnit = normalizeUnitLabel(unit);
  if (normalizedUnit === "SET" || normalizedUnit === "PCS") {
    return String(Math.trunc(stockBase));
  }
  return stockBase.toFixed(2);
}

export function ConvectionInventoryPage() {
  const [items, setItems] = useState<ConvectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StockStatus>("all");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ConvectionItem | null>(null);
  const [manualCode, setManualCode] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ConvectionItem | null>(
    null,
  );
  const [form, setForm] = useState<ConvectionForm>({
    code: "",
    name: "",
    category: "",
    unit: "KG",
    metersPerKg: 0,
    stockBase: 0,
  });

  const perPage = 12;

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await httpJson<ConvectionItem[]>(CONVECTION_ITEMS_URL, {
        method: "GET",
      });
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      const normalized = canonicalizeConvectionCategory(
        item.category,
        item.code,
        item.name,
      );
      if (normalized) set.add(normalized);
    });
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    const lower = search.toLowerCase();
    return items.filter((item) => {
      const matchSearch =
        !search ||
        item.code.toLowerCase().includes(lower) ||
        item.name?.toLowerCase().includes(lower);
      const matchCategory =
        selectedCategories.length === 0 ||
        selectedCategories.includes(
          canonicalizeConvectionCategory(item.category, item.code, item.name),
        );
      const status = getStockStatus(item.stockBase);
      const matchStatus = statusFilter === "all" || statusFilter === status;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [items, search, selectedCategories, statusFilter]);

  const totalItems = filteredItems.length;
  const totalStock = filteredItems.reduce(
    (sum, item) => sum + item.stockBase,
    0,
  );
  const hideMetersColumn =
    selectedCategories.length > 0 &&
    selectedCategories.every((cat) => isSepatuLabel(cat));
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const currentPage = Math.min(page, totalPages);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredItems.slice(start, start + perPage);
  }, [filteredItems, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedCategories, statusFilter]);

  const escapeRegExp = useCallback((value: string) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }, []);

  const normalizeCategory = useCallback((value: string) => {
    return (value || "").trim().toUpperCase();
  }, []);

  const pickPrefix = useCallback((category: string, fallbackName?: string) => {
    const text = (category || fallbackName || "").toUpperCase();
    if (text.includes("KAIN")) return "KAIN";
    if (text.includes("BENANG")) return "BENANG";
    if (text.includes("PELES")) return "PELES";
    if (text.includes("VINYL")) return "VINYL";
    if (text.includes("AKSESORIS")) return "ACC";
    const first = text.split(/\s+/)[0] ?? "";
    return first.slice(0, 8) || "ITEM";
  }, []);

  const normalizeToken = (token: string) => token.replace(/[^A-Z0-9]/g, "");

  const normalizeCodeInput = useCallback((value: string) => {
    const upper = (value || "").trim().toUpperCase();
    const firstChunk = upper.split(/\s*[-:]\s*/)[0] ?? "";
    return firstChunk.replace(/[^A-Z0-9]/g, "");
  }, []);

  const normalizeNameInput = useCallback((value: string, code: string) => {
    const trimmed = (value || "").trim();
    if (!trimmed) return "";
    if (!code) return trimmed;
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^${escaped}\\s*[-:]?\\s*`, "i");
    return trimmed.replace(re, "").trim() || trimmed;
  }, []);

  const buildCodeBase = useCallback(
    (name: string, category: string) => {
      const words = name
        .toUpperCase()
        .split(/[^A-Z0-9]+/)
        .filter(Boolean);
      if (!words.length) return "";
      const prefix = pickPrefix(category, name);
      const body = words.slice(0, 3).map((w) => normalizeToken(w).slice(0, 6));
      return [prefix, ...body].filter(Boolean).join("-");
    },
    [pickPrefix],
  );

  const suggestCode = useCallback(
    (name: string, category: string) => {
      const base = buildCodeBase(name, category);
      if (!base) return "";
      const baseUpper = base.toUpperCase();
      const catNorm = normalizeCategory(category);
      const existing = items
        .filter((it) => normalizeCategory(it.category ?? "") === catNorm)
        .map((it) => it.code.toUpperCase());
      if (!existing.includes(baseUpper)) return baseUpper;
      const re = new RegExp(`^${escapeRegExp(baseUpper)}-(\\d+)$`);
      let max = 0;
      existing.forEach((code) => {
        const match = code.match(re);
        if (match) {
          const num = Number(match[1]);
          if (Number.isFinite(num)) max = Math.max(max, num);
        }
      });
      return `${baseUpper}-${String(max + 1).padStart(2, "0")}`;
    },
    [buildCodeBase, escapeRegExp, items, normalizeCategory],
  );

  function openAddForm() {
    setEditing(null);
    setManualCode(false);
    setFormError(null);
    setForm({
      code: "",
      name: "",
      category: "",
      unit: "KG",
      metersPerKg: 0,
      stockBase: 0,
    });
    setShowForm(true);
  }

  function openEditForm(item: ConvectionItem) {
    setEditing(item);
    setManualCode(true);
    setFormError(null);
    setForm({
      code: item.code,
      name: item.name ?? "",
      category: item.category ?? "",
      unit: normalizeUnitLabel(item.unit),
      metersPerKg: item.metersPerKg ?? 0,
      stockBase: item.stockBase,
    });
    setShowForm(true);
  }

  async function saveForm() {
    setFormError(null);
    if (!form.code.trim() || !form.name.trim() || !form.category.trim()) {
      setFormError("Kode, nama, dan kategori wajib diisi.");
      return;
    }
    if (form.stockBase < 0) {
      setFormError("Stok tidak boleh negatif.");
      return;
    }
    if (form.metersPerKg < 0) {
      setFormError("Konversi meter/kg tidak boleh negatif.");
      return;
    }
    if (
      !UNIT_OPTIONS.includes(
        normalizeUnitLabel(form.unit) as (typeof UNIT_OPTIONS)[number],
      )
    ) {
      setFormError("Satuan harus ONS, KG, METER, PCS, atau SET.");
      return;
    }

    if (!editing && items.some((it) => it.code === form.code.trim())) {
      setFormError(
        "Kode sudah ada. Gunakan kode lain atau edit item tersebut.",
      );
      return;
    }

    const normalizedCode = normalizeCodeInput(form.code);
    const normalizedName = normalizeNameInput(form.name, normalizedCode);

    if (!normalizedCode) {
      setFormError("Kode barang tidak valid.");
      return;
    }
    if (!normalizedName) {
      setFormError("Nama barang tidak valid.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: normalizedCode,
        name: normalizedName,
        category: form.category.trim(),
        unit: normalizeUnitLabel(form.unit),
        metersPerKg: form.metersPerKg > 0 ? form.metersPerKg : undefined,
        stockBase: form.stockBase,
      };

      const targetUrl = editing
        ? `${CONVECTION_ITEMS_URL}/${encodeURIComponent(editing.code)}`
        : CONVECTION_ITEMS_URL;

      await httpJson(targetUrl, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await loadItems();
      setShowForm(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Gagal menyimpan data.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await httpJson(
        `${CONVECTION_ITEMS_URL}/${encodeURIComponent(pendingDelete.code)}`,
        {
          method: "DELETE",
        },
      );
      await loadItems();
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus data.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6 text-slate-900 md:px-6 md:py-8">
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
            Gudang
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="flex items-center gap-2 font-heading text-3xl uppercase tracking-wide text-slate-900">
              <PackageSearch className="h-7 w-7 text-sky-600" />
              Daftar Barang Konveksi
            </h1>
            <div className="ml-auto flex flex-wrap gap-2 text-sm font-semibold text-slate-600">
              <Button
                className="bg-sky-600 text-white hover:bg-sky-700"
                onClick={openAddForm}
              >
                <Plus className="h-4 w-4" />
                Tambah Barang Konveksi
              </Button>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Layout dan alur disamakan dengan inventory utama agar user lebih
            familiar.
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </header>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm min-w-40">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-50 text-sky-600">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Total item
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {totalItems}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm min-w-40">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                <Layers3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Total stok (akumulasi)
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {totalStock.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2 text-xs font-semibold text-slate-600 sm:text-sm">
            <StatusTab
              label="All"
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
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
        </div>

        <div className="grid gap-3 sm:grid-cols-[2fr_1.1fr_auto]">
          <div className="sm:col-span-1 flex gap-2 min-w-0">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Cari nama atau kode barang"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 rounded-lg border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 sm:col-span-1 min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 w-full max-w-xs justify-between border-slate-200 bg-white text-slate-700 shadow-sm"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Filter className="h-4 w-4" />
                    {selectedCategories.length === 0
                      ? "Semua kategori"
                      : selectedCategories.join(", ")}
                  </span>
                  <EllipsisVertical className="h-4 w-4 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Pilih kategori</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={selectedCategories.length === 0}
                  onCheckedChange={() => setSelectedCategories([])}
                >
                  Semua kategori
                </DropdownMenuCheckboxItem>
                {categories.map((cat) => {
                  const checked = selectedCategories.includes(cat);
                  return (
                    <DropdownMenuCheckboxItem
                      key={cat}
                      checked={checked}
                      onCheckedChange={(isChecked) => {
                        setSelectedCategories((prev) => {
                          if (isChecked)
                            return Array.from(new Set([...prev, cat]));
                          return prev.filter((c) => c !== cat);
                        });
                      }}
                    >
                      {toCategoryLabel(cat)}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="secondary"
              className="h-11 border-slate-200 bg-white px-4 text-slate-700 shadow-sm"
              onClick={() => {
                setSearch("");
                setSelectedCategories([]);
                setStatusFilter("all");
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[64px]">No</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-center">Satuan</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                {hideMetersColumn ? null : (
                  <TableHead className="text-right">
                    Stok Setara Meter
                  </TableHead>
                )}
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={hideMetersColumn ? 8 : 9}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : pagedItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={hideMetersColumn ? 8 : 9}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Tidak ada data
                  </TableCell>
                </TableRow>
              ) : (
                pagedItems.map((item, index) => {
                  const status = getStockStatus(item.stockBase);
                  const meters = getMeters(item);
                  const hideMeters =
                    hideMetersColumn ||
                    canonicalizeConvectionCategory(
                      item.category,
                      item.code,
                      item.name,
                    ).toLowerCase() === "sepatu";
                  return (
                    <TableRow key={item.code} className="text-sm">
                      <TableCell className="text-slate-500">
                        {(currentPage - 1) * perPage + index + 1}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800">
                        {item.code}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {item.name ?? "-"}
                      </TableCell>
                      <TableCell>
                        {canonicalizeConvectionCategory(
                          item.category,
                          item.code,
                          item.name,
                        ) || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {toUnitDisplayLabel(item.unit)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">
                        {formatStockValue(item.stockBase, item.unit)}
                      </TableCell>
                      {hideMetersColumn ? null : (
                        <TableCell className="text-right">
                          {hideMeters
                            ? ""
                            : meters !== null
                              ? meters.toFixed(2)
                              : "-"}
                        </TableCell>
                      )}
                      <TableCell className="text-center align-middle">
                        <StatusBadge status={status} />
                      </TableCell>
                      <TableCell className="text-center">
                        <ActionsMenu
                          onEdit={() => openEditForm(item)}
                          onDelete={() => setPendingDelete(item)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-sm text-slate-600">
            Menampilkan {(currentPage - 1) * perPage + 1} -{" "}
            {Math.min(currentPage * perPage, totalItems)} dari {totalItems} item
          </div>
          <Pager className="m-0 w-auto justify-end">
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

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus barang konveksi?</AlertDialogTitle>
            <AlertDialogDescription>
              Barang{" "}
              <span className="font-semibold text-slate-900">
                {pendingDelete?.name ?? pendingDelete?.code}
              </span>{" "}
              akan dihapus dari daftar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(null)}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {editing ? "Edit" : "Tambah"} Barang Konveksi
                </p>
                <h2 className="font-heading text-2xl text-slate-900">
                  {editing ? "Ubah Barang" : "Barang Baru"}
                </h2>
              </div>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-800"
                onClick={() => setShowForm(false)}
              >
                x
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Kode
                </label>
                <Input
                  value={form.code}
                  onChange={(e) => {
                    setManualCode(true);
                    setForm((f) => ({ ...f, code: e.target.value }));
                  }}
                  placeholder="Kode unik"
                  className="h-11"
                  disabled={!!editing}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Nama Barang
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((f) => {
                      const next = { ...f, name: value };
                      if (!editing && !manualCode) {
                        const auto = suggestCode(value, f.category);
                        if (auto) next.code = auto;
                      }
                      return next;
                    });
                  }}
                  placeholder="Nama barang"
                  className="h-11"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Kategori
                </label>
                <Input
                  value={form.category}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((f) => {
                      const next = { ...f, category: value };
                      if (!editing && !manualCode) {
                        const auto = suggestCode(f.name, value);
                        if (auto) next.code = auto;
                      }
                      return next;
                    });
                  }}
                  list="convection-category-options"
                  placeholder="Pilih atau ketik kategori"
                  className="h-11"
                />
                <datalist id="convection-category-options">
                  {categories.map((cat) => (
                    <option key={cat} value={toCategoryLabel(cat)} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    Satuan
                  </label>
                  <Input
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        unit: e.target.value.toUpperCase(),
                      }))
                    }
                    list="convection-unit-options"
                    className="h-11"
                  />
                  <datalist id="convection-unit-options">
                    {UNIT_OPTIONS.map((unit) => (
                      <option key={unit} value={unit} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    Meter/KG
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.metersPerKg}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        metersPerKg: Number(e.target.value),
                      }))
                    }
                    className="h-11"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    Stok
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.stockBase}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        stockBase: Number(e.target.value),
                      }))
                    }
                    className="h-11"
                  />
                </div>
              </div>

              {formError ? (
                <p className="text-sm text-red-600">{formError}</p>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => setShowForm(false)}
                >
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

function ActionsMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
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

function StatusBadge({ status }: { status: "aman" | "menipis" | "kritis" }) {
  const map = {
    aman: {
      label: "Aman",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    menipis: {
      label: "Menipis",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    },
    kritis: { label: "Kritis", cls: "bg-red-50 text-red-700 border-red-200" },
  } as const;
  const cfg = map[status];
  return (
    <Badge
      variant="outline"
      className={`${cfg.cls} mx-auto inline-flex min-w-24 items-center justify-center gap-2 px-3 py-1 text-xs font-semibold`}
    >
      <span className="size-2 rounded-full bg-current" />
      <span>{cfg.label}</span>
    </Badge>
  );
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
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 transition ${
        active
          ? "border-sky-300 bg-sky-50 text-sky-700"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
