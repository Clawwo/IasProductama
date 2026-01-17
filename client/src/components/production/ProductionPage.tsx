import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calendar, Factory, Plus, Search, StickyNote, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

type Env = { VITE_API_BASE?: string };
const API_BASE = ((import.meta as { env?: Env }).env?.VITE_API_BASE ?? "").trim();
const PRODUCTION_URL = `${API_BASE ? API_BASE.replace(/\/$/, "") : ""}/api/production`;
const PRODUCTS_URL = `${API_BASE ? API_BASE.replace(/\/$/, "") : ""}/api/products`;
const RAW_URL = `${API_BASE ? API_BASE.replace(/\/$/, "") : ""}/api/raw-materials`;
const BOM_URL = `${API_BASE ? API_BASE.replace(/\/$/, "") : ""}/api/bom`;

type ToastVariant = "default" | "destructive";
type Toast = { id: string; variant: ToastVariant; title: string; message?: string };

type LineItem = {
  id: string;
  code: string;
  name: string;
  qty: number;
  note?: string;
  sourceType?: "ITEM" | "BAHAN_BAKU";
};

type RemoteItem = {
  code: string;
  name?: string;
  category?: string;
  subCategory?: string;
  kind?: string;
  stock: number;
};

type BomLine = {
  id?: string;
  sourceType?: "ITEM" | "BAHAN_BAKU";
  code?: string | null;
  name?: string | null;
  qty: number;
};
type BomEntry = { id: string; productCode: string; productName?: string | null; category?: string | null; lines: BomLine[] };

