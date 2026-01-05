import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Env = { VITE_API_BASE?: string };
const API_BASE = ((import.meta as { env?: Env }).env?.VITE_API_BASE ?? "").trim();
const DRAFTS_URL = `${API_BASE ? API_BASE.replace(/\/$/, "") : ""}/api/drafts`;

type DraftRecord = {
  id: string;
  type: "INBOUND" | "OUTBOUND";
  payload: unknown;
  createdAt: string;
  updatedAt: string;
};

type DraftMeta = {
  counterpart: string;
  date: string;
  totalItem: number;
  totalQty: number;
  note: string;
};

type Filter = "ALL" | "INBOUND" | "OUTBOUND";

function parseDraftMeta(draft: DraftRecord): DraftMeta {
  const payload = (draft.payload ?? {}) as Record<string, unknown>;
  const rawLines = Array.isArray((payload as { [key: string]: unknown }).lines)
    ? ((payload as { [key: string]: unknown }).lines as Array<{ qty?: unknown; note?: unknown; code?: unknown }>)
    : [];

  const totalQty = rawLines.reduce((sum, line) => {
    const qtyValue = line?.qty;
    const qty = typeof qtyValue === "number" ? qtyValue : Number(qtyValue);
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);

  const totalItem = rawLines.length;
  const dateValue =
    typeof (payload as { date?: unknown }).date === "string"
      ? ((payload as { date?: unknown }).date as string)
      : "";
  const date = dateValue ? dateValue.slice(0, 10) : "–";
  const note =
    typeof (payload as { note?: unknown }).note === "string"
      ? ((payload as { note?: unknown }).note as string)
      : "";
  const counterpartKey = draft.type === "INBOUND" ? "vendor" : "orderer";
  const counterpartRaw = (payload as { [key: string]: unknown })[counterpartKey];
  const counterpart =
    typeof counterpartRaw === "string" && counterpartRaw.trim()
      ? counterpartRaw
      : "-";

  return { counterpart, date, totalItem, totalQty, note };
}

export function DraftsPage() {
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(DRAFTS_URL);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Gagal memuat draft");
      }
      const data = (await res.json()) as DraftRecord[];
      setDrafts(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memuat draft.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const filteredDrafts = useMemo(() => {
    if (filter === "ALL") return drafts;
    return drafts.filter((draft) => draft.type === filter);
  }, [drafts, filter]);

  const deleteDraft = useCallback(async (id: string) => {
    try {
      setBusyId(id);
      const res = await fetch(`${DRAFTS_URL}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Gagal menghapus draft");
      }
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal menghapus draft.";
      setError(message);
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }, []);

  const handleUseDraft = useCallback((draft: DraftRecord) => {
    sessionStorage.setItem(
      "draft:pending-load",
      JSON.stringify({ id: draft.id, type: draft.type, payload: draft.payload })
    );
    if (draft.type === "INBOUND") {
      window.location.hash = "#masuk";
    } else {
      window.location.hash = "#keluar";
    }
  }, []);

  return (
    <div className="min-h-screen bg-white px-4 py-6 text-slate-900 md:px-6 md:py-8">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Gudang</p>
          <h1 className="text-3xl font-semibold text-slate-900 leading-tight">Draft</h1>
          <p className="text-sm text-slate-600">
            Simpan dan lanjutkan pencatatan barang masuk/keluar tanpa mengubah stok.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {(["ALL", "INBOUND", "OUTBOUND"] as Filter[]).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? "default" : "outline"}
              className={cn("gap-2", filter === key && "shadow-sm")}
              onClick={() => setFilter(key)}
            >
              {key === "ALL" && <ClipboardList className="size-4" />}
              {key === "INBOUND" && <ArrowDownLeft className="size-4" />}
              {key === "OUTBOUND" && <ArrowUpRight className="size-4" />}
              {key === "ALL" ? "Semua" : key === "INBOUND" ? "Barang Masuk" : "Barang Keluar"}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={fetchDrafts} disabled={loading}>
            <RefreshCw className="mr-2 size-4" /> Muat ulang
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total draft"
          value={String(filteredDrafts.length)}
          sub={filter === "ALL" ? "Semua tipe" : filter === "INBOUND" ? "Draft masuk" : "Draft keluar"}
        />
        <SummaryCard
          label="Terbaru"
          value={
            filteredDrafts[0]
              ? new Date(filteredDrafts[0].updatedAt).toLocaleString("id-ID")
              : "-"
          }
          sub={filteredDrafts[0] ? "Terakhir diubah" : "Belum ada draft"}
        />
        <SummaryCard
          label="Stok aman"
          value="Draft tidak memotong stok"
          sub="Diposting saat tandai selesai"
        />
        <SummaryCard
          label="Catatan"
          value="Simpan sementara"
          sub="Lanjutkan kapan saja"
        />
      </div>

      <Separator className="my-6" />

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b px-4 py-3 text-sm text-slate-600">
          <CalendarClock className="size-4" />
          {loading ? "Memuat draft..." : `Menampilkan ${filteredDrafts.length} draft`}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px] px-4">Tipe</TableHead>
              <TableHead className="px-4">Pihak terkait</TableHead>
              <TableHead className="px-4">Tanggal</TableHead>
              <TableHead className="px-4">Total baris</TableHead>
              <TableHead className="px-4">Total qty</TableHead>
              <TableHead className="px-4">Catatan</TableHead>
              <TableHead className="px-4">Diubah</TableHead>
              <TableHead className="w-[200px] px-4">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-slate-600">
                    <Loader2 className="size-4 animate-spin" /> Memuat draft...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredDrafts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-4 text-center text-slate-600">
                  Belum ada draft.
                </TableCell>
              </TableRow>
            ) : (
              filteredDrafts.map((draft) => {
                const meta = parseDraftMeta(draft);
                return (
                  <TableRow key={draft.id}>
                    <TableCell className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "gap-1 rounded-full px-3",
                          draft.type === "INBOUND"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        )}
                      >
                        {draft.type === "INBOUND" ? (
                          <ArrowDownLeft className="size-4" />
                        ) : (
                          <ArrowUpRight className="size-4" />
                        )}
                        {draft.type === "INBOUND" ? "Masuk" : "Keluar"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium px-4 py-3">{meta.counterpart}</TableCell>
                    <TableCell className="text-slate-600 px-4 py-3">{meta.date}</TableCell>
                    <TableCell className="text-slate-600 px-4 py-3">{meta.totalItem}</TableCell>
                    <TableCell className="text-slate-600 px-4 py-3">{meta.totalQty}</TableCell>
                    <TableCell className="text-slate-600 px-4 py-3 truncate max-w-[220px]">
                      {meta.note || "-"}
                    </TableCell>
                    <TableCell className="text-slate-600 px-4 py-3">
                      {new Date(draft.updatedAt).toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={() => handleUseDraft(draft)}
                        >
                          <Play className="size-4" /> Lanjutkan
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={busyId === draft.id}
                          onClick={() => setConfirmId(draft.id)}
                        >
                          {busyId === draft.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                          Hapus
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <AlertDialog open={Boolean(confirmId)} onOpenChange={(open) => !open && setConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus draft?</AlertDialogTitle>
              <AlertDialogDescription>
                Draft akan dihapus permanen dan tidak bisa dikembalikan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmId(null)}>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirmId) deleteDraft(confirmId);
                }}
                disabled={!confirmId || busyId === confirmId}
              >
                {busyId === confirmId ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
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
  sub: string;
}) {
  return (
    <div className="bg-white border text-sm rounded-xl p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
}
