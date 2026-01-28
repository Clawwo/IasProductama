import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Save,
  CheckCircle,
  Trash2,
  Calendar,
  StickyNote,
  Search,
  UserRound,
} from "lucide-react";
import { inventoryItemsWithKind } from "./items";

type Env = { VITE_API_BASE?: string };
const API_BASE = (
  (import.meta as { env?: Env }).env?.VITE_API_BASE ?? ""
).trim();
const OUTBOUND_URL = `${
  API_BASE ? API_BASE.replace(/\/$/, "") : ""
}/api/outbound`;
const ITEMS_URL = `${API_BASE ? API_BASE.replace(/\/$/, "") : ""}/api/items`;
const RAW_URL = `${API_BASE ? API_BASE.replace(/\/$/, "") : ""}/api/raw-materials`;
const PRODUCTS_URL = `${API_BASE ? API_BASE.replace(/\/$/, "") : ""}/api/products`;
const DRAFTS_URL = `${API_BASE ? API_BASE.replace(/\/$/, "") : ""}/api/drafts`;

function getInchSize(text: string): string | null {
  const match = /([0-9]+(?:\.[0-9]+)?)\s*''/.exec(text);
  return match ? match[1] : null;
}

function getCmSize(text: string): string | null {
  const match = /([0-9]+(?:\.[0-9]+)?)\s*cm/i.exec(text);
  return match ? match[1] : null;
}

function getRingHoles(text: string): string | null {
  const match = /lubang\s*([0-9]+)/i.exec(text);
  return match ? match[1] : null;
}

function getRingColor(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("hitam")) return "Hitam";
  if (lower.includes("chrome") || lower.includes("chr")) return "Chrome";
  return null;
}

function getBodyKindLabel(kind?: string): string | null {
  switch (kind) {
    case "BODY-SNARE":
      return "Snare";
    case "BODY-TOM":
      return "Tom";
    case "BODY-BASS":
      return "Bass";
    case "BODY-GENERAL":
      return "General";
    default:
      return null;
  }
}

function sortNumericStrings(values: string[]) {
  return values.sort((a, b) => parseFloat(a) - parseFloat(b));
}

type LineItem = {
  id: string;
  code: string;
  name: string;
  qty: number;
  note?: string;
};

type RemoteItem = {
  code: string;
  name?: string;
  category?: string;
  subCategory?: string;
  kind?: string;
  stock: number;
};

type ToastVariant = "default" | "destructive";
type Toast = {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
};

