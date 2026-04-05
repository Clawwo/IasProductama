import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { getAccessToken } from "@/lib/auth";
import { httpJson, toUserMessage } from "@/lib/http";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

type Env = { VITE_API_BASE?: string };
const API_BASE = ((import.meta as { env?: Env }).env?.VITE_API_BASE ?? "")
  .trim()
  .replace(/\/$/, "");
const RAW_URL = `${API_BASE}/api/raw-materials`;
const INBOUND_URL = `${API_BASE}/api/raw-materials/inbound`;
const DRAFTS_URL = `${API_BASE}/api/drafts`;

type RawMaterial = {
  code: string;
  name?: string;
  category?: string;
  subCategory?: string;
  kind?: string;
  stock: number;
};

type InboundLine = {
  id: string;
  materialCode: string;
  materialName?: string;
  category?: string;
  subCategory?: string;
  kind?: string;
  qty: number;
  note?: string;
};

type InboundRecord = {
  id: string;
  code: string;
  vendor: string;
  date: string;
  note?: string | null;
  lines: InboundLine[];
};

type LineForm = {
  id: string;
  code: string;
  name: string;
  category?: string;
  subCategory?: string;
  kind?: string;
  qty: number;
  note?: string;
};

type LineFormState = Omit<LineForm, "qty"> & { qty: string };

type ToastVariant = "default" | "destructive";

