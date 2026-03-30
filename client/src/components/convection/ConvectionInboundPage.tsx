import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { httpJson, toUserMessage } from "@/lib/http";
import { cn } from "@/lib/utils";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Save,
  CheckCircle,
  Trash2,
  Calendar,
  Truck,
  StickyNote,
  Search,
  AlertCircle,
  Loader2,
} from "lucide-react";
  

type Env = { VITE_API_BASE?: string };
const API_BASE = (
  (import.meta as { env?: Env }).env?.VITE_API_BASE ?? ""
).trim();
const INBOUND_URL = `${
  API_BASE ? API_BASE.replace(/\/$/, "") : ""
}/api/convection/inbound`;
const ITEMS_URL = `${
  API_BASE ? API_BASE.replace(/\/$/, "") : ""
}/api/convection/items`;
const DRAFTS_URL = `${API_BASE ? API_BASE.replace(/\/$/, "") : ""}/api/drafts`;

type LineItem = {
  id: string;
  code: string;
  name: string;
  qty: number;
  unit: string;
  note?: string;
};

type ConvectionItem = {
  code: string;
  name: string | null;
  category: string | null;
  subCategory: string | null;
  unit: string | null;
  metersPerKg: number | null;
  stockBase: number;
};

type ToastVariant = "default" | "destructive";
type Toast = {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
};

// Check if item has meter conversion (fabric)
function hasMeterConversion(item: ConvectionItem | null): boolean {
  return item !== null && item.metersPerKg !== null;
}

function resolveDefaultUnit(item: ConvectionItem | null): string {
  const raw = item?.unit?.trim().toUpperCase();
  return raw && raw.length > 0 ? raw : "PCS";
}

// Get unit display name with description
function getUnitDisplayName(unit: string): string {
  const map: Record<string, string> = {
    KG: "Kilogram (kg)",
    PCS: "Pieces (pcs)",
    METER: "Meter (m)",
    M: "Meter (m)",
    ONS: "Ounce (ons)",
    SET: "Set (pasang)",
  };
  return map[unit] || unit;
}

// Get available units for item
function getAvailableUnits(item: ConvectionItem | null): string[] {
  if (!item) return [];

  const baseUnit = resolveDefaultUnit(item);

  // If has meter conversion, show KG, ONS, M
  if (hasMeterConversion(item)) {
    if (baseUnit === "KG") return ["KG", "ONS", "M"];
    if (baseUnit === "ONS") return ["ONS", "KG", "M"];
    return [baseUnit, "M"];
  }

  // Default to base unit
  return [baseUnit];
}

// Format stock display based on unit (no decimals for discrete units like PCS/SET)
function formatStockDisplay(stock: number, unit: string): string {
  const discreteUnits = ["PCS", "SET", "JARUM", "BENANG"];
  if (discreteUnits.includes(unit.toUpperCase())) {
    return Math.round(stock).toString();
  }
  return stock.toFixed(2);
}