function normalize(text: string | undefined) {
  return (text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function ProductionPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const [finishedLine, setFinishedLine] = useState<LineItem>({
    id: "seed-finished",
    code: "",
    name: "",
    qty: 1,
    note: "",
  });
  const [rawLine, setRawLine] = useState<LineItem>({
    id: "seed-raw",
    code: "",
    name: "",
    qty: 1,
    note: "",
    sourceType: "BAHAN_BAKU",
  });
  const [finishedLines, setFinishedLines] = useState<LineItem[]>([]);
  const [rawLines, setRawLines] = useState<LineItem[]>([]);

  const [finishedSearch, setFinishedSearch] = useState("");
  const [rawSearch, setRawSearch] = useState("");
  const [finishedHighlight, setFinishedHighlight] = useState(0);
  const [rawHighlight, setRawHighlight] = useState(0);
  const [finishedDropdownOpen, setFinishedDropdownOpen] = useState(false);
  const [rawDropdownOpen, setRawDropdownOpen] = useState(false);

  const [products, setProducts] = useState<RemoteItem[]>([]);
  const [rawItems, setRawItems] = useState<RemoteItem[]>([]);
  const [bomCache, setBomCache] = useState<Record<string, BomEntry>>({});

  const pushToast = useCallback((variant: ToastVariant, title: string, message?: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, variant, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [prodRes, rawRes] = await Promise.all([fetch(PRODUCTS_URL), fetch(RAW_URL)]);
      if (!prodRes.ok) throw new Error(await prodRes.text());
      if (!rawRes.ok) throw new Error(await rawRes.text());
      const itemsData = (await prodRes.json()) as RemoteItem[];
      const rawData = (await rawRes.json()) as RemoteItem[];
      setProducts(itemsData);
      setRawItems(rawData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Tidak bisa memuat data.";
      pushToast("destructive", "Gagal memuat", msg);
    }
  }, [pushToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rawNameIndex = useMemo(() => {
    const map = new Map<string, RemoteItem>();
    rawItems.forEach((it) => {
      map.set(normalize(it.name ?? it.code), it);
    });
    return map;
  }, [rawItems]);

  const mergedFinishedItems = useMemo(() => products, [products]);

  const finishedFiltered = useMemo(() => {
    const term = finishedSearch.toLowerCase();
    const list = mergedFinishedItems.filter((it) => {
      if (!term) return true;
      return it.code.toLowerCase().includes(term) || (it.name ?? "").toLowerCase().includes(term);
    });
    return list.slice(0, 50);
  }, [mergedFinishedItems, finishedSearch]);


  const rawFiltered = useMemo(() => {
    const term = rawSearch.toLowerCase();
    const list = rawItems.filter((it) => {
      if (!term) return true;
      return it.code.toLowerCase().includes(term) || (it.name ?? "").toLowerCase().includes(term);
    });
    return list.slice(0, 50);
  }, [rawItems, rawSearch]);

  const findBomForFinished = useCallback(
    async (item: LineItem) => {
      const key = normalize(item.code || item.name);
      if (key && bomCache[key]) return bomCache[key];

      const params = new URLSearchParams();
      if (item.code) params.append("code", item.code);
      else if (item.name) params.append("name", item.name);
      else return null;

      try {
        const res = await fetch(`${BOM_URL}?${params.toString()}`);
        if (!res.ok) {
          if (res.status === 404) return null;
          throw new Error(await res.text());
        }
        const data = (await res.json()) as BomEntry;
        if (key) {
          setBomCache((prev) => ({ ...prev, [key]: data }));
        }
        return data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Gagal memuat BOM";
        pushToast("destructive", "Gagal muat BOM", msg);
        return null;
      }
    },
    [bomCache, pushToast],
  );

  const applyBomToRaw = useCallback(
    (bomKey: string, entry: BomEntry, finishedQty: number) => {
      const lines = entry.lines;
      const missing: string[] = [];
      setRawLines((prev) => {
        const next = [...prev];
        lines.forEach((line) => {
          const componentName = line.name ?? line.code ?? "";
          const normComp = normalize(componentName);
          const meta = rawNameIndex.get(normComp);
          const code = line.code ?? meta?.code ?? componentName;
          const name = line.name ?? meta?.name ?? componentName;
          const qtyToAdd = (line.qty || 0) * finishedQty;
          const existing = next.find((r) => r.code === code);
          if (existing) {
            existing.qty += qtyToAdd;
          } else {
            next.push({
              id: crypto.randomUUID(),
              code,
              name,
              qty: qtyToAdd,
              sourceType: line.sourceType ?? "BAHAN_BAKU",
            });
          }
          if (!meta) missing.push(componentName || "(tanpa nama)");
        });
        return next;
      });

      if (missing.length) {
        pushToast(
          "destructive",
          `BOM ${bomKey}: ${missing.length} bahan tidak dikenali`,
          `Cek: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ", ..." : ""}`,
        );
      } else {
        pushToast(
          "default",
          `BOM ${bomKey} terisi otomatis`,
          `Ditambahkan ${lines.length} baris bahan baku.`,
        );
      }
    },
    [rawNameIndex, pushToast],
  );

  async function addFinished() {
    if (!finishedLine.code || !finishedLine.name) {
      pushToast("destructive", "Pilih barang jadi", "Isi kode dan nama dulu.");
      return;
    }
    if (finishedLine.qty <= 0) {
      pushToast("destructive", "Qty salah", "Qty harus lebih dari 0.");
      return;
    }
    const newNote = (finishedLine.note ?? "").trim();
    const bomEntry = await findBomForFinished(finishedLine);

    setFinishedLines((prev) => {
      const existing = prev.find((l) => l.code === finishedLine.code);
      if (existing) {
        return prev.map((l) =>
          l.code === finishedLine.code
            ? {
                ...l,
                qty: l.qty + finishedLine.qty,
                note: newNote ? (l.note ? `${l.note} | ${newNote}` : newNote) : l.note,
              }
            : l,
        );
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          code: finishedLine.code,
          name: finishedLine.name,
          qty: finishedLine.qty,
          note: newNote || undefined,
        },
      ];
    });

    if (bomEntry) {
      const bomKey = bomEntry.productName ?? bomEntry.productCode ?? finishedLine.name ?? finishedLine.code;
      applyBomToRaw(bomKey || "BOM", bomEntry, finishedLine.qty);
    } else {
      pushToast("destructive", "BOM tidak ditemukan", `Tidak ada BOM untuk ${finishedLine.name}. Isi manual.`);
    }

    setFinishedLine({ id: "seed-finished", code: "", name: "", qty: 1, note: "" });
    setFinishedSearch("");
  }

  function addRaw() {
    if (!rawLine.code || !rawLine.name) {
      pushToast("destructive", "Pilih bahan baku", "Isi kode dan nama dulu.");
      return;
    }
    if (rawLine.qty <= 0) {
      pushToast("destructive", "Qty salah", "Qty harus lebih dari 0.");
      return;
    }
    const newNote = (rawLine.note ?? "").trim();
    setRawLines((prev) => {
      const existing = prev.find((l) => l.code === rawLine.code);
      if (existing) {
        return prev.map((l) =>
          l.code === rawLine.code
            ? {
                ...l,
                qty: l.qty + rawLine.qty,
                note: newNote ? (l.note ? `${l.note} | ${newNote}` : newNote) : l.note,
              }
            : l,
        );
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          code: rawLine.code,
          name: rawLine.name,
          qty: rawLine.qty,
          note: newNote || undefined,
        },
      ];
    });
    setRawLine({ id: "seed-raw", code: "", name: "", qty: 1, note: "" });
    setRawSearch("");
  }

  function removeFinished(id: string) {
    setFinishedLines((prev) => prev.filter((l) => l.id !== id));
  }

  function removeRaw(id: string) {
    setRawLines((prev) => prev.filter((l) => l.id !== id));
  }

  async function handleSubmit() {
    if (!date) {
      pushToast("destructive", "Tanggal wajib", "Isi tanggal produksi.");
      return;
    }
    if (finishedLines.length === 0) {
      pushToast("destructive", "Barang jadi kosong", "Tambahkan minimal satu barang jadi.");
      return;
    }
    if (rawLines.length === 0) {
      pushToast("destructive", "Bahan baku kosong", "Tambahkan minimal satu bahan baku.");
      return;
    }

    const payload = {
      date,
      note: note.trim() || undefined,
      rawLines: rawLines.map((l) => {
        const meta = rawItems.find((it) => it.code === l.code);
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
      finishedLines: finishedLines.map((l) => {
        const meta = mergedFinishedItems.find((it) => it.code === l.code);
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
      const res = await fetch(PRODUCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Gagal menyimpan produksi.");
      }
      const data = (await res.json()) as { code?: string };
      const message = data?.code ? `Berhasil disimpan. Kode: ${data.code}` : "Berhasil disimpan.";
      setSubmitStatus("success");
      setSubmitMessage(message);
      pushToast("default", "Produksi dicatat", message);
      setFinishedLines([]);
      setRawLines([]);
      setFinishedLine({ id: "seed-finished", code: "", name: "", qty: 1, note: "" });
      setRawLine({ id: "seed-raw", code: "", name: "", qty: 1, note: "" });
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan.";
      setSubmitStatus("error");
      setSubmitMessage(msg);
      pushToast("destructive", "Gagal", msg);
    }
  }

  const finishedTotalQty = useMemo(() => finishedLines.reduce((sum, l) => sum + l.qty, 0), [finishedLines]);
  const rawTotalQty = useMemo(() => rawLines.reduce((sum, l) => sum + l.qty, 0), [rawLines]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <ToastRegion toasts={toasts} />
      <div className="space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-slate-900 text-white shadow-sm">
              <Factory className="size-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Produksi</p>
              <h1 className="text-3xl font-semibold leading-tight">Catat Produksi</h1>
              <p className="text-sm text-slate-600">
                Kurangi stok bahan baku dan tambah stok barang jadi dalam satu langkah.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Barang jadi" value={`${finishedLines.length} baris`} sub={`Total qty ${finishedTotalQty}`} />
            <SummaryCard label="Bahan baku" value={`${rawLines.length} baris`} sub={`Total qty ${rawTotalQty}`} />
            <SummaryCard label="Tanggal" value={date || "-"} sub="Tanggal produksi" />
            <SummaryCard label="Status" value={submitStatus === "loading" ? "Menyimpan..." : "Draft"} />
          </div>
        </header>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <LabeledInput label="Tanggal produksi" icon={<Calendar className="size-4" />}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </LabeledInput>
            <LabeledInput label="Catatan" icon={<StickyNote className="size-4" />}>
              <Input placeholder="Opsional" value={note} onChange={(e) => setNote(e.target.value)} />
            </LabeledInput>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="grid size-10 place-items-center rounded-full bg-slate-900 text-white shadow-sm">
              <PackageIcon />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Barang jadi (hasil)</p>
              <p className="text-sm text-slate-600">Tambahkan barang jadi yang bertambah stoknya.</p>
            </div>
          </div>

          <LineComposer
            dropdownOpen={finishedDropdownOpen}
            setDropdownOpen={setFinishedDropdownOpen}
            search={finishedSearch}
            setSearch={setFinishedSearch}
            highlightIndex={finishedHighlight}
            setHighlightIndex={setFinishedHighlight}
            visibleItems={finishedFiltered}
            lineItem={finishedLine}
            setLineItem={setFinishedLine}
            onAdd={addFinished}
            placeholder="Cari barang jadi"
          />

          <LineTable
            rows={finishedLines}
            onRemove={removeFinished}
            emptyText="Belum ada barang jadi. Tambahkan di atas."
            qtyLabel="Qty (pcs)"
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="grid size-10 place-items-center rounded-full bg-amber-600 text-white shadow-sm">
              <Wrench className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Bahan baku dipakai</p>
              <p className="text-sm text-slate-600">Tambahkan bahan baku yang berkurang stoknya.</p>
            </div>
          </div>

          <LineComposer
            dropdownOpen={rawDropdownOpen}
            setDropdownOpen={setRawDropdownOpen}
            search={rawSearch}
            setSearch={setRawSearch}
            highlightIndex={rawHighlight}
            setHighlightIndex={setRawHighlight}
            visibleItems={rawFiltered}
            lineItem={rawLine}
            setLineItem={setRawLine}
            onAdd={addRaw}
            placeholder="Cari bahan baku"
          />

          <LineTable rows={rawLines} onRemove={removeRaw} emptyText="Belum ada bahan baku." qtyLabel="Qty (pcs)" />
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-sm text-slate-600">
            {submitStatus === "success" ? <span className="text-emerald-700">{submitMessage}</span> : null}
            {submitStatus === "error" ? <span className="text-red-700">{submitMessage}</span> : null}
          </div>
          <Button onClick={handleSubmit} disabled={submitStatus === "loading"} className="w-full sm:w-auto">
            <Factory className="mr-2 size-4" />
            {submitStatus === "loading" ? "Menyimpan..." : "Catat produksi"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LineComposer({
  dropdownOpen,
  setDropdownOpen,
  search,
  setSearch,
  highlightIndex,
  setHighlightIndex,
  visibleItems,
  lineItem,
  setLineItem,
  onAdd,
  placeholder,
}: {
  dropdownOpen: boolean;
  setDropdownOpen: (open: boolean) => void;
  search: string;
  setSearch: (v: string) => void;
  highlightIndex: number;
  setHighlightIndex: React.Dispatch<React.SetStateAction<number>>;
  visibleItems: RemoteItem[];
  lineItem: LineItem;
  setLineItem: React.Dispatch<React.SetStateAction<LineItem>>;
  onAdd: () => void;
  placeholder: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_2fr_1fr_auto] md:items-end">
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="justify-between">
            <span className="truncate text-left">
              {lineItem.name ? `${lineItem.code} - ${lineItem.name}` : placeholder}
            </span>
            <div className="flex items-center gap-2">
              <Search className="size-4 text-slate-500" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-96 p-0">
          <div className="p-2">
            <Input
              autoFocus
              placeholder="Ketik nama atau kode"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightIndex((idx) => Math.min(idx + 1, Math.max(visibleItems.length - 1, 0)));
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
                    setLineItem((l) => ({ ...l, code: target.code, name: target.name ?? target.code }));
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
                className={highlightIndex === idx ? "bg-slate-100" : undefined}
                onSelect={() => {
                  setLineItem((l) => ({ ...l, code: it.code, name: it.name ?? it.code }));
                  setDropdownOpen(false);
                }}
              >
                <div className="flex w-full flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900" title={it.code}>
                      {it.code}
                    </span>
                    <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                      Stok: {it.stock ?? 0}
                    </span>
                  </div>
                  <span className="text-xs text-slate-600" title={it.name}>
                    {it.name ?? "(Tanpa nama)"}
                  </span>
                  {it.category ? (
                    <span className="text-[11px] text-slate-500">Kategori: {it.category}</span>
                  ) : null}
                </div>
              </DropdownMenuItem>
            ))}
            {visibleItems.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500">Tidak ditemukan.</div>
            ) : null}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Input
        placeholder="Catatan baris (opsional)"
        value={lineItem.note}
        onChange={(e) => setLineItem((l) => ({ ...l, note: e.target.value }))}
      />
      <Input
        type="number"
        min={1}
        value={lineItem.qty}
        onChange={(e) => setLineItem((l) => ({ ...l, qty: Number(e.target.value) }))}
      />
      <Button onClick={onAdd}>
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

function LineTable({
  rows,
  onRemove,
  emptyText,
  qtyLabel,
}: {
  rows: LineItem[];
  onRemove: (id: string) => void;
  emptyText: string;
  qtyLabel: string;
}) {
  return (
    <Table>
      <TableHeader className="bg-slate-50">
        <TableRow>
          <TableHead className="w-12">No</TableHead>
          <TableHead>Kode</TableHead>
          <TableHead>Nama</TableHead>
          <TableHead className="w-32">{qtyLabel}</TableHead>
          <TableHead>Catatan</TableHead>
          <TableHead className="w-16" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((line, idx) => (
          <TableRow key={line.id}>
            <TableCell className="text-slate-500">{idx + 1}</TableCell>
            <TableCell className="font-semibold text-slate-900">{line.code}</TableCell>
            <TableCell className="text-slate-800">{line.name}</TableCell>
            <TableCell className="font-semibold">{line.qty}</TableCell>
            <TableCell className="text-slate-600">{line.note || "-"}</TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-red-600"
                onClick={() => onRemove(line.id)}
              >
                X
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="py-6 text-center text-sm text-slate-500">
              {emptyText}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
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
          {toast.message ? <AlertDescription>{toast.message}</AlertDescription> : null}
        </Alert>
      ))}
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub ? <p className="text-sm text-slate-600">{sub}</p> : null}
    </div>
  );
}

function PackageIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="size-5"
    >
      <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" />
      <path d="M3 7.5V16l9 4.5M21 7.5V16l-9 4.5M12 12V20.5" />
    </svg>
  );
}
