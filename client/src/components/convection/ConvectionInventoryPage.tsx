import { useCallback, useEffect, useMemo, useState } from "react";
import { httpJson } from "@/lib/http";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
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
  Download,
  EllipsisVertical,
  Filter,
  Layers3,
  PackageSearch,
  PencilLine,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";

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
  subCategory: string | null;
  unit: string | null;
  metersPerKg: number | null;
  stockBase: number;
  createdAt?: string;
  updatedAt?: string;
};

type ConvectionForm = {
  code: string;
  name: string;
  category: string;
  subCategory: string;
  unit: string;
  metersPerKg: number;
  stockBase: number;
};

type ToastVariant = "default" | "destructive";
type Toast = {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
};

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

function normalizeUnitInput(value: string | null | undefined): string {
  const cleaned = (value ?? "").trim();
  if (!cleaned) return "";
  return normalizeUnitLabel(cleaned);
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

function formatSummaryByUnit(
  value: number,
  unit: "PCS" | "ONS" | "KG" | "METER",
) {
  if (unit === "PCS") {
    return Math.trunc(value).toLocaleString("id-ID");
  }
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ConvectionInventoryPage({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  const [items, setItems] = useState<ConvectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recentlyEditedCode, setRecentlyEditedCode] = useState<string | null>(
    null,
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StockStatus>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
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
    subCategory: "",
    unit: "KG",
    metersPerKg: 0,
    stockBase: 0,
  });

  const perPage = 12;

  const pushToast = useCallback(
    (variant: ToastVariant, title: string, message?: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, variant, title, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 4200);
    },
    [],
  );

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await httpJson<ConvectionItem[]>(CONVECTION_ITEMS_URL, {
        method: "GET",
      });
      setItems(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal memuat data konveksi.";
      setError(message);
      pushToast("destructive", "Gagal memuat daftar konveksi", message);
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!recentlyEditedCode) return;
    const timer = window.setTimeout(() => {
      setRecentlyEditedCode(null);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [recentlyEditedCode]);

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

  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      const rawUnit = (item.unit ?? "").trim();
      if (!rawUnit) return;
      const normalized = normalizeUnitLabel(rawUnit);
      if (normalized) set.add(normalized);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const subCategoryOptions = useMemo(() => {
    const selectedCategory = canonicalizeConvectionCategory(form.category)
      .trim()
      .toLowerCase();
    const options = new Set<string>();

    if (selectedCategory) {
      items.forEach((item) => {
        const itemCategory = canonicalizeConvectionCategory(
          item.category,
          item.code,
          item.name,
        )
          .trim()
          .toLowerCase();
        if (itemCategory !== selectedCategory) return;
        const sub = (item.subCategory ?? "").trim();
        if (sub) options.add(sub);
      });
    }

    if (selectedCategory === "sepatu") {
      options.add("Mayoret");
      options.add("Pasukan");
      options.add("Lainnya");
    }

    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [form.category, items]);

  const filteredItems = useMemo(() => {
    const lower = search.toLowerCase();
    const hasDateFilter = Boolean(fromDate || toDate);
    const fromTimestamp = fromDate
      ? Date.parse(`${fromDate}T00:00:00`)
      : Number.NaN;
    const toTimestamp = toDate ? Date.parse(`${toDate}T23:59:59`) : Number.NaN;

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
      const rawItemDate = item.updatedAt ?? item.createdAt;
      const itemTimestamp = rawItemDate ? Date.parse(rawItemDate) : Number.NaN;
      const matchDateRange =
        !hasDateFilter ||
        (!Number.isNaN(itemTimestamp) &&
          (Number.isNaN(fromTimestamp) || itemTimestamp >= fromTimestamp) &&
          (Number.isNaN(toTimestamp) || itemTimestamp <= toTimestamp));

      return matchSearch && matchCategory && matchStatus && matchDateRange;
    });
  }, [items, search, selectedCategories, statusFilter, fromDate, toDate]);

  const totalItems = filteredItems.length;
  const stockSummary = useMemo(() => {
    return filteredItems.reduce(
      (acc, item) => {
        const normalizedUnit = normalizeUnitLabel(item.unit);
        if (normalizedUnit === "PCS") acc.pcs += item.stockBase;
        if (normalizedUnit === "ONS") acc.ons += item.stockBase;
        if (normalizedUnit === "KG") acc.kg += item.stockBase;

        const meters = getMeters(item);
        if (meters !== null) acc.meter += meters;

        return acc;
      },
      { pcs: 0, ons: 0, kg: 0, meter: 0 },
    );
  }, [filteredItems]);
  const hideMetersColumn =
    selectedCategories.length > 0 &&
    selectedCategories.every((cat) => isSepatuLabel(cat));
  const unitAutoLocked = false;
  const normalizedFormUnit = normalizeUnitInput(form.unit);
  const meterPerKgLocked =
    normalizedFormUnit === "PCS" || (!editing && normalizedFormUnit === "KG");
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const currentPage = Math.min(page, totalPages);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredItems.slice(start, start + perPage);
  }, [filteredItems, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedCategories, statusFilter, fromDate, toDate]);

  const escapeRegExp = useCallback((value: string) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }, []);

  const normalizeCategory = useCallback((value: string) => {
    return (value || "").trim().toUpperCase();
  }, []);

  const pickPrefix = useCallback((category: string, fallbackName?: string) => {
    const text = (category || fallbackName || "").toUpperCase();
    if (text.includes("SEPATU")) return "PS";
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

  const splitCodeNumberSuffix = useCallback((code: string) => {
    const upper = (code || "").trim().toUpperCase();
    const match = upper.match(/^(.*?)(\d+)$/);
    if (!match) return null;
    const stem = match[1];
    const digits = match[2];
    const number = Number(digits);
    if (!stem || !Number.isFinite(number)) return null;
    return {
      stem,
      number,
      pad: digits.length,
    };
  }, []);

  const suggestFromCategoryPattern = useCallback(
    (category: string, subCategory?: string) => {
      const requestedCategory = canonicalizeConvectionCategory(category);
      const catNorm = normalizeCategory(requestedCategory);
      if (!catNorm) return "";

      const requestedSubNorm = (subCategory || "").trim().toUpperCase();

      const categoryMatches = items.filter(
        (it) =>
          normalizeCategory(
            canonicalizeConvectionCategory(it.category, it.code, it.name),
          ) === catNorm,
      );

      const scopedMatches = requestedSubNorm
        ? categoryMatches.filter(
            (it) =>
              (it.subCategory ?? "").trim().toUpperCase() === requestedSubNorm,
          )
        : categoryMatches;

      const effectiveMatches =
        scopedMatches.length > 0 ? scopedMatches : categoryMatches;

      let existingCodes = effectiveMatches
        .map((it) => it.code.toUpperCase())
        .filter(Boolean);

      if (
        existingCodes.length === 0 &&
        requestedCategory.toLowerCase() === "sepatu"
      ) {
        existingCodes = items
          .filter((it) => {
            const code = (it.code ?? "").toUpperCase();
            const name = (it.name ?? "").toUpperCase();
            return code.startsWith("PS") || name.includes("SEPATU");
          })
          .map((it) => it.code.toUpperCase())
          .filter(Boolean);
      }

      if (existingCodes.length === 0) {
        const fallbackStem = pickPrefix(requestedCategory, requestedCategory)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
        if (!fallbackStem) return "";

        const parsedFallback = items
          .map((it) => (it.code || "").toUpperCase())
          .filter((code) => code.startsWith(fallbackStem))
          .map((code) => splitCodeNumberSuffix(code))
          .filter(
            (parsed): parsed is { stem: string; number: number; pad: number } =>
              Boolean(parsed && parsed.stem === fallbackStem),
          );

        if (parsedFallback.length === 0) {
          return `${fallbackStem}${String(1).padStart(2, "0")}`;
        }

        const maxNumber = Math.max(...parsedFallback.map((p) => p.number));
        const maxPad = Math.max(...parsedFallback.map((p) => p.pad));
        let next = maxNumber + 1;
        let candidate = `${fallbackStem}${String(next).padStart(maxPad, "0")}`;
        const existingSet = new Set(
          items.map((it) => (it.code || "").toUpperCase()),
        );
        while (existingSet.has(candidate)) {
          next += 1;
          candidate = `${fallbackStem}${String(next).padStart(maxPad, "0")}`;
        }
        return candidate;
      }

      const existingSet = new Set(existingCodes);
      const stemGroups = new Map<
        string,
        { count: number; max: number; pad: number }
      >();

      existingCodes.forEach((code) => {
        const parsed = splitCodeNumberSuffix(code);
        if (!parsed) return;
        const prev = stemGroups.get(parsed.stem);
        if (!prev) {
          stemGroups.set(parsed.stem, {
            count: 1,
            max: parsed.number,
            pad: parsed.pad,
          });
          return;
        }
        stemGroups.set(parsed.stem, {
          count: prev.count + 1,
          max: Math.max(prev.max, parsed.number),
          pad: Math.max(prev.pad, parsed.pad),
        });
      });

      if (stemGroups.size > 0) {
        const [stem, meta] = Array.from(stemGroups.entries()).sort((a, b) => {
          if (b[1].count !== a[1].count) return b[1].count - a[1].count;
          if (b[1].max !== a[1].max) return b[1].max - a[1].max;
          return a[0].localeCompare(b[0]);
        })[0];

        let next = meta.max + 1;
        let candidate = `${stem}${String(next).padStart(meta.pad, "0")}`;
        while (existingSet.has(candidate)) {
          next += 1;
          candidate = `${stem}${String(next).padStart(meta.pad, "0")}`;
        }
        return candidate;
      }

      const seed = existingCodes[0];
      let next = 1;
      let candidate = `${seed}-${String(next).padStart(2, "0")}`;
      while (existingSet.has(candidate)) {
        next += 1;
        candidate = `${seed}-${String(next).padStart(2, "0")}`;
      }
      return candidate;
    },
    [items, normalizeCategory, pickPrefix, splitCodeNumberSuffix],
  );

  const suggestCode = useCallback(
    (name: string, category: string, subCategory?: string) => {
      const categoryPatternCode = suggestFromCategoryPattern(
        category,
        subCategory,
      );
      if (categoryPatternCode) return categoryPatternCode;

      const base = buildCodeBase(name, category);
      if (!base) return "";
      const baseUpper = base.toUpperCase();
      const catNorm = normalizeCategory(
        canonicalizeConvectionCategory(category),
      );
      const subNorm = (subCategory || "").trim().toUpperCase();
      const existing = items
        .filter((it) => {
          const sameCategory =
            normalizeCategory(
              canonicalizeConvectionCategory(it.category, it.code, it.name),
            ) === catNorm;
          if (!sameCategory) return false;
          if (!subNorm) return true;
          return (it.subCategory ?? "").trim().toUpperCase() === subNorm;
        })
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
    [
      buildCodeBase,
      escapeRegExp,
      items,
      normalizeCategory,
      suggestFromCategoryPattern,
    ],
  );

  const suggestUnitByCategory = useCallback(
    (category: string) => {
      const normalizedCategory = canonicalizeConvectionCategory(category)
        .trim()
        .toLowerCase();

      if (!normalizedCategory) return unitOptions[0] ?? "KG";
      if (normalizedCategory === "sepatu") return "PCS";

      const unitCounts = new Map<string, number>();
      items.forEach((item) => {
        const itemCategory = canonicalizeConvectionCategory(
          item.category,
          item.code,
          item.name,
        )
          .trim()
          .toLowerCase();

        if (itemCategory !== normalizedCategory) return;

        const rawUnit = (item.unit ?? "").trim();
        if (!rawUnit) return;
        const unit = normalizeUnitLabel(rawUnit);
        if (!unit) return;
        unitCounts.set(unit, (unitCounts.get(unit) ?? 0) + 1);
      });

      if (unitCounts.size > 0) {
        return Array.from(unitCounts.entries()).sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          return a[0].localeCompare(b[0]);
        })[0][0];
      }

      return unitOptions[0] ?? "KG";
    },
    [items, unitOptions],
  );

  function openAddForm() {
    if (readOnly) return;
    setEditing(null);
    setManualCode(false);
    setFormError(null);
    setForm({
      code: "",
      name: "",
      category: "",
      subCategory: "",
      unit: "KG",
      metersPerKg: 0,
      stockBase: 0,
    });
    setShowForm(true);
  }

  function openEditForm(item: ConvectionItem) {
    if (readOnly) return;
    setEditing(item);
    setManualCode(true);
    setFormError(null);
    setForm({
      code: item.code,
      name: item.name ?? "",
      category: item.category ?? "",
      subCategory: item.subCategory ?? "",
      unit: normalizeUnitLabel(item.unit),
      metersPerKg: item.metersPerKg ?? 0,
      stockBase: item.stockBase,
    });
    setShowForm(true);
  }

  async function saveForm() {
    if (readOnly) return;
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
    if (!form.unit.trim()) {
      setFormError("Satuan wajib diisi.");
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

    if (
      !editing &&
      items.some((it) => it.code.toUpperCase() === normalizedCode)
    ) {
      setFormError(
        `Kode ${normalizedCode} sudah ada. Silakan edit barang yang sudah ada.`,
      );
      pushToast(
        "destructive",
        "Kode sudah dipakai",
        `Kode ${normalizedCode} sudah ada di daftar konveksi.`,
      );
      return;
    }

    setSaving(true);
    try {
      const normalizedUnit = normalizeUnitLabel(form.unit);
      const metersPerKgPayload =
        normalizedUnit === "PCS" || form.metersPerKg <= 0
          ? undefined
          : form.metersPerKg;

      const payload = {
        code: normalizedCode,
        name: normalizedName,
        category: form.category.trim(),
        subCategory: form.subCategory.trim() || undefined,
        unit: normalizedUnit,
        metersPerKg: metersPerKgPayload,
        stockBase: form.stockBase,
      };

      const targetUrl = editing
        ? `${CONVECTION_ITEMS_URL}/${encodeURIComponent(editing.code)}`
        : CONVECTION_ITEMS_URL;

      const savedItem = await httpJson<ConvectionItem>(targetUrl, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setItems((prev) => {
        const targetCode = editing?.code ?? payload.code;
        const existingIndex = prev.findIndex((it) => it.code === targetCode);
        const existing = existingIndex >= 0 ? prev[existingIndex] : undefined;
        const merged: ConvectionItem = {
          ...existing,
          code: savedItem.code ?? payload.code,
          name: savedItem.name ?? payload.name,
          category: savedItem.category ?? payload.category,
          subCategory: savedItem.subCategory ?? payload.subCategory ?? null,
          unit: normalizeUnitLabel(savedItem.unit ?? payload.unit),
          metersPerKg:
            savedItem.metersPerKg ??
            (typeof payload.metersPerKg === "number"
              ? payload.metersPerKg
              : null),
          stockBase:
            typeof savedItem.stockBase === "number"
              ? savedItem.stockBase
              : payload.stockBase,
          createdAt: savedItem.createdAt ?? existing?.createdAt,
          updatedAt: savedItem.updatedAt ?? new Date().toISOString(),
        };

        if (existingIndex === -1) {
          return [merged, ...prev];
        }

        const next = [...prev];
        next[existingIndex] = merged;
        return next;
      });

      if (editing) {
        setRecentlyEditedCode(savedItem.code ?? editing.code);
        pushToast(
          "default",
          "Barang konveksi diperbarui",
          `${payload.name} berhasil disimpan.`,
        );
      } else {
        pushToast(
          "default",
          "Barang konveksi ditambahkan",
          `${payload.name} masuk ke daftar barang konveksi.`,
        );
      }

      setShowForm(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menyimpan data.";
      setFormError(message);
      pushToast("destructive", "Gagal menyimpan", message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(code: string, name?: string | null) {
    if (readOnly) return;
    setDeleting(true);
    setError(null);
    try {
      await httpJson(`${CONVECTION_ITEMS_URL}/${encodeURIComponent(code)}`, {
        method: "DELETE",
      });
      setItems((prev) => prev.filter((it) => it.code !== code));
      pushToast(
        "default",
        "Barang konveksi dihapus",
        `${name ?? code} dihapus dari daftar barang konveksi.`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus data.";
      setError(message);
      pushToast("destructive", "Gagal menghapus", message);
    } finally {
      setDeleting(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await deleteItem(pendingDelete.code, pendingDelete.name);
    setPendingDelete(null);
  }

  const exportInventory = () => {
    if (filteredItems.length === 0) return;

    const header = [
      "Kode barang",
      "Nama barang",
      "Kategori",
      "Sub kategori",
      "Satuan",
      "Stok",
      "Stok setara meter",
      "Status",
      "Update terakhir",
    ];
    const rows = filteredItems.map((item) => {
      const canonicalCategory = canonicalizeConvectionCategory(
        item.category,
        item.code,
        item.name,
      );
      const hideMeters = canonicalCategory.toLowerCase() === "sepatu";

      return [
        item.code,
        item.name ?? "-",
        canonicalCategory || "-",
        item.subCategory ?? "-",
        toUnitDisplayLabel(item.unit),
        formatStockValue(item.stockBase, item.unit),
        hideMeters
          ? "-"
          : item.metersPerKg !== null
            ? (item.stockBase * item.metersPerKg).toFixed(2)
            : "-",
        getStockStatus(item.stockBase),
        formatDateCell(item.updatedAt ?? item.createdAt),
      ];
    });
    const data = [header, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    applySheetStyles(worksheet, data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Konveksi Inventory");
    XLSX.writeFile(workbook, "konveksi-inventory-export.xlsx", {
      bookType: "xlsx",
    });
  };

  const toInputDate = (date: Date) => {
    const adjusted = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000,
    );
    return adjusted.toISOString().slice(0, 10);
  };

  const applyQuickDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    setFromDate(toInputDate(start));
    setToDate(toInputDate(end));
    setPage(1);
  };

  const applyTodayRange = () => {
    const today = toInputDate(new Date());
    setFromDate(today);
    setToDate(today);
    setPage(1);
  };

  const columnCount = (hideMetersColumn ? 8 : 9) - (readOnly ? 1 : 0);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const endItem = Math.min(currentPage * perPage, totalItems);

  return (
    <div className="min-h-screen bg-white px-4 py-6 text-slate-900 md:px-6 md:py-8">
      <ToastRegion toasts={toasts} />
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
                variant="outline"
                className="border-slate-200 text-slate-700 hover:bg-slate-50"
                onClick={exportInventory}
                disabled={loading || filteredItems.length === 0}
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
                  Tambah Barang Konveksi
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Lihat dan kelola stok konveksi dengan cara yang sama seperti stok
            utama.
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </header>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="grid w-full gap-2 sm:gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                <Layers3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Stok PCS
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatSummaryByUnit(stockSummary.pcs, "PCS")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm min-w-40">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-orange-50 text-orange-600">
                <Layers3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Stok ONS
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatSummaryByUnit(stockSummary.ons, "ONS")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm min-w-40">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                <Layers3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Stok KG
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatSummaryByUnit(stockSummary.kg, "KG")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm min-w-40">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-cyan-50 text-cyan-600">
                <Layers3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Setara Meter
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatSummaryByUnit(stockSummary.meter, "METER")}
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_auto_auto]">
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
              className="h-11 border-slate-200 bg-white px-4 text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => {
                setSearch("");
                setFromDate("");
                setToDate("");
                setSelectedCategories([]);
                setStatusFilter("all");
              }}
            >
              Reset
            </Button>
          </div>
          <Input
            type="date"
            className="h-11 rounded-lg border-slate-200 bg-white shadow-sm"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="Tanggal mulai"
          />
          <Input
            type="date"
            className="h-11 rounded-lg border-slate-200 bg-white shadow-sm"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="Tanggal selesai"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Preset tanggal
          </span>
          <Button
            type="button"
            variant="outline"
            className="h-9 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={applyTodayRange}
          >
            Hari ini
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={() => applyQuickDateRange(7)}
          >
            7 hari
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={() => applyQuickDateRange(30)}
          >
            30 hari
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">No</TableHead>
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
                {!readOnly && (
                  <TableHead className="text-center">Aksi</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : pagedItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
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
                    <TableRow
                      key={item.code}
                      className={`text-sm transition-colors duration-700 ${
                        recentlyEditedCode === item.code ? "bg-sky-50/70" : ""
                      }`}
                    >
                      <TableCell className="text-slate-500">
                        {(currentPage - 1) * perPage + index + 1}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800">
                        {item.code}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        <div className="flex flex-col gap-1">
                          <span>{item.name ?? "-"}</span>
                          {recentlyEditedCode === item.code ? (
                            <Badge
                              variant="outline"
                              className="w-fit border-sky-200 bg-sky-100 text-[10px] font-semibold uppercase tracking-wide text-sky-700"
                            >
                              Baru diperbarui
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>
                            {canonicalizeConvectionCategory(
                              item.category,
                              item.code,
                              item.name,
                            ) || "-"}
                          </span>
                          {item.subCategory ? (
                            <span className="text-xs text-slate-500">
                              {item.subCategory}
                            </span>
                          ) : null}
                        </div>
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
                      {!readOnly && (
                        <TableCell className="text-center">
                          <ActionsMenu
                            onEdit={() => openEditForm(item)}
                            onDelete={() => setPendingDelete(item)}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-sm text-slate-600">
            Menampilkan {startItem} - {endItem} dari {totalItems} item
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
                        const auto = suggestCode(
                          value,
                          f.category,
                          f.subCategory,
                        );
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
                        const auto = suggestCode(f.name, value, f.subCategory);
                        if (auto) next.code = auto;
                      }
                      if (!editing) {
                        const autoUnit = suggestUnitByCategory(value);
                        next.unit = autoUnit;
                        if (autoUnit === "PCS" || autoUnit === "KG") {
                          next.metersPerKg = 0;
                        }
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
                {!editing ? (
                  <p className="text-xs text-slate-500">
                    Satuan otomatis mengikuti kategori dari data stok konveksi.
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Sub Kategori
                </label>
                <Input
                  value={form.subCategory}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((f) => {
                      const next = { ...f, subCategory: value };
                      if (!editing && !manualCode) {
                        const auto = suggestCode(f.name, f.category, value);
                        if (auto) next.code = auto;
                      }
                      return next;
                    });
                  }}
                  list="convection-subcategory-options"
                  placeholder="Contoh: Mayoret, Pasukan"
                  className="h-11"
                />
                <datalist id="convection-subcategory-options">
                  {subCategoryOptions.map((sub) => (
                    <option key={sub} value={sub} />
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
                    onChange={(e) => {
                      const nextUnit = normalizeUnitInput(e.target.value);
                      setForm((f) => ({
                        ...f,
                        unit: nextUnit,
                        metersPerKg:
                          nextUnit === "PCS" || (!editing && nextUnit === "KG")
                            ? 0
                            : f.metersPerKg,
                      }));
                    }}
                    list="convection-unit-options"
                    className="h-11"
                    disabled={unitAutoLocked}
                  />
                  <datalist id="convection-unit-options">
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit} />
                    ))}
                  </datalist>
                  {unitOptions.length > 0 ? (
                    <p className="text-[11px] text-slate-500">
                      Pilihan satuan mengikuti daftar barang konveksi.
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Satuan bisa diketik bebas.
                    </p>
                  )}
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
                    disabled={meterPerKgLocked}
                  />
                  {meterPerKgLocked ? (
                    <p className="text-[11px] text-slate-500">
                      {normalizedFormUnit === "PCS"
                        ? "Satuan PCS tidak memakai konversi meter/kg."
                        : "Saat tambah barang KG, isi stok saja agar tidak membingungkan."}
                    </p>
                  ) : null}
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

function ToastRegion({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-60 flex flex-col gap-2 sm:right-6 sm:top-6">
      {toasts.map((toast) => (
        <Alert
          key={toast.id}
          variant={toast.variant === "destructive" ? "destructive" : "default"}
          className={`pointer-events-auto shadow-lg ${
            toast.variant === "destructive"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
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

function formatDateCell(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID");
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