export function OutboundPage() {
  const [orderer, setOrderer] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [lineItem, setLineItem] = useState({
    code: "",
    name: "",
    qty: 1,
    note: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [ringSub, setRingSub] = useState<"all" | "SNARE" | "TOM">("all");
  const [ringSize, setRingSize] = useState("all");
  const [ringHole, setRingHole] = useState("all");
  const [ringColor, setRingColor] = useState("all");
  const [bodyKind, setBodyKind] = useState("all");
  const [bodySize, setBodySize] = useState("all");
  const [headSize, setHeadSize] = useState("all");
  const [lugSize, setLugSize] = useState("all");
  const [pipeLength, setPipeLength] = useState("all");
  const [packSize, setPackSize] = useState("all");
  const [rawType, setRawType] = useState("all");
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
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [remoteItems, setRemoteItems] = useState<RemoteItem[]>([]);
  const [rawItems, setRawItems] = useState<RemoteItem[]>([]);
  const [productItems, setProductItems] = useState<RemoteItem[]>([]);

  function pushToast(variant: ToastVariant, title: string, message?: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, variant, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }

  const fetchItems = useCallback(async () => {
    try {
      const [itemsRes, rawRes, prodRes] = await Promise.all([
        fetch(ITEMS_URL),
        fetch(RAW_URL),
        fetch(PRODUCTS_URL),
      ]);

      if (!itemsRes.ok) throw new Error(await itemsRes.text());
      if (!rawRes.ok) throw new Error(await rawRes.text());
      if (!prodRes.ok) throw new Error(await prodRes.text());

      const itemsData = (await itemsRes.json()) as RemoteItem[];
      const rawData = (await rawRes.json()) as RemoteItem[];
      const prodData = (await prodRes.json()) as RemoteItem[];

      setRemoteItems(itemsData);
      setRawItems(rawData);
      setProductItems(prodData);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Tidak bisa mengambil data stok.";
      pushToast("destructive", "Gagal memuat stok", message);
    }
  }, []);

  useEffect(() => {
    fetchItems();
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
      if (parsed.type !== "OUTBOUND" || !parsed.payload) return;
      const payload = parsed.payload as {
        draftKind?: unknown;
        orderer?: unknown;
        date?: unknown;
        note?: unknown;
        lines?: Array<{
          code?: unknown;
          name?: unknown;
          qty?: unknown;
          note?: unknown;
        }>;
      };
      const draftKind =
        typeof payload.draftKind === "string" ? payload.draftKind : undefined;
      if (draftKind && draftKind !== "OUTBOUND_GOODS") return;
      setOrderer(typeof payload.orderer === "string" ? payload.orderer : "");
      setDate(
        typeof payload.date === "string" && payload.date
          ? payload.date.slice(0, 10)
          : date
      );
      setNote(typeof payload.note === "string" ? payload.note : "");
      const incomingLines = Array.isArray(payload.lines)
        ? payload.lines.map((l) => ({
            id: crypto.randomUUID(),
            code: typeof l.code === "string" ? l.code : "",
            name: typeof l.name === "string" ? l.name : "",
            qty: typeof l.qty === "number" ? l.qty : Number(l.qty) || 1,
            note: typeof l.note === "string" ? l.note : undefined,
          }))
        : [];
      if (incomingLines.length > 0) {
        setLines(incomingLines.filter((l) => l.code));
      }
      setFormError("");
      setDraftStatus("Draft dimuat");
      setDraftId(typeof parsed.id === "string" ? parsed.id : null);
      pushToast(
        "default",
        "Draft dimuat",
        "Data draft barang keluar telah dimuat ke formulir."
      );
    } catch (err) {
      console.error("Gagal memuat draft keluar", err);
      pushToast(
        "destructive",
        "Gagal memuat draft",
        "Draft tidak bisa dibaca."
      );
    } finally {
      sessionStorage.removeItem("draft:pending-load");
    }
  }, [date]);

  const mergedItems = useMemo(() => {
    const allRemote = [...remoteItems, ...rawItems, ...productItems];
    const remoteMap = new Map(allRemote.map((it) => [it.code, it]));
    const baseCodes = new Set(inventoryItemsWithKind.map((b) => b.code));

    const baseMerged = inventoryItemsWithKind.map((it) => {
      const api = remoteMap.get(it.code);
      return {
        ...it,
        ...api,
        stock: api?.stock ?? it.stock ?? 0,
      };
    });

    const extras = allRemote
      .filter((it) => !baseCodes.has(it.code))
      .map((it) => ({
        code: it.code,
        name: it.name ?? it.code,
        category: it.category ?? "Bahan Baku",
        subCategory: it.subCategory,
        kind: it.kind ?? it.subCategory,
        stock: it.stock ?? 0,
      }));

    return [...baseMerged, ...extras];
  }, [remoteItems, rawItems, productItems]);

  const selectedItem = useMemo(
    () => mergedItems.find((it) => it.code === lineItem.code),
    [mergedItems, lineItem.code]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    mergedItems.forEach((it) => set.add(it.category));
    return ["all", ...Array.from(set).sort()];
  }, [mergedItems]);

  const rawTypeOptions = useMemo(() => {
    const set = new Set<string>();
    mergedItems.forEach((it) => {
      if (it.category === "Bahan Baku" && it.subCategory) {
        set.add(it.subCategory);
      }
    });
    return ["all", ...Array.from(set).sort()];
  }, [mergedItems]);

  const stockBadgeClass = useMemo(() => {
    if (!selectedItem) return "border-slate-200 bg-slate-50 text-slate-600";
    const stock = selectedItem.stock ?? 0;
    if (stock <= 0) return "border-red-200 bg-red-50 text-red-700";
    if (stock < 5) return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }, [selectedItem]);

  const ringSubOptions = useMemo(() => {
    const set = new Set<string>();
    mergedItems.forEach((it) => {
      if (it.category === "Ring" && it.subCategory) set.add(it.subCategory);
    });
    return ["all", ...Array.from(set)] as Array<"all" | "SNARE" | "TOM">;
  }, [mergedItems]);

  const ringSizeOptions = useMemo(() => {
    const set = new Set<string>();
    mergedItems.forEach((it) => {
      if (it.category === "Ring") {
        const size = getInchSize(it.name);
        if (size) set.add(size);
      }
    });
    return ["all", ...sortNumericStrings(Array.from(set))];
  }, [mergedItems]);

  const ringHoleOptions = useMemo(() => {
    const set = new Set<string>();
    mergedItems.forEach((it) => {
      if (it.category === "Ring") {
        const hole = getRingHoles(it.name);
        if (hole) set.add(hole);
      }
    });
    return ["all", ...Array.from(set).sort()];
  }, [mergedItems]);

  const ringColorOptions = useMemo(() => {
    const set = new Set<string>();
    mergedItems.forEach((it) => {
      if (it.category === "Ring") {
        const color = getRingColor(it.name);
        if (color) set.add(color);
      }
    });
    return ["all", ...Array.from(set)];
  }, [mergedItems]);

  const bodyKindOptions = useMemo(() => {
    const set = new Set<string>();
    mergedItems.forEach((it) => {
      if (it.category === "Body") {
        const label = getBodyKindLabel(it.kind);
        if (label) set.add(label);
      }
    });
    return ["all", ...Array.from(set)];
  }, [mergedItems]);

  const bodySizeOptions = useMemo(() => {
    const set = new Set<string>();
    mergedItems.forEach((it) => {
      if (it.category === "Body") {
        const size = getInchSize(it.name);
        if (size) set.add(size);
      }
    });
    return ["all", ...sortNumericStrings(Array.from(set))];
  }, [mergedItems]);

  const headSizeOptions = useMemo(() => {
    const set = new Set<string>();
    mergedItems.forEach((it) => {
      if (it.category === "Head") {
        const size = getInchSize(it.name);
        if (size) set.add(size);
      }
    });
    return ["all", ...sortNumericStrings(Array.from(set))];
  }, [mergedItems]);

  const lugSizeOptions = useMemo(() => {
    const set = new Set<string>();
    mergedItems.forEach((it) => {
      if (it.category === "Lug") {
        const size = getCmSize(it.name);
        if (size) set.add(size);
      }
    });
    return ["all", ...sortNumericStrings(Array.from(set))];
  }, [mergedItems]);

  const pipeLengthOptions = useMemo(() => {
    const set = new Set<string>();
    mergedItems.forEach((it) => {
      if (it.category === "Pipe") {
        const len = getCmSize(it.name);
        if (len) set.add(len);
      }
    });
    return ["all", ...sortNumericStrings(Array.from(set))];
  }, [mergedItems]);

  const packSizeOptions = useMemo(() => {
    const set = new Set<string>();
    mergedItems.forEach((it) => {
      if (it.category === "Pack") {
        const size = getInchSize(it.name);
        if (size) set.add(size);
      }
    });
    return ["all", ...sortNumericStrings(Array.from(set))];
  }, [mergedItems]);

  const totals = useMemo(() => {
    const totalItem = lines.length;
    const totalQty = lines.reduce((sum, l) => sum + l.qty, 0);
    return { totalItem, totalQty };
  }, [lines]);

  useEffect(() => {
    setRingSub("all");
    setRingSize("all");
    setRingHole("all");
    setRingColor("all");
    setBodyKind("all");
    setBodySize("all");
    setHeadSize("all");
    setLugSize("all");
    setPipeLength("all");
    setPackSize("all");
    setRawType("all");
  }, [selectedCategory]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [
    searchTerm,
    selectedCategory,
    ringSub,
    ringSize,
    ringHole,
    ringColor,
    bodyKind,
    bodySize,
    headSize,
    lugSize,
    pipeLength,
    packSize,
    rawType,
  ]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return mergedItems.filter((it) => {
      if (selectedCategory !== "all" && it.category !== selectedCategory)
        return false;

      if (selectedCategory === "Ring") {
        if (ringSub !== "all" && it.subCategory !== ringSub) return false;
        const size = getInchSize(it.name);
        if (ringSize !== "all" && ringSize !== size) return false;
        const holes = getRingHoles(it.name);
        if (ringHole !== "all" && ringHole !== holes) return false;
        const color = getRingColor(it.name);
        if (ringColor !== "all" && ringColor !== color) return false;
      }

      if (selectedCategory === "Body") {
        const kindLabel = getBodyKindLabel(it.kind);
        if (bodyKind !== "all" && bodyKind !== kindLabel) return false;
        const size = getInchSize(it.name);
        if (bodySize !== "all" && bodySize !== size) return false;
      }

      if (selectedCategory === "Head") {
        const size = getInchSize(it.name);
        if (headSize !== "all" && headSize !== size) return false;
      }

      if (selectedCategory === "Lug") {
        const size = getCmSize(it.name);
        if (lugSize !== "all" && lugSize !== size) return false;
      }

      if (selectedCategory === "Pipe") {
        const len = getCmSize(it.name);
        if (pipeLength !== "all" && pipeLength !== len) return false;
      }

      if (selectedCategory === "Pack") {
        const size = getInchSize(it.name);
        if (packSize !== "all" && packSize !== size) return false;
      }

      if (selectedCategory === "Bahan Baku") {
        if (rawType !== "all" && it.subCategory !== rawType) return false;
      }

      if (!term) return true;
      return (
        it.name.toLowerCase().includes(term) ||
        it.code.toLowerCase().includes(term)
      );
    });
  }, [
    selectedCategory,
    ringSub,
    ringSize,
    ringHole,
    ringColor,
    bodyKind,
    bodySize,
    headSize,
    lugSize,
    pipeLength,
    packSize,
    rawType,
    searchTerm,
    mergedItems,
  ]);

  const filterControls: React.ReactNode[] = useMemo(() => {
    if (selectedCategory === "Ring") {
      return [
        <FilterDropdown
          key="ring-sub"
          label="Model"
          value={ringSub}
          options={ringSubOptions}
          onSelect={setRingSub}
        />,
        <FilterDropdown
          key="ring-size"
          label="Ukuran"
          value={ringSize}
          options={ringSizeOptions}
          onSelect={setRingSize}
        />,
        <FilterDropdown
          key="ring-hole"
          label="Lubang"
          value={ringHole}
          options={ringHoleOptions}
          onSelect={setRingHole}
        />,
        <FilterDropdown
          key="ring-color"
          label="Warna"
          value={ringColor}
          options={ringColorOptions}
          onSelect={setRingColor}
        />,
      ];
    }

    if (selectedCategory === "Body") {
      return [
        <FilterDropdown
          key="body-kind"
          label="Jenis"
          value={bodyKind}
          options={bodyKindOptions}
          onSelect={setBodyKind}
        />,
        <FilterDropdown
          key="body-size"
          label="Ukuran"
          value={bodySize}
          options={bodySizeOptions}
          onSelect={setBodySize}
        />,
      ];
    }

    if (selectedCategory === "Head") {
      return [
        <FilterDropdown
          key="head-size"
          label="Ukuran"
          value={headSize}
          options={headSizeOptions}
          onSelect={setHeadSize}
        />,
      ];
    }

    if (selectedCategory === "Lug") {
      return [
        <FilterDropdown
          key="lug-size"
          label="Panjang"
          value={lugSize}
          options={lugSizeOptions}
          onSelect={setLugSize}
        />,
      ];
    }

    if (selectedCategory === "Pipe") {
      return [
        <FilterDropdown
          key="pipe-length"
          label="Panjang"
          value={pipeLength}
          options={pipeLengthOptions}
          onSelect={setPipeLength}
        />,
      ];
    }

    if (selectedCategory === "Pack") {
      return [
        <FilterDropdown
          key="pack-size"
          label="Ukuran"
          value={packSize}
          options={packSizeOptions}
          onSelect={setPackSize}
        />,
      ];
    }

    if (selectedCategory === "Bahan Baku") {
      return [
        <FilterDropdown
          key="raw-type"
          label="Jenis"
          value={rawType}
          options={rawTypeOptions}
          onSelect={setRawType}
        />,
      ];
    }

    return [];
  }, [
    selectedCategory,
    ringSub,
    ringSize,
    ringHole,
    ringColor,
    ringSubOptions,
    ringSizeOptions,
    ringHoleOptions,
    ringColorOptions,
    bodyKind,
    bodySize,
    headSize,
    lugSize,
    pipeLength,
    packSize,
    rawType,
    bodyKindOptions,
    bodySizeOptions,
    headSizeOptions,
    lugSizeOptions,
    pipeLengthOptions,
    packSizeOptions,
    rawTypeOptions,
  ]);

  const gridTemplateColumns = useMemo(() => {
    const cols = [
      "1.1fr",
      ...filterControls.map(() => "1fr"),
      "2fr",
      "1.4fr",
      "0.6fr",
      "auto",
    ];
    return cols.join(" ");
  }, [filterControls]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, 50),
    [filteredItems]
  );

  function addLine() {
    if (!lineItem.code || !lineItem.name) {
      setFormError("Pilih barang terlebih dahulu.");
      return;
    }
    if (lineItem.qty <= 0) {
      setFormError("Qty harus lebih dari 0.");
      return;
    }
    const newNote = lineItem.note.trim();
    setLines((prev) => {
      const existing = prev.find((l) => l.code === lineItem.code);
      if (existing) {
        return prev.map((l) => {
          if (l.code !== lineItem.code) return l;
          const combinedNote = newNote
            ? l.note
              ? `${l.note} | ${newNote}`
              : newNote
            : l.note;
          return { ...l, qty: l.qty + lineItem.qty, note: combinedNote };
        });
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          code: lineItem.code,
          name: lineItem.name,
          qty: lineItem.qty,
          note: newNote || undefined,
        },
      ];
    });
    setLineItem({ code: "", name: "", qty: 1, note: "" });
    setSearchTerm("");
    setFormError("");
    pushToast(
      "default",
      "Baris ditambahkan",
      `${lineItem.code} - ${lineItem.name}`
    );
  }

  function removeLine(id: string) {
    const target = lines.find((l) => l.id === id);
    setLines((prev) => prev.filter((l) => l.id !== id));
    if (target) {
      pushToast("default", "Baris dihapus", `${target.code} - ${target.name}`);
    }
  }

  async function handleSaveDraft() {
    const payload = {
      draftKind: "OUTBOUND_GOODS",
      orderer: orderer.trim(),
      date,
      note: note.trim() || undefined,
      lines: lines.map((l) => {
        const meta = mergedItems.find((it) => it.code === l.code);
        return {
          code: l.code,
          name: l.name,
          category: meta?.category,
          subCategory: meta?.subCategory,
          kind: meta?.kind,
          qty: l.qty,
          note: l.note,
        };
      }),
    };

    try {
      setDraftSaving(true);
      const isUpdate = Boolean(draftId);
      const targetUrl = isUpdate ? `${DRAFTS_URL}/${draftId}` : DRAFTS_URL;
      const method = isUpdate ? "PUT" : "POST";
      const res = await fetch(targetUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "OUTBOUND", payload }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Gagal menyimpan draft");
      }
      const data = (await res.json()) as { id?: string };
      if (data?.id) setDraftId(data.id);
      setDraftStatus("Draft tersimpan");
      pushToast(
        "default",
        "Draft tersimpan",
        "Draft barang keluar berhasil disimpan."
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Gagal menyimpan draft.";
      pushToast("destructive", "Gagal simpan draft", message);
    } finally {
      setDraftSaving(false);
    }
  }

  async function handleComplete() {
    if (!orderer.trim()) {
      setFormError("Isi pemesan terlebih dahulu.");
      return;
    }
    if (!date) {
      setFormError("Tanggal tidak boleh kosong.");
      return;
    }
    if (lines.length === 0) {
      setFormError("Tambah minimal 1 baris barang.");
      return;
    }

    const payload = {
      orderer: orderer.trim(),
      date,
      note: note.trim() || undefined,
      lines: lines.map((l) => {
        const meta = mergedItems.find((it) => it.code === l.code);
        return {
          code: l.code,
          name: l.name,
          category: meta?.category,
          subCategory: meta?.subCategory,
          kind: meta?.kind,
          qty: l.qty,
          note: l.note,
        };
      }),
    };

    try {
      setSubmitStatus("loading");
      setSubmitMessage("");
      setFormError("");
      const res = await fetch(OUTBOUND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Gagal menyimpan");
      }
      const data = (await res.json()) as { code?: string };
      const codeMessage = data?.code ? `Kode: ${data.code}` : undefined;
      setSubmitStatus("success");
      setSubmitMessage(
        codeMessage ? `Berhasil disimpan. ${codeMessage}` : "Berhasil disimpan."
      );
      pushToast(
        "default",
        "Barang keluar disimpan",
        codeMessage
          ? `Data pengeluaran dicatat. ${codeMessage}`
          : "Data pengeluaran berhasil dicatat."
      );
      fetchItems();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan.";
      setSubmitStatus("error");
      setSubmitMessage(message);
      pushToast("destructive", "Gagal menyimpan", message);
    }
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6 text-slate-900 md:px-6 md:py-8">
      <ToastRegion toasts={toasts} />
      <div className="space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                Gudang
              </p>
              <h1 className="text-3xl font-semibold text-slate-900 leading-tight">
                Barang Keluar
              </h1>
              <p className="text-sm text-slate-600">
                Catat pengeluaran stok untuk pengiriman, peminjaman, atau
                permintaan lainnya.
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full px-3">
                Draft
              </Badge>
              <Button
                variant="outline"
                className="border-dashed"
                disabled={submitStatus === "loading" || draftSaving}
                onClick={handleSaveDraft}
              >
                <Save className="mr-2 size-4" />
                {draftSaving ? "Menyimpan..." : "Simpan draft"}
              </Button>
              <AlertDialog
                open={confirmSubmitOpen}
                onOpenChange={setConfirmSubmitOpen}
              >
                <AlertDialogTrigger asChild>
                  <Button disabled={submitStatus === "loading"}>
                    <CheckCircle className="mr-2 size-4" /> Tandai selesai
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogPortal>
                  <AlertDialogOverlay />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Konfirmasi simpan</AlertDialogTitle>
                      <AlertDialogDescription>
                        Simpan pencatatan barang keluar ini?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          setConfirmSubmitOpen(false);
                          handleComplete();
                        }}
                      >
                        Ya, simpan
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialogPortal>
              </AlertDialog>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Status Draft"
              value={draftStatus}
              sub="Simpan draft tanpa mengurangi stok"
            />
            <SummaryCard
              label="Total item"
              value={String(totals.totalItem)}
              sub="Baris keluar"
            />
            <SummaryCard
              label="Total qty (pcs)"
              value={String(totals.totalQty)}
              sub="Semua baris"
            />
            <SummaryCard
              label="Tanggal"
              value={date || "-"}
              sub="Tanggal keluar"
            />
          </div>
        </header>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <LabeledInput
              label="Tanggal keluar"
              icon={<Calendar className="size-4" />}
            >
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </LabeledInput>
            <LabeledInput
              label="Pemesan"
              icon={<UserRound className="size-4" />}
            >
              <Input
                placeholder="Nama pemesan"
                value={orderer}
                onChange={(e) => setOrderer(e.target.value)}
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
                Tambahkan setiap barang yang keluar beserta jumlahnya.
              </p>
            </div>
          </div>

          <div
            className="grid grid-cols-1 gap-3 md:items-end md:grid-cols-(--cols)"
            style={{ ["--cols" as string]: gridTemplateColumns }}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="justify-between">
                  <span className="truncate text-left">
                    {selectedCategory === "all" ? "Kategori" : selectedCategory}
                  </span>
                  <Search className="size-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Pilih kategori</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {categories.map((cat) => (
                  <DropdownMenuItem
                    key={cat}
                    onSelect={() => {
                      setSelectedCategory(cat);
                    }}
                  >
                    <span className="truncate" title={cat}>
                      {cat}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {filterControls.map((control) => control)}

            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="justify-between">
                  <span className="truncate text-left">
                    {lineItem.name
                      ? `${lineItem.code} ΓÇö ${lineItem.name}`
                      : "Pilih / cari barang"}
                  </span>
                  <div className="flex items-center gap-2">
                    {lineItem.name ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-xs",
                          stockBadgeClass
                        )}
                      >
                        Stok: {selectedItem?.stock ?? 0}
                      </span>
                    ) : null}
                    <Search className="size-4 text-slate-500" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-90 p-0">
                <div className="p-2">
                  <Input
                    autoFocus
                    placeholder="Ketik nama atau kode"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHighlightIndex((idx) =>
                          Math.min(
                            idx + 1,
                            Math.max(visibleItems.length - 1, 0)
                          )
                        );
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHighlightIndex((idx) => Math.max(idx - 1, 0));
                        return;
                      }
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const target = visibleItems[highlightIndex];
                        if (target) {
                          setLineItem((l) => ({
                            ...l,
                            code: target.code,
                            name: target.name,
                          }));
                          setDropdownOpen(false);
                        }
                      }
                    }}
                    className="h-9"
                  />
                </div>
                <DropdownMenuSeparator />
                <div className="max-h-64 overflow-y-auto">
                  {visibleItems.map((it, idx) => (
                    <DropdownMenuItem
                      key={it.code}
                      className={
                        highlightIndex === idx ? "bg-slate-100" : undefined
                      }
                      onSelect={() => {
                        setLineItem((l) => ({
                          ...l,
                          code: it.code,
                          name: it.name,
                        }));
                        setDropdownOpen(false);
                      }}
                    >
                      <div className="flex flex-col w-full gap-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="font-semibold text-slate-900 truncate max-w-60"
                            title={it.code}
                          >
                            {it.code}
                          </span>
                          <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                            Stok: {it.stock ?? 0}
                          </span>
                        </div>
                        <span
                          className="text-xs text-slate-600 truncate max-w-70"
                          title={it.name}
                        >
                          {it.name}
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
            <Input
              placeholder="Catatan baris (opsional)"
              value={lineItem.note}
              onChange={(e) =>
                setLineItem((l) => ({ ...l, note: e.target.value }))
              }
            />
            <Input
              type="number"
              min={1}
              value={lineItem.qty}
              onChange={(e) =>
                setLineItem((l) => ({ ...l, qty: Number(e.target.value) }))
              }
            />
            <Button onClick={addLine}>
              <Plus className="size-4" />
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
                <TableHead className="w-32">Qty (pcs)</TableHead>
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
                  <TableCell className="font-semibold">{line.qty}</TableCell>
                  <TableCell className="text-slate-600">
                    {line.note || "-"}
                  </TableCell>
                  <TableCell>
                    <AlertDialog
                      open={confirmRemoveId === line.id}
                      onOpenChange={(open) =>
                        setConfirmRemoveId(open ? line.id : null)
                      }
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus baris ini?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {line.code} ΓÇö {line.name}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              removeLine(line.id);
                              setConfirmRemoveId(null);
                            }}
                          >
                            Hapus
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-sm text-slate-500"
                  >
                    Belum ada baris. Tambahkan barang keluar di atas.
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
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
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
    <label className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-2">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: T;
  options: T[];
  onSelect: (v: T) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="justify-between">
          <span className="truncate text-left">
            {value === "all" ? `${label}: semua` : `${label}: ${value}`}
          </span>
          <Search className="size-4 text-slate-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((opt) => (
          <DropdownMenuItem key={opt} onSelect={() => onSelect(opt)}>
            {opt === "all" ? "Semua" : opt}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