export function RawMaterialsInboundPage() {
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [lineForm, setLineForm] = useState<LineFormState>({
    id: "",
    code: "",
    name: "",
    category: "",
    subCategory: "",
    kind: "",
    qty: "1",
    note: "",
  });
  const [lines, setLines] = useState<LineForm[]>([]);
  const [rawItems, setRawItems] = useState<RawMaterial[]>([]);
  const [inbounds, setInbounds] = useState<InboundRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftStatus, setDraftStatus] = useState("Belum disimpan");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [notice, setNotice] = useState<{
    type: ToastVariant;
    message: string;
  } | null>(null);

  const resetLineForm = () => {
    setLineForm({
      id: "",
      code: "",
      name: "",
      category: "",
      subCategory: "",
      kind: "",
      qty: "1",
      note: "",
    });
  };

  const showNotice = (type: ToastVariant, message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 3200);
  };

  const loadRawItems = useCallback(async () => {
    try {
      const data = await httpJson<RawMaterial[]>(RAW_URL);
      setRawItems(data);
    } catch (err: unknown) {
      showNotice("destructive", toUserMessage(err, "Gagal memuat bahan baku"));
    }
  }, []);

  const loadInbounds = useCallback(async () => {
    setLoading(true);
    try {
      const data = await httpJson<InboundRecord[]>(`${INBOUND_URL}?limit=50`);
      setInbounds(data);
    } catch (err: unknown) {
      showNotice("destructive", toUserMessage(err, "Gagal memuat data masuk"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRawItems();
    loadInbounds();
  }, [loadInbounds, loadRawItems]);

  useEffect(() => {
    const stored = sessionStorage.getItem("draft:pending-load");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as {
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
          note?: unknown;
          category?: unknown;
          subCategory?: unknown;
          kind?: unknown;
        }>;
      };

      const draftKind =
        typeof payload.draftKind === "string" ? payload.draftKind : undefined;
      if (draftKind !== "INBOUND_RAW") return;

      setVendor(typeof payload.vendor === "string" ? payload.vendor : "");
      setDate(
        typeof payload.date === "string" && payload.date
          ? payload.date.slice(0, 10)
          : date,
      );
      setNote(typeof payload.note === "string" ? payload.note : "");

      const incomingLines = Array.isArray(payload.lines)
        ? payload.lines.map((line) => ({
            id: crypto.randomUUID(),
            code: typeof line.code === "string" ? line.code : "",
            name: typeof line.name === "string" ? line.name : "",
            qty: typeof line.qty === "number" ? line.qty : Number(line.qty) || 0,
            note: typeof line.note === "string" ? line.note : undefined,
            category:
              typeof line.category === "string" ? line.category : undefined,
            subCategory:
              typeof line.subCategory === "string"
                ? line.subCategory
                : undefined,
            kind: typeof line.kind === "string" ? line.kind : undefined,
          }))
        : [];

      if (incomingLines.length) {
        setLines(incomingLines.filter((l) => l.code));
      }

      setDraftStatus("Draft dimuat");
      setDraftId(typeof parsed.id === "string" ? parsed.id : null);
      showNotice("default", "Draft bahan baku masuk dimuat.");
    } catch {
      showNotice("destructive", "Draft tidak bisa dibaca.");
    } finally {
      sessionStorage.removeItem("draft:pending-load");
    }
  }, [date]);

  const rawLookup = useMemo(() => {
    const map = new Map<string, RawMaterial>();
    rawItems.forEach((item) => map.set(item.code, item));
    return map;
  }, [rawItems]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return rawItems;
    return rawItems.filter((item) =>
      `${item.code} ${item.name ?? ""}`.toLowerCase().includes(term),
    );
  }, [rawItems, searchTerm]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [searchTerm]);

  const handleLineSelect = (code: string) => {
    const trimmed = code.trim();
    const matched = rawLookup.get(trimmed);
    setLineForm((prev) => ({
      ...prev,
      code: trimmed,
      name: matched?.name ?? prev.name,
      category: matched?.category ?? prev.category,
      subCategory: matched?.subCategory ?? prev.subCategory,
      kind: matched?.kind ?? prev.kind,
    }));
  };

  const validateLine = (line: LineFormState | LineForm) => {
    const code = line.code.trim();
    const qty = Number(line.qty);
    if (!code) return "Pilih kode bahan baku.";
    if (!rawLookup.has(code)) return "Kode tidak dikenal. Pilih dari daftar.";
    if (!Number.isFinite(qty) || qty <= 0) return "Qty minimal 1.";
    return null;
  };

  const addLine = () => {
    const err = validateLine(lineForm);
    if (err) {
      setFormError(err);
      return;
    }
    const code = lineForm.code.trim();
    const qty = Number(lineForm.qty);
    const matched = rawLookup.get(code);
    setFormError(null);
    setLines((prev) => {
      const existingIndex = prev.findIndex((line) => line.code === code);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          qty: next[existingIndex].qty + qty,
          name: matched?.name ?? next[existingIndex].name,
          note: lineForm.note || next[existingIndex].note,
        };
        showNotice("default", "Qty digabung ke baris yang sudah ada.");
        return next;
      }
      return [
        ...prev,
        {
          ...lineForm,
          code,
          qty,
          name: matched?.name ?? lineForm.name,
          category: matched?.category ?? lineForm.category,
          subCategory: matched?.subCategory ?? lineForm.subCategory,
          kind: matched?.kind ?? lineForm.kind,
          id: crypto.randomUUID(),
        },
      ];
    });
    resetLineForm();
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((line) => line.id !== id));
  };

  const handleSaveDraft = async () => {
    const payload = {
      draftKind: "INBOUND_RAW",
      vendor: vendor.trim(),
      date,
      note: note.trim() || undefined,
      lines: lines.map((line) => ({
        code: line.code,
        name: line.name || undefined,
        category: line.category || undefined,
        subCategory: line.subCategory || undefined,
        kind: line.kind || undefined,
        qty: line.qty,
        note: line.note || undefined,
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
      showNotice("default", "Draft bahan baku masuk disimpan.");
    } catch (err: unknown) {
      showNotice("destructive", toUserMessage(err, "Gagal menyimpan draft."));
    } finally {
      setDraftSaving(false);
    }
  };

  const submitInbound = async () => {
    if (!vendor.trim()) {
      setFormError("Nama supplier wajib diisi.");
      return;
    }
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDatePattern.test(date)) {
      setFormError("Tanggal masuk tidak valid.");
      return;
    }
    if (lines.length === 0) {
      setFormError("Tambahkan minimal satu bahan baku.");
      return;
    }
    for (const line of lines) {
      const err = validateLine(line);
      if (err) {
        setFormError(err);
        return;
      }
    }

    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        vendor: vendor.trim(),
        date,
        note: note.trim() || undefined,
        lines: lines.map((line) => ({
          code: line.code,
          name: line.name || undefined,
          category: line.category || undefined,
          subCategory: line.subCategory || undefined,
          kind: line.kind || undefined,
          qty: line.qty,
          note: line.note || undefined,
        })),
      };

      const token = getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      await httpJson(INBOUND_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      showNotice("default", "Bahan baku masuk berhasil disimpan.");
      setLines([]);
      setNote("");
      setVendor("");
      resetLineForm();
      await loadInbounds();
      await loadRawItems();
    } catch (err: unknown) {
      showNotice("destructive", toUserMessage(err, "Gagal menyimpan."));
    } finally {
      setSaving(false);
    }
  };

  const totalQty = useMemo(
    () => lines.reduce((sum, line) => sum + (Number.isFinite(line.qty) ? line.qty : 0), 0),
    [lines],
  );

  const inboundSummaries = useMemo(() => {
    return inbounds.map((rec) => {
      const qty = (rec.lines ?? []).reduce((sum, line) => sum + (line.qty ?? 0), 0);
      return { ...rec, _totalQty: qty, _totalItems: rec.lines?.length ?? 0 };
    });
  }, [inbounds]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tracking Bahan Baku Masuk</h1>
          <p className="text-sm text-muted-foreground">
            Catat bahan baku masuk dari supplier dan stok otomatis bertambah.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3">
            Draft: {draftStatus}
          </Badge>
          <Button
            variant="outline"
            className="gap-2 border-dashed"
            onClick={handleSaveDraft}
            disabled={draftSaving || saving}
          >
            {draftSaving ? "Menyimpan..." : "Simpan draft"}
          </Button>
          <Button variant="outline" className="gap-2" onClick={loadInbounds}
            >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>
      </div>

      {notice ? (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            notice.type === "destructive"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <PackagePlus className="size-4" />
          Form Bahan Baku Masuk
        </div>
        <Separator className="my-3" />

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Supplier
            </label>
            <Input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Nama supplier"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Tanggal masuk
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Catatan
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan opsional"
            />
          </div>
        </div>

        <Separator className="my-4" />

        <div className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">
              Kode bahan baku
            </label>
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate text-left">
                    {lineForm.code
                      ? `${lineForm.code} — ${lineForm.name || ""}`
                      : "Pilih / cari bahan baku"}
                  </span>
                  <Search className="size-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-96 p-0">
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
                          Math.min(idx + 1, Math.max(filteredItems.length - 1, 0)),
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
                        const target = filteredItems[highlightIndex];
                        if (target) {
                          handleLineSelect(target.code);
                          setDropdownOpen(false);
                        }
                      }
                    }}
                    className="h-9"
                  />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Daftar bahan baku</DropdownMenuLabel>
                <div className="max-h-64 overflow-y-auto">
                  {filteredItems.map((item, idx) => (
                    <DropdownMenuItem
                      key={item.code}
                      className={highlightIndex === idx ? "bg-slate-100" : undefined}
                      onSelect={() => {
                        handleLineSelect(item.code);
                        setDropdownOpen(false);
                      }}
                    >
                      <div className="flex w-full flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 truncate max-w-56">
                            {item.code}
                          </span>
                          <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                            Stok: {item.stock ?? 0}
                          </span>
                        </div>
                        <span className="text-xs text-slate-600 truncate max-w-72">
                          {item.name ?? "-"}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  {filteredItems.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-slate-500">
                      Bahan baku tidak ditemukan.
                    </div>
                  ) : null}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nama</label>
            <Input
              value={lineForm.name}
              onChange={(e) =>
                setLineForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Nama"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Qty</label>
            <Input
              type="number"
              min={1}
              value={lineForm.qty}
              onChange={(e) =>
                setLineForm((prev) => ({
                  ...prev,
                  qty: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Catatan</label>
            <Input
              value={lineForm.note}
              onChange={(e) =>
                setLineForm((prev) => ({ ...prev, note: e.target.value }))
              }
              placeholder="Opsional"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button type="button" onClick={addLine} className="gap-2">
            <Plus className="size-4" />
            Tambah baris
          </Button>
          <Badge variant="secondary" className="rounded-full">
            Total qty: {totalQty}
          </Badge>
          {formError ? (
            <span className="text-sm text-rose-600">{formError}</span>
          ) : null}
        </div>

        <div className="mt-4 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Belum ada baris bahan baku.
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.code}</TableCell>
                    <TableCell>{line.name || "-"}</TableCell>
                    <TableCell className="text-right">{line.qty}</TableCell>
                    <TableCell>{line.note || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(line.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={submitInbound} disabled={saving} className="gap-2">
            <CheckCircle2 className="size-4" />
            {saving ? "Menyimpan..." : "Simpan masuk"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">Daftar Masuk Terakhir</h2>
          <p className="text-sm text-muted-foreground">
            Menampilkan 50 transaksi bahan baku masuk terbaru.
          </p>
        </div>

        <Separator className="my-3" />

        {loading ? (
          <div className="text-sm text-muted-foreground">Memuat data...</div>
        ) : inboundSummaries.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Belum ada transaksi bahan baku masuk.
          </div>
        ) : (
          <div className="space-y-4">
            {inboundSummaries.map((record) => (
              <div key={record.id} className="rounded-lg border p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold">{record.code}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(record.date).toLocaleDateString("id-ID")} •{" "}
                      {record.vendor}
                    </div>
                    {record.note ? (
                      <div className="text-xs text-muted-foreground">
                        {record.note}
                      </div>
                    ) : null}
                  </div>
                  <Badge className="w-fit bg-emerald-50 text-emerald-700">
                    +{record._totalQty} ({record._totalItems} item)
                  </Badge>
                </div>
                <div className="mt-3 rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kode</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {record.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>{line.materialCode}</TableCell>
                          <TableCell>{line.materialName || "-"}</TableCell>
                          <TableCell className="text-right">{line.qty}</TableCell>
                          <TableCell>{line.note || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
