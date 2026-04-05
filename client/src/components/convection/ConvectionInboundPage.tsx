import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

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
  const [today, setToday] = useState(() => getTodayIsoDate());
  const [date, setDate] = useState(() => getTodayIsoDate());
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

  useEffect(() => {
    const tick = () => {
      const next = getTodayIsoDate();
      setToday((prev) => (prev === next ? prev : next));
      setDate((prev) => (prev < next ? next : prev));
    };
    const interval = window.setInterval(tick, 60000);
    return () => window.clearInterval(interval);
  }, []);

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
                        (it) =>
                          it.code ===
                          (typeof l.code === "string" ? l.code : ""),
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
        "Data draft barang masuk telah dimuat ke formulir.",
      );
    } catch {
      setFormError("Draft tidak bisa dibaca");
      pushToast(
        "destructive",
        "Gagal memuat draft",
        "Draft tidak bisa dibaca.",
      );
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

  const visibleItems = useMemo(
    () => filteredItems.slice(0, 50),
    [filteredItems],
  );

  const stockBadgeClass = useMemo(() => {
    if (!selectedItem) return "border-slate-200 bg-slate-50 text-slate-600";
    const stock = Number(selectedItem.stockBase ?? 0);
    if (stock <= 0) return "border-red-200 bg-red-50 text-red-700";
    if (stock < 5) return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }, [selectedItem]);

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
    pushToast(
      "default",
      "✓ Barang ditambahkan",
      `${lineItem.name} telah ditambahkan ke daftar.`,
    );
  };

  // Remove line
  const handleRemoveLine = (id: string) => {
    const line = lines.find((l) => l.id === id);
    setLines((prev) => prev.filter((line) => line.id !== id));
    setConfirmRemoveId(null);
    pushToast(
      "default",
      "Barang dihapus",
      `${line?.name} dihapus dari daftar.`,
    );
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setSubmitStatus("success");
      setSubmitMessage("Barang masuk berhasil disimpan!");
      pushToast(
        "default",
        "Data tersimpan",
        `${lines.length} barang telah berhasil disimpan.`,
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
        `Data draft ${lines.length} barang telah disimpan.`,
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
        prev < visibleItems.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (visibleItems[highlightIndex]) {
        handleSelectItem(visibleItems[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
    }
  };

  const totals = {
    totalItem: lines.length,
    totalQty: lines.reduce((sum, l) => sum + l.qty, 0),
  };

  const lineToRemove =
    lines.find((line) => line.id === confirmRemoveId) ?? null;

  return (
    <div className="min-h-screen bg-white px-4 py-6 text-slate-900 md:px-6 md:py-8">
      <ToastRegion toasts={toasts} />

      <AlertDialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi simpan</AlertDialogTitle>
            <AlertDialogDescription>
              Simpan pencatatan barang masuk konveksi ini?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmSubmitOpen(false);
                handleSubmit();
              }}
            >
              Ya, simpan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(confirmRemoveId)}
        onOpenChange={(open) => {
          if (!open) setConfirmRemoveId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus baris ini?</AlertDialogTitle>
            <AlertDialogDescription>
              {lineToRemove
                ? `${lineToRemove.code} - ${lineToRemove.name}`
                : "Baris barang akan dihapus dari daftar."}
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
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                Konveksi
              </p>
              <h1 className="text-3xl font-semibold text-slate-900 leading-tight">
                Barang Masuk Konveksi
              </h1>
              <p className="text-sm text-slate-600">
                Catat barang masuk konveksi dengan alur yang sama seperti
                transaksi gudang.
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full px-3">
                Draft
              </Badge>
              <Button
                variant="outline"
                className="border-dashed cursor-pointer"
                disabled={submitStatus === "loading" || draftSaving}
                onClick={handleSaveDraft}
              >
                <Save className="size-4" />
                {draftSaving ? "Menyimpan..." : "Simpan draft"}
              </Button>
              <Button
                disabled={
                  submitStatus === "loading" ||
                  lines.length === 0 ||
                  !vendor.trim()
                }
                className="cursor-pointer"
                onClick={() => setConfirmSubmitOpen(true)}
              >
                <CheckCircle className="size-4" /> Tandai selesai
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Status Draft"
              value={draftStatus}
              sub="Simpan draft tanpa mengubah stok"
            />
            <SummaryCard
              label="Total item"
              value={String(totals.totalItem)}
              sub="Baris diterima"
            />
            <SummaryCard
              label="Total qty (unit)"
              value={totals.totalQty.toFixed(2)}
              sub="Semua baris"
            />
            <SummaryCard
              label="Tanggal"
              value={date || "-"}
              sub="Tanggal penerimaan"
            />
          </div>
        </header>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <LabeledInput
              label="Tanggal masuk"
              icon={<Calendar className="size-4" />}
            >
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={today}
              />
            </LabeledInput>
            <LabeledInput
              label="Pemasok / pengirim"
              icon={<Truck className="size-4" />}
            >
              <Input
                placeholder="Nama supplier"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
            </LabeledInput>
            <LabeledInput
              label="Catatan"
              icon={<StickyNote className="size-4" />}
            >
              <Input
                placeholder="Opsional"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </LabeledInput>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Baris barang
              </p>
              <p className="text-sm text-slate-600">
                Tambahkan bahan konveksi yang diterima beserta jumlah dan
                satuan.
              </p>
            </div>
            <Badge variant="outline" className="ml-auto rounded-full px-3 py-1">
              {filteredItems.length} barang tersedia
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-end xl:grid-cols-12">
            <div className="min-w-0 md:col-span-1 xl:col-span-2">
              <LabeledInput label="Kategori">
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="w-full min-w-0">
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
              </LabeledInput>
            </div>

            <div className="min-w-0 md:col-span-1 xl:col-span-2">
              <LabeledInput label="Sub kategori">
                <Select
                  value={selectedSubCategory}
                  onValueChange={setSelectedSubCategory}
                  disabled={subCategories.length <= 1}
                >
                  <SelectTrigger className="w-full min-w-0">
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
              </LabeledInput>
            </div>

            <div className="min-w-0 md:col-span-2 xl:col-span-4">
              <LabeledInput
                label="Pilih / cari barang"
                icon={<Search className="size-4" />}
              >
                <DropdownMenu
                  open={dropdownOpen}
                  onOpenChange={(open) => {
                    setDropdownOpen(open);
                    if (open) {
                      fetchItems().catch(() => {});
                    }
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 w-full justify-between"
                    >
                      <span className="truncate text-left">
                        {lineItem.name
                          ? `${lineItem.code} - ${lineItem.name}`
                          : "Pilih / cari barang"}
                      </span>
                      <div className="flex items-center gap-2">
                        {lineItem.name ? (
                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-2 py-0.5 text-xs",
                              stockBadgeClass,
                            )}
                          >
                            Stok:{" "}
                            {formatStockDisplay(
                              Number(selectedItem?.stockBase ?? 0),
                              selectedItem?.unit || "PCS",
                            )}
                          </span>
                        ) : null}
                        <Search className="size-4 text-slate-500" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-104 max-w-[calc(100vw-2rem)] p-0"
                  >
                    <div className="p-2">
                      <Input
                        autoFocus
                        placeholder="Ketik nama atau kode"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setHighlightIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                        className="h-9"
                      />
                    </div>
                    <DropdownMenuSeparator />
                    <div className="max-h-64 overflow-y-auto">
                      {visibleItems.map((item, idx) => (
                        <DropdownMenuItem
                          key={item.code}
                          className={
                            highlightIndex === idx ? "bg-slate-100" : undefined
                          }
                          onSelect={() => handleSelectItem(item)}
                        >
                          <div className="flex w-full flex-col gap-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className="max-w-60 truncate font-semibold text-slate-900"
                                title={item.code}
                              >
                                {item.code}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                                Stok:{" "}
                                {formatStockDisplay(
                                  Number(item.stockBase ?? 0),
                                  item.unit || "PCS",
                                )}
                              </span>
                            </div>
                            <span
                              className="max-w-70 truncate text-xs text-slate-600"
                              title={item.name ?? item.code}
                            >
                              {item.name ?? item.code}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                      {filteredItems.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-slate-500">
                          Barang tidak ditemukan.
                        </div>
                      ) : null}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </LabeledInput>
            </div>

            <div className="min-w-0 md:col-span-1 xl:col-span-1">
              <LabeledInput label="Jumlah">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={lineItem.qty}
                  onChange={(e) =>
                    setLineItem((prev) => ({ ...prev, qty: e.target.value }))
                  }
                />
              </LabeledInput>
            </div>

            <div className="min-w-0 md:col-span-1 xl:col-span-1">
              <LabeledInput label="Satuan">
                <Select
                  value={lineItem.unit}
                  onValueChange={handleUnitChange}
                  disabled={!selectedItem}
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableUnits(selectedItem).map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {getUnitDisplayName(unit)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LabeledInput>
            </div>

            <div className="min-w-0 md:col-span-2 xl:col-span-2">
              <LabeledInput label="Catatan baris">
                <Input
                  placeholder="Opsional"
                  value={lineItem.note}
                  onChange={(e) =>
                    setLineItem((prev) => ({ ...prev, note: e.target.value }))
                  }
                />
              </LabeledInput>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {selectedItem
                ? `Dipilih: ${selectedItem.code} - ${selectedItem.name ?? selectedItem.code}`
                : "Belum ada barang dipilih."}
            </p>
            <Button onClick={handleAddLine} className="cursor-pointer">
              <Plus className="size-4" /> Tambah baris
            </Button>
          </div>

          {formError ? (
            <div className="text-sm text-red-600">{formError}</div>
          ) : null}
          {submitStatus === "success" ? (
            <div className="text-sm text-green-600">
              {submitMessage || "Berhasil disimpan."}
            </div>
          ) : null}
          {submitStatus === "error" ? (
            <div className="text-sm text-red-600">
              {submitMessage || "Gagal menyimpan."}
            </div>
          ) : null}

          <Separator />

          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-12">No</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead>Nama Barang</TableHead>
                <TableHead className="w-28">Qty</TableHead>
                <TableHead className="w-24">Satuan</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, idx) => (
                <TableRow key={line.id}>
                  <TableCell className="text-slate-500">{idx + 1}</TableCell>
                  <TableCell className="font-semibold text-slate-900">
                    {line.code}
                  </TableCell>
                  <TableCell className="text-slate-800">{line.name}</TableCell>
                  <TableCell className="font-semibold">
                    {formatStockDisplay(line.qty, line.unit)}
                  </TableCell>
                  <TableCell className="text-slate-700">{line.unit}</TableCell>
                  <TableCell className="text-slate-600">
                    {line.note || "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-red-600"
                      onClick={() => setConfirmRemoveId(line.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-6 text-center text-sm text-slate-500"
                  >
                    Belum ada baris. Tambahkan barang masuk konveksi di atas.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </section>
      </div>
    </div>
  );
}

function ToastRegion({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-60 flex flex-col gap-2 sm:right-6 sm:top-6">
      {toasts.map((toast) => (
        <Alert
          key={toast.id}
          variant={toast.variant === "destructive" ? "destructive" : "default"}
          className={cn(
            "pointer-events-auto shadow-lg",
            toast.variant === "destructive"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900",
          )}
        >
          <AlertTitle>{toast.title}</AlertTitle>
          {toast.message ? (
            <AlertDescription>{toast.message}</AlertDescription>
          ) : null}
        </Alert>
      ))}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub ? <p className="text-sm text-slate-600">{sub}</p> : null}
    </div>
  );
}

function LabeledInput({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block w-full space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-2">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
