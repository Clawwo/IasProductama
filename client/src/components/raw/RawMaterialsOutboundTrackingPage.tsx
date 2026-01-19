import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
  PackageOpen,
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
const OUTBOUND_URL = `${API_BASE}/api/raw-materials/outbound`;

type RawMaterial = {
  code: string;
  name?: string;
  category?: string;
  subCategory?: string;
  kind?: string;
  stock: number;
};

type OutboundLine = {
  id: string;
  materialCode: string;
  materialName?: string;
  category?: string;
  subCategory?: string;
  kind?: string;
  batchCode: string;
  qty: number;
  note?: string;
  status: "OUT" | "RECEIVED";
  receivedAt?: string | null;
  receivedBy?: string | null;
};

type OutboundRecord = {
  id: string;
  code: string;
  artisan: string;
  date: string;
  note?: string | null;
  status: "OUT" | "RECEIVED";
  receivedAt?: string | null;
  lines: OutboundLine[];
};

type LineForm = {
  id: string;
  code: string;
  name: string;
  category?: string;
  subCategory?: string;
  kind?: string;
  batchCode: string;
  qty: number;
  note?: string;
};

type ToastVariant = "default" | "destructive";

export function RawMaterialsOutboundTrackingPage() {
  const [artisan, setArtisan] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [lineForm, setLineForm] = useState<LineForm>({
    id: "",
    code: "",
    name: "",
    category: "",
    subCategory: "",
    kind: "",
    batchCode: "",
    qty: 1,
    note: "",
  });
  const [lines, setLines] = useState<LineForm[]>([]);
  const [rawItems, setRawItems] = useState<RawMaterial[]>([]);
  const [outbounds, setOutbounds] = useState<OutboundRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [notice, setNotice] = useState<{ type: ToastVariant; message: string } | null>(null);

  const resetLineForm = () => {
    setLineForm({
      id: "",
      code: "",
      name: "",
      category: "",
      subCategory: "",
      kind: "",
      batchCode: "",
      qty: 1,
      note: "",
    });
  };

  const showNotice = (type: ToastVariant, message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 3200);
  };

  const loadRawItems = useCallback(async () => {
    try {
      const res = await fetch(RAW_URL);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as RawMaterial[];
      setRawItems(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memuat bahan baku";
      showNotice("destructive", message);
    }
  }, []);

  const loadOutbounds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${OUTBOUND_URL}?limit=50`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as OutboundRecord[];
      setOutbounds(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memuat tracking";
      showNotice("destructive", message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRawItems();
    loadOutbounds();
  }, [loadOutbounds, loadRawItems]);

  const rawLookup = useMemo(() => {
    const map = new Map<string, RawMaterial>();
    rawItems.forEach((item) => map.set(item.code, item));
    return map;
  }, [rawItems]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return rawItems;
    return rawItems.filter((item) =>
      `${item.code} ${item.name ?? ""}`.toLowerCase().includes(term)
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

  const addLine = () => {
    if (!lineForm.code || !lineForm.batchCode || !Number.isFinite(lineForm.qty)) {
      setFormError("Kode, batch, dan qty wajib diisi.");
      return;
    }
    if (lineForm.qty <= 0) {
      setFormError("Qty minimal 1.");
      return;
    }
    setFormError(null);
    setLines((prev) => [
      ...prev,
      {
        ...lineForm,
        id: crypto.randomUUID(),
      },
    ]);
    resetLineForm();
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((line) => line.id !== id));
  };

  const submitOutbound = async () => {
    if (!artisan.trim()) {
      setFormError("Nama pengrajin wajib diisi.");
      return;
    }
    if (lines.length === 0) {
      setFormError("Tambahkan minimal satu bahan baku.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        artisan: artisan.trim(),
        date,
        note: note.trim() || undefined,
        lines: lines.map((line) => ({
          code: line.code,
          name: line.name || undefined,
          category: line.category || undefined,
          subCategory: line.subCategory || undefined,
          kind: line.kind || undefined,
          batchCode: line.batchCode,
          qty: line.qty,
          note: line.note || undefined,
        })),
      };
      const res = await fetch(OUTBOUND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      showNotice("default", "Bahan baku keluar berhasil disimpan.");
      setLines([]);
      setNote("");
      setArtisan("");
      resetLineForm();
      await loadOutbounds();
      await loadRawItems();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan.";
      showNotice("destructive", message);
    } finally {
      setSaving(false);
    }
  };

  const handleReceive = async (lineId: string) => {
    if (!receiverName.trim()) {
      showNotice("destructive", "Isi nama admin penerima dulu.");
      return;
    }
    try {
      const res = await fetch(`${OUTBOUND_URL}/lines/${lineId}/receive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receivedBy: receiverName.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      showNotice("default", "Status diterima diperbarui.");
      await loadOutbounds();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memperbarui.";
      showNotice("destructive", message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tracking Bahan Baku Keluar</h1>
          <p className="text-sm text-muted-foreground">
            Catat bahan baku keluar ke pengrajin dan tandai saat sudah diterima.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={loadOutbounds}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      {notice ? (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            notice.type === "destructive"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <PackageOpen className="size-4" />
          Form Bahan Baku Keluar
        </div>
        <Separator className="my-3" />
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Nama pengrajin
            </label>
            <Input
              value={artisan}
              onChange={(e) => setArtisan(e.target.value)}
              placeholder="Nama pengrajin"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Tanggal keluar
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

        <div className="grid gap-3 md:grid-cols-6">
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
                          Math.min(idx + 1, Math.max(filteredItems.length - 1, 0))
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
            <label className="text-xs font-medium text-muted-foreground">
              Batch
            </label>
            <Input
              value={lineForm.batchCode}
              onChange={(e) =>
                setLineForm((prev) => ({ ...prev, batchCode: e.target.value }))
              }
              placeholder="Batch"
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
                  qty: Number(e.target.value),
                }))
              }
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Catatan
            </label>
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
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Belum ada baris bahan baku.
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.code}</TableCell>
                    <TableCell>{line.name || "-"}</TableCell>
                    <TableCell>{line.batchCode}</TableCell>
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
          <Button onClick={submitOutbound} disabled={saving} className="gap-2">
            <CheckCircle2 className="size-4" />
            {saving ? "Menyimpan..." : "Simpan keluar"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Daftar Tracking</h2>
            <p className="text-sm text-muted-foreground">
              Status OUT berubah menjadi RECEIVED saat sudah sampai ke pengrajin.
            </p>
          </div>
          <div className="w-full md:w-72">
            <label className="text-xs font-medium text-muted-foreground">
              Nama admin penerima
            </label>
            <Input
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="Nama admin"
            />
          </div>
        </div>

        <Separator className="my-3" />

        {loading ? (
          <div className="text-sm text-muted-foreground">Memuat tracking...</div>
        ) : outbounds.length === 0 ? (
          <div className="text-sm text-muted-foreground">Belum ada transaksi.</div>
        ) : (
          <div className="space-y-4">
            {outbounds.map((record) => (
              <div key={record.id} className="rounded-lg border p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold">{record.code}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(record.date).toLocaleDateString("id-ID")} • {record.artisan}
                    </div>
                    {record.note ? (
                      <div className="text-xs text-muted-foreground">{record.note}</div>
                    ) : null}
                  </div>
                  <Badge
                    className={cn(
                      "w-fit",
                      record.status === "RECEIVED"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    )}
                  >
                    {record.status}
                  </Badge>
                </div>
                <div className="mt-3 rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kode</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {record.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>{line.materialCode}</TableCell>
                          <TableCell>{line.materialName || "-"}</TableCell>
                          <TableCell>{line.batchCode}</TableCell>
                          <TableCell className="text-right">{line.qty}</TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "rounded-full",
                                line.status === "RECEIVED"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              )}
                            >
                              {line.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{line.receivedBy ?? "-"}</TableCell>
                          <TableCell className="text-right">
                            {line.status === "OUT" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReceive(line.id)}
                              >
                                Tandai diterima
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {line.receivedAt
                                  ? new Date(line.receivedAt).toLocaleDateString("id-ID")
                                  : "-"}
                              </span>
                            )}
                          </TableCell>
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