export function ConvectionInboundPage() {
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [lineItem, setLineItem] = useState({
    code: "",
    name: "",
    qty: "1",
    unit: "",
    note: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("all");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [formError, setFormError] = useState<string>("");
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [submitMessage, setSubmitMessage] = useState<string>("");
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftStatus, setDraftStatus] = useState("Belum disimpan");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [allItems, setAllItems] = useState<ConvectionItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ConvectionItem | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return ["all", ...Array.from(set).sort()];
  }, [allItems]);

  const subCategories = useMemo(() => {
    if (selectedCategory === "all") return ["all"];
    const set = new Set<string>();
    allItems.forEach((item) => {
      if (item.category === selectedCategory && item.subCategory) {
        set.add(item.subCategory);
      }
    });
    return ["all", ...Array.from(set).sort()];
  }, [allItems, selectedCategory]);

  useEffect(() => {
    setSelectedSubCategory("all");
  }, [selectedCategory]);

  const fetchItems = useCallback(async () => {
    const data = await httpJson<ConvectionItem[]>(ITEMS_URL, {
      method: "GET",
    });
    setAllItems(data);
  }, []);

  function pushToast(variant: ToastVariant, title: string, message?: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, variant, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [allItems]);

  // Load all items on mount
  useEffect(() => {
    fetchItems().catch((err) => {
      console.error("Failed to load items:", err);
    });
  }, [fetchItems]);

  useEffect(() => {
    const raw = sessionStorage.getItem("draft:pending-load");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        id?: string;
        type?: string;
        payload?: Record<string, unknown>;
      };
      if (parsed.type !== "INBOUND" || !parsed.payload) return;

      const payload = parsed.payload as {
        draftKind?: unknown;
        vendor?: unknown;
        date?: unknown;
        note?: unknown;
        lines?: Array<{
          code?: unknown;
          name?: unknown;
          qty?: unknown;
          unit?: unknown;
          note?: unknown;
        }>;
      };

      const draftKind =
        typeof payload.draftKind === "string" ? payload.draftKind : undefined;
      if (draftKind && draftKind !== "CONVECTION_INBOUND") return;

      setVendor(typeof payload.vendor === "string" ? payload.vendor : "");
      setDate(
        typeof payload.date === "string" && payload.date
          ? payload.date.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      );
      setNote(typeof payload.note === "string" ? payload.note : "");

      const incomingLines = Array.isArray(payload.lines)
        ? payload.lines
            .map((l) => ({
              id: crypto.randomUUID(),
              code: typeof l.code === "string" ? l.code : "",
              name: typeof l.name === "string" ? l.name : "",
              qty: typeof l.qty === "number" ? l.qty : Number(l.qty) || 1,
              unit:
                typeof l.unit === "string" && l.unit.trim().length > 0
                  ? l.unit
                  : resolveDefaultUnit(
                      allItems.find(
                        (it) => it.code === (typeof l.code === "string" ? l.code : ""),
                      ) ?? null,
                    ),
              note: typeof l.note === "string" ? l.note : undefined,
            }))
            .filter((l) => l.code)
        : [];

      if (incomingLines.length > 0) {
        setLines(incomingLines);
      }
      setDraftStatus("Draft dimuat");
      setDraftId(typeof parsed.id === "string" ? parsed.id : null);
      setFormError("");
      pushToast(
        "default",
        "Draft dimuat",
        "Data draft barang masuk telah dimuat ke formulir."
      );
    } catch {
      setFormError("Draft tidak bisa dibaca");
      pushToast("destructive", "Gagal memuat draft", "Draft tidak bisa dibaca.");
    } finally {
      sessionStorage.removeItem("draft:pending-load");
    }
  }, [allItems]);

  // Filtered items based on search
  const filteredItems = allItems.filter((item) => {
    if (selectedCategory !== "all" && item.category !== selectedCategory) {
      return false;
    }
    if (
      selectedSubCategory !== "all" &&
      (item.subCategory ?? "") !== selectedSubCategory
    ) {
      return false;
    }
    const term = searchTerm.toLowerCase();
    return (
      item.code.toLowerCase().includes(term) ||
      item.name?.toLowerCase().includes(term)
    );
  });

  // Handle item selection
  const handleSelectItem = (item: ConvectionItem) => {
    setSelectedItem(item);
    setLineItem({
      code: item.code,
      name: item.name || item.code,
      qty: "1",
      unit: resolveDefaultUnit(item),
      note: "",
    });
    setSearchTerm(item.code);
    setDropdownOpen(false);
    setHighlightIndex(0);
  };

  // Handle unit change
  const handleUnitChange = (unit: string) => {
    setLineItem((prev) => ({ ...prev, unit }));
  };

  // Add line to table
  const handleAddLine = () => {
    if (!lineItem.code || !lineItem.name) {
      setFormError("❌ Pilih barang terlebih dahulu dari dropdown");
      return;
    }

    const qty = parseFloat(lineItem.qty);
    if (isNaN(qty) || qty <= 0) {
      setFormError("❌ Jumlah harus lebih dari 0");
      return;
    }

    if (!lineItem.unit || lineItem.unit.trim().length === 0) {
      setFormError("❌ Pilih satuan untuk barang");
      return;
    }

    // Validate unit is in available units
    const availableUnits = getAvailableUnits(selectedItem);
    if (!availableUnits.includes(lineItem.unit)) {
      setFormError(`❌ Satuan ${lineItem.unit} tidak sesuai dengan barang ini`);
      return;
    }

    const newLine: LineItem = {
      id: crypto.randomUUID(),
      code: lineItem.code,
      name: lineItem.name,
      qty,
      unit: lineItem.unit,
      note: lineItem.note,
    };

    setLines((prev) => [...prev, newLine]);
    setLineItem({ code: "", name: "", qty: "1", unit: "", note: "" });
    setSearchTerm("");
    setSelectedItem(null);
    setFormError("");
    pushToast("default", "✓ Barang ditambahkan", `${lineItem.name} telah ditambahkan ke daftar.`);
  };

  // Remove line
  const handleRemoveLine = (id: string) => {
    const line = lines.find(l => l.id === id);
    setLines((prev) => prev.filter((line) => line.id !== id));
    setConfirmRemoveId(null);
    pushToast("default", "Barang dihapus", `${line?.name} dihapus dari daftar.`);
  };

  // Submit form
  const handleSubmit = async () => {
    if (!vendor.trim()) {
      setFormError("Supplier harus diisi");
      return;
    }

    if (lines.length === 0) {
      setFormError("Tambahkan minimal 1 barang");
      return;
    }

    setSubmitStatus("loading");
    setFormError("");

    try {
      const payload = {
        vendor,
        date,
        note: note || undefined,
        lines: lines.map((line) => ({
          code: line.code,
          qty: line.qty,
          unit: line.unit,
          note: line.note || undefined,
        })),
      };

      await httpJson(INBOUND_URL, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSubmitStatus("success");
      setSubmitMessage("Barang masuk berhasil disimpan!");
      pushToast(
        "default",
        "Data tersimpan",
        `${lines.length} barang telah berhasil disimpan.`
      );

      // Reload items to reflect updated stock
      httpJson<ConvectionItem[]>(ITEMS_URL, { method: "GET" })
        .then(setAllItems)
        .catch(() => {});

      // Reset form
      setTimeout(() => {
        setVendor("");
        setDate(new Date().toISOString().slice(0, 10));
        setNote("");
        setLines([]);
        setDraftId(null);
        setDraftStatus("Belum disimpan");
        setSubmitStatus("idle");
        setSubmitMessage("");
      }, 2000);
    } catch (err) {
      setSubmitStatus("error");
      const message =
        err instanceof Error ? err.message : "Gagal menyimpan data";
      setSubmitMessage(message);
      pushToast("destructive", "Gagal menyimpan", message);
    }
  };

  const handleSaveDraft = async () => {
    const payload = {
      draftKind: "CONVECTION_INBOUND",
      vendor: vendor.trim(),
      date,
      note: note.trim() || undefined,
      lines: lines.map((line) => ({
        code: line.code,
        name: line.name,
        category: allItems.find((it) => it.code === line.code)?.category,
        subCategory: allItems.find((it) => it.code === line.code)?.subCategory,
        qty: line.qty,
        unit: line.unit,
        note: line.note,
      })),
    };

    try {
      setDraftSaving(true);
      const isUpdate = Boolean(draftId);
      const targetUrl = isUpdate ? `${DRAFTS_URL}/${draftId}` : DRAFTS_URL;
      const method = isUpdate ? "PUT" : "POST";

      const data = await httpJson<{ id?: string }>(targetUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "INBOUND", payload }),
      });

      if (data?.id) setDraftId(data.id);
      setDraftStatus("Draft tersimpan");
      pushToast(
        "default",
        isUpdate ? "Draft diperbarui" : "Draft tersimpan",
        `Data draft ${lines.length} barang telah disimpan.`
      );
    } catch (err: unknown) {
      const message = toUserMessage(err, "Gagal menyimpan draft");
      setFormError(message);
      pushToast("destructive", "Gagal menyimpan draft", message);
    } finally {
      setDraftSaving(false);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!dropdownOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < filteredItems.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[highlightIndex]) {
        handleSelectItem(filteredItems[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
    }
  };

  const totals = {
    totalItem: lines.length,
    totalQty: lines.reduce((sum, l) => sum + l.qty, 0),
  };

  const handleSearchFocus = () => {
    setDropdownOpen(true);
    fetchItems().catch(() => {});
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Toast Notifications */}
      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "rounded-lg px-4 py-3 text-sm font-medium shadow-lg animate-in fade-in slide-in-from-right-4 duration-300",
              toast.variant === "default"
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                : "bg-red-50 text-red-900 border border-red-200"
            )}
          >
            <div className="font-semibold">{toast.title}</div>
            {toast.message && (
              <div className="text-xs opacity-90 mt-1">{toast.message}</div>
            )}
          </div>
        ))}
      </div>

      {/* Confirmation Dialogs */}
      <AlertDialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Penyimpanan</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menyimpan {totals.totalItem} barang masuk dari supplier{" "}
              <span className="font-semibold">{vendor}</span> dengan total{" "}
              <span className="font-semibold">{totals.totalQty.toFixed(2)}</span>{" "}
              unit. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>
              Simpan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(confirmRemoveId)}
        onOpenChange={() => setConfirmRemoveId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Barang</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus barang ini dari daftar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRemoveId) {
                  handleRemoveLine(confirmRemoveId);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Barang Masuk Konveksi</h1>
        <p className="text-sm text-muted-foreground">
          Isi data dari atas ke bawah: info umum, pilih barang, lalu simpan.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Status draft: {draftStatus}</p>
      </div>

      {/* Header Info */}
      <div className="grid gap-6 rounded-lg border p-6 md:grid-cols-3">
        <div className="md:col-span-3 text-sm font-semibold text-slate-700">1. Informasi Umum</div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Truck className="h-4 w-4" />
            Supplier
          </label>
          <Input
            type="text"
            placeholder="Nama supplier"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4" />
            Tanggal
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <StickyNote className="h-4 w-4" />
            Catatan
          </label>
          <Input
            type="text"
            placeholder="Catatan (opsional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <Separator />

      {/* Add Item Form */}
      <div className="rounded-lg border p-6 mt-8">
        <h3 className="mb-2 font-semibold">2. Tambah Barang</h3>
        <p className="mb-8 text-sm text-muted-foreground">Pilih kategori, cari barang, isi jumlah, lalu tekan tombol tambah (+).</p>

        {/* Row 1: Category & Sub Category */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <div>
            <label className="mb-2 block text-sm font-medium">Kategori</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Semua kategori" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat === "all" ? "Semua kategori" : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Sub Kategori</label>
            <Select
              value={selectedSubCategory}
              onValueChange={setSelectedSubCategory}
              disabled={subCategories.length <= 1}
            >
              <SelectTrigger>
                <SelectValue placeholder="Semua sub kategori" />
              </SelectTrigger>
              <SelectContent>
                {subCategories.map((sub) => (
                  <SelectItem key={sub} value={sub}>
                    {sub === "all" ? "Semua sub kategori" : sub}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Item Picker */}
        <div ref={dropdownRef} className="relative mb-8">
          <label className="mb-2 block text-sm font-medium">Barang</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari kode atau nama..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setDropdownOpen(true);
                setHighlightIndex(0);
              }}
              onFocus={handleSearchFocus}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>

          {/* Dropdown */}
          {dropdownOpen && filteredItems.length > 0 && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white shadow-lg">
              {filteredItems.slice(0, 20).map((item, idx) => (
                <button
                  key={item.code}
                  className={cn(
                    "w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100",
                    idx === highlightIndex && "bg-gray-100",
                  )}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setHighlightIndex(idx)}
                >
                  <div className="flex items-baseline gap-2 justify-between">
                    <div className="font-mono font-semibold text-slate-900">{item.code}</div>
                    <div className="text-xs text-slate-500">
                      {formatStockDisplay(Number(item.stockBase ?? 0), item.unit || "PCS")}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{item.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Row 3: Quantity, Unit, Note, Button */}
        <div className="grid gap-6 md:grid-cols-12">
          {/* Quantity */}
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Jumlah</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Jumlah"
              value={lineItem.qty}
              onChange={(e) =>
                setLineItem((prev) => ({ ...prev, qty: e.target.value }))
              }
            />
          </div>

          {/* Unit */}
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Satuan</label>
            <Select
              value={lineItem.unit}
              onValueChange={handleUnitChange}
              disabled={!selectedItem}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih barang dulu" />
              </SelectTrigger>
              <SelectContent>
                {getAvailableUnits(selectedItem).map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {getUnitDisplayName(unit)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div className="md:col-span-6">
            <label className="mb-2 block text-sm font-medium">
              Catatan (opsional)
            </label>
            <Input
              type="text"
              placeholder="Catatan item"
              value={lineItem.note}
              onChange={(e) =>
                setLineItem((prev) => ({ ...prev, note: e.target.value }))
              }
            />
          </div>

          {/* Add Button */}
          <div className="flex items-end md:col-span-2">
            <Button onClick={handleAddLine} className="w-full">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <Badge variant="outline" className="px-3 py-1">
            {filteredItems.length} barang tersedia
          </Badge>
        </div>

        {/* Item Preview */}
        {selectedItem && (
          <div className="mt-6 rounded-lg bg-blue-50 p-4 border border-blue-200">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-blue-700">Barang Dipilih</p>
                <p className="text-sm font-semibold text-slate-900">{selectedItem.name}</p>
                <p className="text-xs text-slate-600">Kode: {selectedItem.code}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-blue-700">Kategori</p>
                  <p className="text-sm text-slate-900">{selectedItem.category || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-700">Stok Sekarang</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatStockDisplay(Number(selectedItem.stockBase ?? 0), selectedItem.unit || "PCS")} {resolveDefaultUnit(selectedItem)}
                  </p>
                </div>
              </div>
              {hasMeterConversion(selectedItem) && (
                <div className="md:col-span-2">
                  <p className="text-xs font-medium text-blue-700 mb-1">💡 Hint</p>
                  <p className="text-xs text-blue-900">
                    Item ini bisa satuan Meter atau Kilogram. Faktor konversi: {selectedItem.metersPerKg} meter/kg
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {formError && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Lines Summary */}
      {lines.length > 0 && (
        <div className="grid gap-2 rounded-lg border bg-slate-50 p-4 sm:grid-cols-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Total Barang
            </span>
            <span className="text-lg font-semibold">{totals.totalItem}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Total Jumlah
            </span>
            <span className="text-lg font-semibold">
              {totals.totalQty.toFixed(2)} unit
            </span>
          </div>
        </div>
      )}

      {/* Lines Table */}
      {lines.length > 0 && (
        <div className="mt-8 rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[90px]">Kode</TableHead>
                <TableHead className="min-w-[200px]">Nama Barang</TableHead>
                <TableHead className="text-right w-[80px]">Jumlah</TableHead>
                <TableHead className="text-center w-[70px]">Satuan</TableHead>
                <TableHead className="flex-1">Catatan</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id} className="hover:bg-slate-50">
                  <TableCell className="font-mono text-sm font-semibold">
                    {line.code}
                  </TableCell>
                  <TableCell className="text-sm">
                    {line.name}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatStockDisplay(line.qty, line.unit)}
                  </TableCell>
                  <TableCell className="text-center text-sm text-slate-600">
                    {line.unit}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {line.note || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setConfirmRemoveId(line.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-end gap-3">
        {submitStatus === "success" && (
          <Alert className="flex-1 border-green-500 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-700">Berhasil!</AlertTitle>
            <AlertDescription className="text-green-600">
              {submitMessage}
            </AlertDescription>
          </Alert>
        )}

        {submitStatus === "error" && (
          <Alert variant="destructive" className="flex-1">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Gagal!</AlertTitle>
            <AlertDescription>{submitMessage}</AlertDescription>
          </Alert>
        )}

        <Button
          variant="outline"
          onClick={handleSaveDraft}
          disabled={submitStatus === "loading" || draftSaving}
          className="min-w-[160px]"
        >
          {draftSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Simpan Draft
            </>
          )}
        </Button>

        <Button
          onClick={() => setConfirmSubmitOpen(true)}
          disabled={
            submitStatus === "loading" ||
            lines.length === 0 ||
            !vendor.trim()
          }
          className="min-w-[180px]"
        >
          {submitStatus === "loading" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Simpan Data
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
