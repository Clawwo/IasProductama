import { useCallback, useEffect, useMemo, useState } from "react";
import { httpJson } from "@/lib/http";
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
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
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
  Drum,
  Palette,
  CircleDot,
  Ruler,
  Package,
  PackageSearch,
  PencilLine,
  Plus,
  Download,
  Search,
  Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  inferKind,
  inventoryItemsWithKind,
  type InventoryItemWithKind,
} from "./items";

type Env = { VITE_API_BASE?: string };
const API_BASE = (
  (import.meta as { env?: Env }).env?.VITE_API_BASE ?? "http://localhost:3000"
)
  .trim()
  .replace(/\/$/, "");
const ITEMS_URL = `${API_BASE}/api/items`;
const RAW_URL = `${API_BASE}/api/raw-materials`;
const PRODUCTS_URL = `${API_BASE}/api/products`;

type RemoteItem = {
  code: string;
  name?: string;
  category?: string;
  subCategory?: string;
  kind?: string;
  stock: number;
};

export function InventoryPage({ readOnly = false }: { readOnly?: boolean }) {
  const [items, setItems] = useState<InventoryItemWithKind[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const perPage = 15;
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InventoryItemWithKind | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    category: "",
    stock: 0,
  });
  const [manualCode, setManualCode] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "aman" | "menipis" | "kritis"
  >("all");
  const [pendingDelete, setPendingDelete] =
    useState<InventoryItemWithKind | null>(null);
  const [ringSubCategory, setRingSubCategory] = useState<
    "all" | "SNARE" | "TOM"
  >("all");
  const [ringSize, setRingSize] = useState<string>("all");
  const [ringColor, setRingColor] = useState<string>("all");
  const [ringHoles, setRingHoles] = useState<string>("all");
  const [productSubCategory, setProductSubCategory] = useState<
    "all" | "DRUMBAND" | "HTS" | "SEMI"
  >("all");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsData, rawData, productsData] = await Promise.all([
        httpJson<RemoteItem[]>(ITEMS_URL),
        httpJson<RemoteItem[]>(RAW_URL),
        httpJson<RemoteItem[]>(PRODUCTS_URL),
      ]);

      const remoteMerged = [
        ...itemsData,
        ...rawData.filter(
          (raw) => !itemsData.some((it) => it.code === raw.code),
        ),
        ...productsData
          .filter(
            (prod) =>
              !itemsData.some((it) => it.code === prod.code) &&
              !rawData.some((raw) => raw.code === prod.code),
          )
          .map((prod) => {
            // Normalisasi kategori DRUMBAND/HTS/SEMI menjadi Produk
            if (
              prod.category === "DRUMBAND" ||
              prod.category === "HTS" ||
              prod.category === "SEMI"
            ) {
              return {
                ...prod,
                subCategory: prod.category,
                category: "Produk",
              };
            }
            return prod;
          }),
      ];
      const staticMap = new Map(
        inventoryItemsWithKind.map((base) => [base.code, base]),
      );
      const remoteMap = new Map(remoteMerged.map((it) => [it.code, it]));
      const combinedCodes = new Set<string>([
        ...staticMap.keys(),
        ...remoteMap.keys(),
      ]);

      const fromApi = Array.from(combinedCodes).map((code) => {
        const base = staticMap.get(code);
        const it = remoteMap.get(code);
        const merged = {
          ...base,
          ...it,
          code,
          name: it?.name ?? base?.name ?? "",
          category: it?.category ?? base?.category ?? "",
          subCategory: it?.subCategory ?? base?.subCategory,
          stock: it?.stock ?? base?.stock ?? 0,
        } as InventoryItemWithKind;
        return {
          ...merged,
          kind:
            (it?.kind as InventoryItemWithKind["kind"] | undefined) ??
            base?.kind ??
            inferKind(merged),
        };
      });
      setItems(fromApi);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memuat data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      const cat = (item.category || "").trim();
      if (cat) set.add(cat);
    });
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return items.filter((item) => {
      const matchText =
        item.name.toLowerCase().includes(term) ||
        item.code.toLowerCase().includes(term);
      const matchCategory =
        selectedCategories.length === 0 ||
        selectedCategories.includes(item.category);
      const status = getStatus(item.stock);
      const matchStatus = statusFilter === "all" || status === statusFilter;
      const isRing = item.kind === "RING";
      const matchRingSub =
        !isRing ||
        ringSubCategory === "all" ||
        item.subCategory === ringSubCategory;
      const ringItemSize = isRing ? getRingSize(item) : null;
      const matchRingSize =
        !isRing ||
        ringSize === "all" ||
        (ringItemSize && ringItemSize === ringSize);
      const ringItemColor = isRing ? getRingColor(item) : null;
      const matchRingColor =
        !isRing ||
        ringColor === "all" ||
        (ringItemColor && ringItemColor === ringColor);
      const ringItemHoles = isRing ? getRingHoles(item) : null;
      const matchRingHoles =
        !isRing ||
        ringHoles === "all" ||
        (ringItemHoles && ringItemHoles === ringHoles);
      const isProduct = item.category === "Produk";
      const matchProductSub =
        !isProduct ||
        productSubCategory === "all" ||
        item.subCategory === productSubCategory;
      return (
        matchText &&
        matchCategory &&
        matchStatus &&
        matchRingSub &&
        matchRingSize &&
        matchRingColor &&
        matchRingHoles &&
        matchProductSub
      );
    });
  }, [
    items,
    search,
    selectedCategories,
    statusFilter,
    ringSubCategory,
    ringSize,
    ringColor,
    ringHoles,
    productSubCategory,
  ]);

  const totalItems = filtered.length;
  const totalStock = filtered.reduce((sum, item) => sum + item.stock, 0);

  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

  const currentPage = Math.min(page, totalPages);

  const ringSizes = useMemo(() => {
    const sizes = new Set<string>();
    items.forEach((item) => {
      if (item.kind === "RING") {
        const size = getRingSize(item);
        if (size) sizes.add(size);
      }
    });
    return Array.from(sizes).sort((a, b) => Number(a) - Number(b));
  }, [items]);

  const ringColors = useMemo(() => {
    const colors = new Set<string>();
    items.forEach((item) => {
      if (item.kind === "RING") {
        const color = getRingColor(item);
        if (color) colors.add(color);
      }
    });
    return Array.from(colors).sort();
  }, [items]);

  const ringHoleCounts = useMemo(() => {
    const holes = new Set<string>();
    items.forEach((item) => {
      if (item.kind === "RING") {
        const hole = getRingHoles(item);
        if (hole) holes.add(hole);
      }
    });
    return Array.from(holes).sort((a, b) => Number(a) - Number(b));
  }, [items]);

  const escapeRegExp = useCallback((value: string) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }, []);

  const normalizeCategory = useCallback((value: string) => {
    return (value || "").trim().toUpperCase();
  }, []);

  const pickPrefix = useCallback((category: string, fallbackName?: string) => {
    const text = (category || fallbackName || "").toUpperCase();
    if (text.includes("RING")) return "RING";
    if (text.includes("LUG")) return "LUG";
    if (text.includes("HAR")) return "HAR";
    if (text.includes("HEAD")) return "HEAD";
    if (text.includes("BODY")) return "BODY";
    if (text.includes("FIN")) return "FIN";
    if (text.includes("PIPE")) return "PIPE";
    if (text.includes("ACC")) return "ACC";
    if (text.includes("SPARE")) return "SPAREPART";
    if (text.includes("BRACKET")) return "BRACKET";
    if (text.includes("STRAINER")) return "STRAINER";
    if (text.includes("STAND")) return "STAND";
    if (text.includes("BELL")) return "BELL";
    if (text.includes("MAHKOTA")) return "MAHKOTA";
    if (text.includes("HOLDER")) return "HOLDER";
    if (text.includes("RIM")) return "RIM";
    const first = text.split(/\s+/)[0] ?? "";
    return first.slice(0, 8) || "ITEM";
  }, []);

  const normalizeToken = (token: string) => token.replace(/[^A-Z0-9]/g, "");

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
        .filter((it) => normalizeCategory(it.category) === catNorm)
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

  const paged = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, currentPage]);

  function openAddForm() {
    if (readOnly) return;
    setEditing(null);
    setForm({ code: "", name: "", category: "", stock: 0 });
    setManualCode(false);
    setFormError(null);
    setShowForm(true);
  }

  function openEditForm(item: InventoryItemWithKind) {
    if (readOnly) return;
    setEditing(item);
    setForm({
      code: item.code,
      name: item.name,
      category: item.category,
      stock: item.stock,
    });
    setManualCode(true);
    setFormError(null);
    setShowForm(true);
  }

  async function saveForm() {
    if (readOnly) return;
    setFormError(null);
    if (!form.code.trim() || !form.name.trim() || !form.category.trim()) {
      setFormError("Kode, nama, dan kategori wajib diisi.");
      return;
    }
    if (form.stock < 0) {
      setFormError("Stok tidak boleh negatif.");
      return;
    }

    const payload: InventoryItemWithKind = {
      ...form,
      code: form.code.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
      kind: inferKind(form),
    };

    if (!editing && items.some((it) => it.code === payload.code)) {
      setFormError(
        "Kode sudah ada. Gunakan kode lain atau edit item tersebut.",
      );
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const targetUrl = editing
        ? `${ITEMS_URL}/${encodeURIComponent(editing.code)}`
        : ITEMS_URL;
      await httpJson(targetUrl, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await fetchItems();
      setShowForm(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Gagal menyimpan data.";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(code: string) {
    if (readOnly) return;
    setDeleting(true);
    setError(null);
    try {
      await httpJson(`${ITEMS_URL}/${encodeURIComponent(code)}`, {
        method: "DELETE",
      });
      await fetchItems();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus data.";
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

  const exportInventory = () => {
    if (filtered.length === 0) return;
    const header = ["Kode barang", "Nama barang", "Kategori", "Stok", "Status"];
    const rows = filtered.map((item) => [
      item.code,
      item.name,
      item.category,
      item.stock,
      getStatus(item.stock),
    ]);
    const data = [header, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    applySheetStyles(worksheet, data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
    XLSX.writeFile(workbook, "inventory-export.xlsx", { bookType: "xlsx" });
  };

  function onCloseForm() {
    setShowForm(false);
  }

  const columnCount = readOnly ? 5 : 6;

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
              Daftar Barang
            </h1>
            <div className="ml-auto flex flex-wrap gap-2 text-sm font-semibold text-slate-600">
              <Button
                variant="outline"
                className="border-slate-200 text-slate-700 hover:bg-slate-50"
                onClick={exportInventory}
                disabled={loading || filtered.length === 0}
              >
                <Download className="h-4 w-4" />
                Export Excel
              </Button>
              {!readOnly && (
                <Button
                  className="bg-sky-600 text-white hover:bg-sky-700"
                  onClick={openAddForm}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Barang
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Filter berdasarkan nama/kode atau kategori. Stok disinkronkan dari
            server.
          </p>
          {error ? (
            <p className="text-sm text-red-600">Gagal memuat data: {error}</p>
          ) : null}
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
                  Total stok
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {totalStock}
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
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 shadow-sm">
              <Filter className="h-4 w-4" />
              <span className="text-[11px] sm:text-xs">Per halaman</span>
              <span className="text-sm font-semibold text-slate-800">
                {perPage}
              </span>
            </div>
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
                className="h-11 rounded-lg border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm focus-visible:border-sky-500 focus-visible:ring-sky-200"
              />
            </div>
          </div>
          <div className="flex gap-2 sm:col-span-1 min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 w-full max-w-xs justify-between border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
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
                          if (isChecked) {
                            const next = [...prev, cat];
                            return Array.from(new Set(next));
                          }
                          return prev.filter((c) => c !== cat);
                        });
                      }}
                    >
                      {cat}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="secondary"
              className="h-11 border-slate-200 bg-white px-4 text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => {
                setSearch("");
                setSelectedCategories([]);
                setStatusFilter("all");
                setRingSubCategory("all");
                setRingSize("all");
                setRingColor("all");
                setRingHoles("all");
                setProductSubCategory("all");
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        {selectedCategories.includes("Ring") ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Filter Ring
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={ringSubCategory === "all" ? "ghost" : "default"}
                  className="h-9 px-3"
                >
                  <Drum className="mr-2 h-4 w-4" />
                  {ringSubCategory === "all"
                    ? "Model"
                    : ringSubCategory === "SNARE"
                      ? "Snare"
                      : "Tom"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40">
                <DropdownMenuLabel>Pilih Model</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setRingSubCategory("all")}>
                  Semua
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setRingSubCategory("SNARE")}>
                  Snare
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setRingSubCategory("TOM")}>
                  Tom
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={ringColor === "all" ? "ghost" : "default"}
                  className="h-9 px-3"
                >
                  <Palette className="mr-2 h-4 w-4" />
                  {ringColor === "all" ? "Warna" : ringColor}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40">
                <DropdownMenuLabel>Pilih warna</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setRingColor("all")}>
                  Semua
                </DropdownMenuItem>
                {ringColors.map((color) => (
                  <DropdownMenuItem
                    key={color}
                    onSelect={() => setRingColor(color)}
                  >
                    {color}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={ringHoles === "all" ? "ghost" : "default"}
                  className="h-9 px-3"
                >
                  <CircleDot className="mr-2 h-4 w-4" />
                  {ringHoles === "all" ? "Lubang" : `${ringHoles} lubang`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40">
                <DropdownMenuLabel>Jumlah lubang</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setRingHoles("all")}>
                  Semua
                </DropdownMenuItem>
                {ringHoleCounts.map((hole) => (
                  <DropdownMenuItem
                    key={hole}
                    onSelect={() => setRingHoles(hole)}
                  >
                    {hole} lubang
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={ringSize === "all" ? "ghost" : "default"}
                  className="h-9 px-3"
                >
                  <Ruler className="mr-2 h-4 w-4" />
                  {ringSize === "all" ? "Ukuran" : `${ringSize}"`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-36">
                <DropdownMenuLabel>Ukuran Ring</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setRingSize("all")}>
                  Semua
                </DropdownMenuItem>
                {ringSizes.map((size) => (
                  <DropdownMenuItem
                    key={size}
                    onSelect={() => setRingSize(size)}
                  >
                    {size}"
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}

        {selectedCategories.includes("Produk") ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Filter Produk
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={productSubCategory === "all" ? "ghost" : "default"}
                  className="h-9 px-3"
                >
                  <Package className="mr-2 h-4 w-4" />
                  {productSubCategory === "all" ? "Jenis" : productSubCategory}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40">
                <DropdownMenuLabel>Jenis Produk</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setProductSubCategory("all")}>
                  Semua
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setProductSubCategory("DRUMBAND")}
                >
                  DRUMBAND
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setProductSubCategory("HTS")}>
                  HTS
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setProductSubCategory("SEMI")}
                >
                  SEMI
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-3 sm:px-5">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <TableHead className="w-12">No</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stok</TableHead>
                  {!readOnly && <TableHead>Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={columnCount}
                      className="py-6 text-center text-sm text-slate-500"
                    >
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((item, idx) => {
                    const rowNumber = (currentPage - 1) * perPage + idx + 1;
                    const displayCode = buildDisplayCode(item);
                    return (
                      <Row
                        key={item.code}
                        item={item}
                        displayCode={displayCode}
                        rowNumber={rowNumber}
                        onEdit={() => openEditForm(item)}
                        onDelete={() => {
                          if (readOnly) return;
                          setPendingDelete(item);
                        }}
                        readOnly={readOnly}
                      />
                    );
                  })
                )}
                {!loading && filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columnCount}
                      className="py-6 text-center text-sm text-slate-500"
                    >
                      Tidak ada barang yang cocok.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>

        <Pager className="justify-between">
          <div className="text-sm text-slate-600">
            Halaman{" "}
            <span className="font-semibold text-slate-900">{currentPage}</span>{" "}
            dari {totalPages}
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
                  if (currentPage < totalPages) setPage(currentPage + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pager>
      </div>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus barang ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Barang{" "}
              <span className="font-semibold text-slate-900">
                {pendingDelete?.name}
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
              disabled={deleting || readOnly}
            >
              {deleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showForm && !readOnly ? (
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
                  list="category-options"
                  placeholder="Pilih atau ketik kategori"
                  className="h-11"
                />
                <datalist id="category-options">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Stok
                </label>
                <Input
                  type="number"
                  min={0}
                  value={form.stock}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, stock: Number(e.target.value) }))
                  }
                  className="h-11"
                />
              </div>
              {formError ? (
                <p className="text-sm text-red-600">{formError}</p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={onCloseForm}
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

function Row({
  item,
  displayCode,
  rowNumber,
  onEdit,
  onDelete,
  readOnly,
}: {
  item: InventoryItemWithKind;
  displayCode: string;
  rowNumber: number;
  onEdit: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}) {
  const status = getStatus(item.stock);
  return (
    <TableRow className="text-sm">
      <TableCell className="text-slate-500">{rowNumber}</TableCell>
      <TableCell className="font-semibold text-slate-800">
        {displayCode}
      </TableCell>
      <TableCell className="text-slate-700">{item.name}</TableCell>
      <TableCell>
        <StatusBadge status={status} />
      </TableCell>
      <TableCell className="font-semibold text-slate-900">
        {item.stock}
      </TableCell>
      {!readOnly && (
        <TableCell>
          <ActionsMenu onEdit={onEdit} onDelete={onDelete} />
        </TableCell>
      )}
    </TableRow>
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
      className={`${cfg.cls} flex items-center gap-2 px-3 py-1 text-xs font-semibold max-w-30 justify-start`}
    >
      <span className="size-2 rounded-full bg-current" />
      <span className="truncate">{cfg.label}</span>
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
      className={`rounded-full px-3 py-1.5 text-xs sm:text-sm ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function getStatus(stock: number): "aman" | "menipis" | "kritis" {
  if (stock <= 5) return "kritis";
  if (stock <= 14) return "menipis";
  return "aman";
}

function buildDisplayCode(item: InventoryItemWithKind) {
  return item.code;
}

function getRingSize(item: InventoryItemWithKind): string | null {
  const sizeMatch = item.name.match(/(\d{1,2}(?:[.,]\d+)?)\s*''/);
  if (!sizeMatch) return null;
  return sizeMatch[1].replace(",", ".");
}

function getRingColor(item: InventoryItemWithKind): string | null {
  const label = item.name.toLowerCase();
  if (label.includes("chrome")) return "Chrome";
  if (
    label.includes("hitam") ||
    label.includes("blk") ||
    label.includes("black")
  )
    return "Hitam";
  if (label.includes("gold")) return "Gold";
  return null;
}

function getRingHoles(item: InventoryItemWithKind): string | null {
  const holeMatch = item.name.match(/lubang\s*(\d{1,2})/i);
  if (!holeMatch) return null;
  return holeMatch[1];
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
