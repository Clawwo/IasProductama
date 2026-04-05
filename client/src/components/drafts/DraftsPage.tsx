import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  Factory,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Env = { VITE_API_BASE?: string };
const API_BASE = (
  (import.meta as { env?: Env }).env?.VITE_API_BASE ?? ""
).trim();
const DRAFTS_URL = `${API_BASE ? API_BASE.replace(/\/$/, "") : ""}/api/drafts`;
const DRAFTS_PAGED_URL = `${DRAFTS_URL}/paged`;

type DraftRecord = {
  id: string;
  type: "INBOUND" | "OUTBOUND" | "PRODUCTION";
  payload: unknown;
  createdAt: string;
  updatedAt: string;
};

type DraftPagedResponse = {
  data: DraftRecord[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

type DraftMeta = {
  counterpart: string;
  date: string;
  totalItem: number;
  totalQty: number;
  note: string;
  kind: Filter;
  draftKind?: string;
};

type Filter = "ALL" | "INBOUND" | "OUTBOUND" | "OUTBOUND_RAW" | "PRODUCTION";

function parseDraftMeta(draft: DraftRecord): DraftMeta {
  const payload = (draft.payload ?? {}) as Record<string, unknown>;
  const draftKind =
    typeof (payload as { draftKind?: unknown }).draftKind === "string"
      ? ((payload as { draftKind?: unknown }).draftKind as string)
      : undefined;

  const isConvectionInbound = draftKind === "CONVECTION_INBOUND";
  const isConvectionOutbound = draftKind === "CONVECTION_OUTBOUND";

  const kind: Filter =
    draft.type === "OUTBOUND" && draftKind === "OUTBOUND_RAW"
      ? "OUTBOUND_RAW"
      : draft.type === "OUTBOUND"
        ? "OUTBOUND"
        : draft.type;

  const finishedLines = Array.isArray(
    (payload as { finishedLines?: unknown }).finishedLines,
  )
    ? ((payload as { finishedLines?: unknown }).finishedLines as Array<{
        qty?: unknown;
      }>)
    : [];

  const rawLines = Array.isArray((payload as { lines?: unknown }).lines)
    ? ((payload as { lines?: unknown }).lines as Array<{ qty?: unknown }>)
    : Array.isArray((payload as { rawLines?: unknown }).rawLines)
      ? ((payload as { rawLines?: unknown }).rawLines as Array<{
          qty?: unknown;
        }>)
      : [];

  const chosenLines =
    kind === "PRODUCTION" && finishedLines.length ? finishedLines : rawLines;

  const totalQty = chosenLines.reduce((sum, line) => {
    const qtyValue = line?.qty;
    const qty = typeof qtyValue === "number" ? qtyValue : Number(qtyValue);
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);

  const totalItem = chosenLines.length;
  const dateValue =
    typeof (payload as { date?: unknown }).date === "string"
      ? ((payload as { date?: unknown }).date as string)
      : "";
  const date = dateValue ? dateValue.slice(0, 10) : "–";
  const note =
    typeof (payload as { note?: unknown }).note === "string"
      ? ((payload as { note?: unknown }).note as string)
      : "";

  let counterpart = "-";
  if (kind === "INBOUND") {
    const vendor = (payload as { vendor?: unknown }).vendor;
    counterpart = typeof vendor === "string" && vendor.trim() ? vendor : "-";
  } else if (kind === "OUTBOUND_RAW") {
    const artisan = (payload as { artisan?: unknown }).artisan;
    counterpart = typeof artisan === "string" && artisan.trim() ? artisan : "-";
  } else if (kind === "OUTBOUND") {
    const orderer = (payload as { orderer?: unknown }).orderer;
    const receiver = (payload as { receiver?: unknown }).receiver;
    if (typeof orderer === "string" && orderer.trim()) {
      counterpart = orderer;
    } else {
      counterpart =
        typeof receiver === "string" && receiver.trim() ? receiver : "-";
    }
  } else if (kind === "PRODUCTION") {
    const noteStr = (payload as { note?: unknown }).note;
    counterpart =
      typeof noteStr === "string" && noteStr.trim() ? noteStr : "Produksi";
  }

  if (isConvectionInbound && counterpart === "-") {
    counterpart = "Konveksi";
  }
  if (isConvectionOutbound && counterpart === "-") {
    counterpart = "Konveksi";
  }

  return { counterpart, date, totalItem, totalQty, note, kind, draftKind };
}

export function DraftsPage() {
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [totalDrafts, setTotalDrafts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [convectionQuickFilter, setConvectionQuickFilter] = useState<
    "ALL" | "CONVECTION_INBOUND" | "CONVECTION_OUTBOUND"
  >("ALL");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const perPage = 20;

  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("perPage", String(perPage));

      if (filter !== "ALL") {
        const type =
          filter === "INBOUND"
            ? "INBOUND"
            : filter === "PRODUCTION"
              ? "PRODUCTION"
              : "OUTBOUND";
        params.set("type", type);
      }

      if (convectionQuickFilter !== "ALL") {
        params.set("draftKind", convectionQuickFilter);
      }

      const response = await httpJson<DraftPagedResponse>(
        `${DRAFTS_PAGED_URL}?${params.toString()}`,
      );

      setDrafts(response.data);
      setTotalDrafts(response.total);
      setPageCount(response.pageCount);
      if (response.page !== page) {
        setPage(response.page);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Gagal memuat draft.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [convectionQuickFilter, filter, page]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  useEffect(() => {
    if (!loading && drafts.length === 0 && page > 1) {
      setPage((prev) => Math.max(1, prev - 1));
    }
  }, [drafts.length, loading, page]);

  const draftsWithMeta = useMemo(
    () => drafts.map((draft) => ({ draft, meta: parseDraftMeta(draft) })),
    [drafts],
  );

  const filteredDrafts = draftsWithMeta;
  const deleteDraft = useCallback(
    async (id: string) => {
      try {
        setBusyId(id);
        await httpJson(`${DRAFTS_URL}/${id}`, { method: "DELETE" });
        await fetchDrafts();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Gagal menghapus draft.";
        setError(message);
      } finally {
        setBusyId(null);
        setConfirmId(null);
      }
    },
    [fetchDrafts],
  );

  const handleUseDraft = useCallback((draft: DraftRecord, meta: DraftMeta) => {
    sessionStorage.setItem(
      "draft:pending-load",
      JSON.stringify({
        id: draft.id,
        type: draft.type,
        payload: draft.payload,
      }),
    );
    if (meta.draftKind === "CONVECTION_INBOUND") {
      window.location.hash = "#konveksi-masuk";
    } else if (meta.draftKind === "CONVECTION_OUTBOUND") {
      window.location.hash = "#konveksi-keluar";
    } else if (meta.draftKind === "INBOUND_RAW") {
      window.location.hash = "#bahan-masuk";
    } else if (meta.kind === "INBOUND") {
      window.location.hash = "#masuk";
    } else if (meta.kind === "OUTBOUND_RAW") {
      window.location.hash = "#bengkel-keluar";
    } else if (meta.kind === "PRODUCTION") {
      window.location.hash = "#produksi";
    } else {
      window.location.hash = "#keluar";
    }
  }, []);

  return (
    <div className="min-h-screen bg-white px-4 py-6 text-slate-900 md:px-6 md:py-8">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
            Gudang
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 leading-tight">
            Draft
          </h1>
          <p className="text-sm text-slate-600">
            Simpan catatan sementara. Lanjutkan kapan saja tanpa mengubah stok.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {(
            [
              { key: "ALL", label: "Semua", icon: ClipboardList },
              {
                key: "INBOUND" as Filter,
                label: "Barang Masuk",
                icon: ArrowDownLeft,
              },
              {
                key: "OUTBOUND" as Filter,
                label: "Barang Keluar",
                icon: ArrowUpRight,
              },
              {
                key: "OUTBOUND_RAW" as Filter,
                label: "Bahan Keluar",
                icon: Wrench,
              },
              { key: "PRODUCTION" as Filter, label: "Produksi", icon: Factory },
              {
                key: "CONVECTION_INBOUND" as Filter,
                label: "Konveksi Masuk",
                icon: ArrowDownLeft,
              },
              {
                key: "CONVECTION_OUTBOUND" as Filter,
                label: "Konveksi Keluar",
                icon: ArrowUpRight,
              },
            ] as Array<{
              key: Filter;
              label: string;
              icon: typeof ClipboardList;
            }>
          ).map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? "default" : "outline"}
              className={cn("gap-2", filter === key && "shadow-sm")}
              onClick={() => {
                setPage(1);
                setFilter(key);
                setConvectionQuickFilter("ALL");
              }}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDrafts}
            disabled={loading}
          >
            <RefreshCw className="mr-2 size-4" /> Muat ulang
          </Button>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total draft"
          value={String(totalDrafts)}
          sub={
            filter === "ALL"
              ? "Semua tipe"
              : filter === "INBOUND"
                ? "Draft masuk"
                : filter === "OUTBOUND"
                  ? "Draft barang keluar"
                  : filter === "OUTBOUND_RAW"
                    ? "Draft bahan baku"
                    : "Draft produksi"
          }
        />
        <SummaryCard
          label="Terbaru"
          value={
            draftsWithMeta[0]
              ? new Date(draftsWithMeta[0].draft.updatedAt).toLocaleString(
                  "id-ID",
                )
              : "-"
          }
          sub={draftsWithMeta[0] ? "Terakhir diubah" : "Belum ada draft"}
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
          {loading
            ? "Memuat draft..."
            : `Menampilkan ${drafts.length} dari ${totalDrafts} draft`}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-30 px-4">Tipe</TableHead>
              <TableHead className="px-4">Pihak terkait</TableHead>
              <TableHead className="px-4">Tanggal</TableHead>
              <TableHead className="px-4">Total baris</TableHead>
              <TableHead className="px-4">Total qty</TableHead>
              <TableHead className="px-4">Catatan</TableHead>
              <TableHead className="px-4">Diubah</TableHead>
              <TableHead className="w-50 px-4">Aksi</TableHead>
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
                <TableCell
                  colSpan={8}
                  className="px-4 py-4 text-center text-slate-600"
                >
                  Belum ada draft.
                </TableCell>
              </TableRow>
            ) : (
              filteredDrafts.map(({ draft, meta }) => {
                const badgeClass =
                  meta.kind === "INBOUND"
                    ? "bg-emerald-50 text-emerald-700"
                    : meta.kind === "PRODUCTION"
                      ? "bg-blue-50 text-blue-700"
                      : meta.kind === "OUTBOUND_RAW"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-orange-50 text-orange-700";

                const TypeIcon =
                  meta.kind === "INBOUND"
                    ? ArrowDownLeft
                    : meta.kind === "OUTBOUND_RAW"
                      ? Wrench
                      : meta.kind === "PRODUCTION"
                        ? Factory
                        : ArrowUpRight;

                const typeLabel =
                  meta.kind === "INBOUND"
                    ? meta.draftKind === "CONVECTION_INBOUND"
                      ? "Masuk Konveksi"
                      : "Masuk"
                    : meta.kind === "OUTBOUND_RAW"
                      ? "Bahan Keluar"
                      : meta.kind === "PRODUCTION"
                        ? "Produksi"
                        : meta.draftKind === "CONVECTION_OUTBOUND"
                          ? "Keluar Konveksi"
                          : "Keluar";

                return (
                  <TableRow key={draft.id}>
                    <TableCell className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className={cn("gap-1 rounded-full px-3", badgeClass)}
                      >
                        <TypeIcon className="size-4" />
                        {typeLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium px-4 py-3">
                      {meta.counterpart}
                    </TableCell>
                    <TableCell className="text-slate-600 px-4 py-3">
                      {meta.date}
                    </TableCell>
                    <TableCell className="text-slate-600 px-4 py-3">
                      {meta.totalItem}
                    </TableCell>
                    <TableCell className="text-slate-600 px-4 py-3">
                      {meta.totalQty}
                    </TableCell>
                    <TableCell className="text-slate-600 px-4 py-3 truncate max-w-55">
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
                          onClick={() => handleUseDraft(draft, meta)}
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
        <AlertDialog
          open={Boolean(confirmId)}
          onOpenChange={(open) => !open && setConfirmId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus draft?</AlertDialogTitle>
              <AlertDialogDescription>
                Draft akan dihapus permanen dan tidak bisa dikembalikan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmId(null)}>
                Batal
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirmId) deleteDraft(confirmId);
                }}
                disabled={!confirmId || busyId === confirmId}
              >
                {busyId === confirmId ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <span>
          Halaman <span className="font-semibold text-slate-900">{page}</span>{" "}
          dari <span className="font-semibold text-slate-900">{pageCount}</span>
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Sebelumnya
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pageCount || loading}
            onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
          >
            Berikutnya
          </Button>
        </div>
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
