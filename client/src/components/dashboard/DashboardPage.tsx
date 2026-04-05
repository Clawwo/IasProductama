import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  History,
  PackageCheck,
  PackagePlus,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { httpJson } from "@/lib/http";
import { SummaryChart } from "./SummaryChart";

export type AppNavKey =
  | "dashboard"
  | "inventory"
  | "bengkel"
  | "bengkel-masuk"
  | "bengkel-keluar"
  | "masuk"
  | "keluar"
  | "bahan"
  | "bahan-masuk"
  | "bahan-keluar"
  | "drafts"
  | "produksi"
  | "riwayat"
  | "users"
  | "konveksi"
  | "konveksi-masuk"
  | "konveksi-keluar";
type Env = { VITE_API_BASE?: string };
const API_BASE = ((import.meta as { env?: Env }).env?.VITE_API_BASE ?? "")
  .trim()
  .replace(/\/$/, "");
const ITEMS_URL = `${API_BASE}/api/items`;
const RAW_URL = `${API_BASE}/api/raw-materials`;
const PRODUCTS_URL = `${API_BASE}/api/products`;
const HISTORY_URL = `${API_BASE}/api/history`;
const DRAFTS_PAGED_URL = `${API_BASE}/api/drafts/paged`;

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    year: "numeric",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatQty(value: number) {
  const num = Number.isFinite(value) ? value : 0;
  const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
  return rounded.toLocaleString("id-ID", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// Sidebar navigation is provided by the parent Shell; no sidebar rendered here.

function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  delta: string;
  icon: typeof ArrowDownLeft;
  tone: string;
  onClick?: () => void;
}) {
  const className = cn(
    "border text-left rounded-2xl p-5 shadow-sm transition",
    "bg-white hover:border-slate-300 hover:shadow",
    onClick && "cursor-pointer",
  );

  const content = (
    <>
      <div
        className={cn(
          "grid size-12 place-items-center rounded-xl",
          "bg-linear-to-br",
          tone,
        )}
      >
        <Icon className="size-5" />
      </div>
      <p className="mt-3 text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-slate-900">
          {value}
        </span>
        <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs">
          {delta}
        </Badge>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function MovementRow({
  item,
  type,
  qty,
  actor,
  time,
  timestamp,
  note,
}: {
  id: string;
  item: string;
  type: "Masuk" | "Keluar";
  qty: number;
  actor?: string;
  time: string;
  timestamp: number;
  note?: string;
}) {
  const isIn = type === "Masuk";
  return (
    <TableRow data-timestamp={timestamp}>
      <TableCell>
        <div className="font-medium">{item}</div>
        <p className="text-xs text-muted-foreground">{note || "-"}</p>
      </TableCell>
      <TableCell>
        <Badge
          className={cn(
            "rounded-full px-3",
            isIn
              ? "bg-emerald-50 text-emerald-700"
              : "bg-orange-50 text-orange-700",
          )}
        >
          {type}
        </Badge>
      </TableCell>
      <TableCell className="font-semibold">
        {isIn ? `+${qty}` : `-${qty}`}
      </TableCell>
      <TableCell className="text-muted-foreground">{actor || "-"}</TableCell>
      <TableCell className="text-muted-foreground">{time}</TableCell>
    </TableRow>
  );
}

function AlertCard({
  title,
  detail,
  tone,
}: {
  title: string;
  detail: string;
  tone: string;
}) {
  return (
    <div className={cn("border rounded-lg p-3", tone)}>
      <div className="flex items-center gap-2">
        <TrendingUp className="size-4" />
        <p className="font-semibold text-sm">{title}</p>
      </div>
      <p className="text-xs leading-relaxed mt-1">{detail}</p>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: typeof PackagePlus;
  label: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="cursor-pointer text-left bg-white border rounded-2xl p-5 w-full transition shadow-sm hover:border-slate-300 hover:shadow"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <span className="bg-slate-900 text-white grid size-12 place-items-center rounded-xl">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="font-semibold">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  );
}

function HeroStrip({
  onOpenDrafts,
  draftCount,
}: {
  onOpenDrafts: () => void;
  draftCount: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-linear-to-r from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow-md">
      <div
        className="absolute inset-y-0 right-0 w-1/3 bg-linear-to-l from-white/5 to-transparent"
        aria-hidden
      />
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-white/70">
            Gudang aktif
          </p>
          <h2 className="text-2xl font-semibold leading-tight">
            Ringkasan stok hari ini
          </h2>
          <p className="text-white/70 text-sm mt-1">
            Cek stok, barang masuk, barang keluar, dan draft dalam satu layar.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
          <div className="grid size-12 place-items-center rounded-lg bg-white/15 text-white">
            <History className="size-5" />
          </div>
          <div>
            <p className="text-sm text-white/80">Antrian dokumen</p>
            <p className="text-lg font-semibold">{draftCount} draft siap cek</p>
          </div>
          <Button
            variant="secondary"
            className="cursor-pointer bg-white text-slate-900 hover:bg-slate-100"
            onClick={onOpenDrafts}
          >
            Lihat draft
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage({
  onNavigate,
  canReadRawMaterials = false,
}: {
  onNavigate?: (key: AppNavKey) => void;
  canReadRawMaterials?: boolean;
}) {
  type ItemApi = {
    code: string;
    stock: number;
    name?: string;
    category?: string;
  };
  type HistoryApi = {
    id: string;
    direction: "Masuk" | "Keluar";
    txCode: string;
    itemCode: string;
    name: string;
    qty: number;
    actor?: string;
    rawTime: string;
    note?: string;
  };
  type HistoryStatsApi = {
    total: number;
    inboundCount: number;
    outboundCount: number;
    outboundGoodsCount: number;
    outboundRawCount: number;
    inboundQty: number;
    outboundQty: number;
    outboundRawQty: number;
  };
  type HistoryResponseApi = {
    data: HistoryApi[];
    total: number;
    page: number;
    perPage: number;
    pageCount: number;
    stats: HistoryStatsApi;
  };
  type DraftPagedResponse = {
    total: number;
    page: number;
    perPage: number;
    pageCount: number;
  };
  type Movement = {
    id: string;
    item: string;
    type: "Masuk" | "Keluar";
    qty: number;
    actor?: string;
    time: string;
    timestamp: number;
    note?: string;
  };

  const [items, setItems] = useState<ItemApi[]>([]);
  const [historyRows, setHistoryRows] = useState<HistoryApi[]>([]);
  const [chartRows, setChartRows] = useState<HistoryApi[]>([]);
  const [historyStats, setHistoryStats] = useState<HistoryStatsApi>({
    total: 0,
    inboundCount: 0,
    outboundCount: 0,
    outboundGoodsCount: 0,
    outboundRawCount: 0,
    inboundQty: 0,
    outboundQty: 0,
    outboundRawQty: 0,
  });
  const [draftCount, setDraftCount] = useState(0);
  const [loadingStock, setLoadingStock] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const refreshing = loadingStock || loadingHistory || loadingDrafts;

  const navigateTo = useCallback(
    (key: AppNavKey) => {
      if (onNavigate) {
        onNavigate(key);
      } else {
        window.location.hash = key === "dashboard" ? "#dashboard" : `#${key}`;
      }
    },
    [onNavigate],
  );

  const toInputDate = useCallback((date: Date) => {
    const adjusted = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000,
    );
    return adjusted.toISOString().slice(0, 10);
  }, []);

  const loadStock = useCallback(async () => {
    setLoadingStock(true);
    setStockError(null);
    try {
      const rawPromise = canReadRawMaterials
        ? httpJson<ItemApi[]>(RAW_URL).catch((err: unknown) => {
            const status =
              typeof err === "object" && err !== null && "status" in err
                ? (err as { status?: number }).status
                : undefined;
            if (status === 403) return [];
            throw err;
          })
        : Promise.resolve<ItemApi[]>([]);

      const [itemsData, rawData, productsData] = await Promise.all([
        httpJson<ItemApi[]>(ITEMS_URL),
        rawPromise,
        httpJson<ItemApi[]>(PRODUCTS_URL),
      ]);

      const merged = [
        ...itemsData,
        ...rawData.filter(
          (raw) => !itemsData.some((it) => it.code === raw.code),
        ),
        ...productsData.filter(
          (prod) =>
            !itemsData.some((it) => it.code === prod.code) &&
            !rawData.some((raw) => raw.code === prod.code),
        ),
      ]
        .filter((item) => Boolean(item.code))
        .map((item) => ({
          ...item,
          stock: Number.isFinite(Number(item.stock)) ? Number(item.stock) : 0,
        }));

      setItems(merged);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Gagal memuat stok dashboard.";
      setStockError(message);
    } finally {
      setLoadingStock(false);
    }
  }, [canReadRawMaterials]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const today = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);

      const recentParams = new URLSearchParams({
        page: "1",
        perPage: "120",
      });
      const chartParams = new URLSearchParams({
        page: "1",
        perPage: "500",
        fromDate: toInputDate(start),
        toDate: toInputDate(today),
      });

      const nonConvectionCategories = [
        "Barang",
        "Bahan baku",
        "Produksi",
      ] as const;
      const nonConvectionStatsRequests = nonConvectionCategories.map(
        (category) => {
          const params = new URLSearchParams({
            page: "1",
            perPage: "1",
            category,
          });
          return httpJson<HistoryResponseApi>(
            `${HISTORY_URL}?${params.toString()}`,
          );
        },
      );

      const [recent, chart, ...nonConvectionStatsResults] = await Promise.all([
        httpJson<HistoryResponseApi>(
          `${HISTORY_URL}?${recentParams.toString()}`,
        ),
        httpJson<HistoryResponseApi>(
          `${HISTORY_URL}?${chartParams.toString()}`,
        ),
        ...nonConvectionStatsRequests,
      ]);

      const nonConvectionStats =
        nonConvectionStatsResults.reduce<HistoryStatsApi>(
          (acc, result) => {
            const stats = result.stats;
            return {
              total: acc.total + (stats?.total ?? 0),
              inboundCount: acc.inboundCount + (stats?.inboundCount ?? 0),
              outboundCount: acc.outboundCount + (stats?.outboundCount ?? 0),
              outboundGoodsCount:
                acc.outboundGoodsCount + (stats?.outboundGoodsCount ?? 0),
              outboundRawCount:
                acc.outboundRawCount + (stats?.outboundRawCount ?? 0),
              inboundQty: acc.inboundQty + (stats?.inboundQty ?? 0),
              outboundQty: acc.outboundQty + (stats?.outboundQty ?? 0),
              outboundRawQty: acc.outboundRawQty + (stats?.outboundRawQty ?? 0),
            };
          },
          {
            total: 0,
            inboundCount: 0,
            outboundCount: 0,
            outboundGoodsCount: 0,
            outboundRawCount: 0,
            inboundQty: 0,
            outboundQty: 0,
            outboundRawQty: 0,
          },
        );

      setHistoryRows(recent.data ?? []);
      setHistoryStats(nonConvectionStats);
      setChartRows(chart.data ?? []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Gagal memuat riwayat dashboard.";
      setHistoryError(message);
    } finally {
      setLoadingHistory(false);
    }
  }, [toInputDate]);

  const loadDraftCount = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const params = new URLSearchParams({ page: "1", perPage: "1" });
      const response = await httpJson<DraftPagedResponse>(
        `${DRAFTS_PAGED_URL}?${params.toString()}`,
      );
      setDraftCount(response.total ?? 0);
    } catch {
      setDraftCount(0);
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  const refreshDashboard = useCallback(() => {
    loadStock();
    loadHistory();
    loadDraftCount();
  }, [loadStock, loadHistory, loadDraftCount]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    loadDraftCount();
  }, [loadDraftCount]);

  const summary = useMemo(() => {
    const totalSku = items.length;
    const totalStock = items.reduce((sum, it) => sum + (it.stock ?? 0), 0);
    const lowStock = items.filter(
      (it) => (it.stock ?? 0) > 0 && (it.stock ?? 0) <= 5,
    );
    const emptyStock = items.filter((it) => (it.stock ?? 0) === 0);
    return {
      totalSku,
      totalStock,
      lowStock,
      emptyStock,
      inboundQty: historyStats.inboundQty,
      outboundQty: historyStats.outboundQty,
      inboundCount: historyStats.inboundCount,
      outboundCount: historyStats.outboundCount,
    };
  }, [historyStats, items]);

  const stats = useMemo(
    () => [
      {
        label: "Barang masuk",
        value: String(summary.inboundCount ?? 0),
        delta: `${formatQty(summary.inboundQty)} pcs`,
        icon: ArrowDownLeft,
        tone: "from-emerald-500/15 to-emerald-700/10 text-emerald-700",
        onClick: () => navigateTo("masuk"),
      },
      {
        label: "Barang keluar",
        value: String(summary.outboundCount ?? 0),
        delta: `${formatQty(summary.outboundQty)} pcs`,
        icon: ArrowUpRight,
        tone: "from-amber-500/15 to-amber-700/10 text-amber-700",
        onClick: () => navigateTo("keluar"),
      },
      {
        label: "Saldo stok",
        value: String(summary.totalStock ?? 0),
        delta: `${summary.totalSku} SKU`,
        icon: Warehouse,
        tone: "from-sky-500/15 to-sky-700/10 text-sky-700",
        onClick: () => navigateTo("inventory"),
      },
      {
        label: "Stok menipis",
        value: String(summary.lowStock.length ?? 0),
        delta: "<= 5 pcs",
        icon: ShieldCheck,
        tone: "from-rose-500/15 to-rose-700/10 text-rose-700",
        onClick: () => navigateTo("inventory"),
      },
    ],
    [navigateTo, summary],
  );

  const alerts = useMemo(() => {
    const low = summary.lowStock.slice(0, 5);
    return low.map((it) => ({
      id: it.code,
      title: it.name ?? it.code,
      detail: `Stok ${it.stock ?? 0} pcs — segera restock`,
      tone: "text-amber-700 bg-amber-50 border-amber-100",
    }));
  }, [summary.lowStock]);

  const movements: Movement[] = useMemo(() => {
    return historyRows
      .map((row) => ({
        id: row.id,
        item: row.name || row.itemCode,
        type: row.direction,
        qty: Math.abs(Number(row.qty) || 0),
        actor: row.actor,
        time: formatDateTime(row.rawTime),
        timestamp: Date.parse(row.rawTime) || 0,
        note: row.note,
      }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 12);
  }, [historyRows]);

  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - idx));
      return d;
    });

    const byDay = days.map((day) => {
      const dayEnd = new Date(day);
      dayEnd.setDate(dayEnd.getDate() + 1);

      let inboundQty = 0;
      let outboundQty = 0;

      chartRows.forEach((row) => {
        const ts = Date.parse(row.rawTime);
        if (Number.isNaN(ts) || ts < day.getTime() || ts >= dayEnd.getTime()) {
          return;
        }
        const qty = Math.abs(Number(row.qty) || 0);
        if (row.direction === "Masuk") {
          inboundQty += qty;
        } else {
          outboundQty += qty;
        }
      });

      return {
        label: day.toLocaleDateString("id-ID", {
          weekday: "short",
          day: "2-digit",
        }),
        inbound: inboundQty,
        outbound: outboundQty,
      };
    });

    return byDay;
  }, [chartRows]);

  const quickActions = [
    {
      icon: PackagePlus,
      label: "Catat barang masuk",
      description: "Catat barang yang masuk",
      onClick: () => navigateTo("masuk"),
    },
    {
      icon: PackageCheck,
      label: "Catat barang keluar",
      description: "Catat barang yang keluar",
      onClick: () => navigateTo("keluar"),
    },
    {
      icon: ClipboardList,
      label: "Lihat inventory",
      description: "Lihat stok barang saat ini",
      onClick: () => navigateTo("inventory"),
    },
    {
      icon: History,
      label: "Daftar riwayat",
      description: "Lihat riwayat transaksi",
      onClick: () => navigateTo("riwayat"),
    },
  ];

  return (
    <div className="space-y-6">
      <HeroStrip
        draftCount={draftCount}
        onOpenDrafts={() => navigateTo("drafts")}
      />

      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-600">Status data</p>
            <h3 className="text-lg font-semibold text-slate-900">
              Data dashboard
            </h3>
            <p className="text-sm text-slate-600">
              Tekan Sinkronkan data untuk memperbarui angka.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer border-slate-300"
            onClick={refreshDashboard}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("mr-2 size-4", refreshing && "animate-spin")}
            />
            Sinkronkan data
          </Button>
        </div>
      </section>

      <section
        id="inventory"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        {loadingStock ? (
          <p className="text-sm text-muted-foreground md:col-span-4">
            Memuat data stok...
          </p>
        ) : null}
        {stockError ? (
          <p className="text-sm text-red-600 md:col-span-4">{stockError}</p>
        ) : null}
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section id="masuk" className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <SummaryChart data={chartData} />

          <div className="bg-white border rounded-2xl shadow-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  Pergerakan terbaru
                </p>
                <h3 className="text-lg font-semibold leading-tight">
                  Riwayat masuk dan keluar
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer"
                onClick={() => navigateTo("riwayat")}
              >
                <History className="mr-2 size-4" />
                Lihat riwayat
              </Button>
            </div>
            <Separator />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barang</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Petugas</TableHead>
                  <TableHead>Waktu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingHistory ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-muted-foreground py-6"
                    >
                      Memuat riwayat...
                    </TableCell>
                  </TableRow>
                ) : historyError ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-red-600 py-6"
                    >
                      {historyError}
                    </TableCell>
                  </TableRow>
                ) : movements.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-muted-foreground py-6"
                    >
                      Belum ada pergerakan. Catat transaksi untuk melihat
                      riwayat.
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.map((movement) => (
                    <MovementRow key={movement.id} {...movement} />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div id="keluar" className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Aksi cepat</h3>
            <p className="text-sm text-muted-foreground">
              Pilih menu untuk mulai mencatat.
            </p>
            <div className="grid gap-3">
              {quickActions.map((action) => (
                <QuickAction key={action.label} {...action} />
              ))}
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monitor stok</p>
                <h3 className="text-lg font-semibold">Peringatan stok</h3>
              </div>
              <Badge variant="outline" className="rounded-full px-3">
                {alerts.length} alert
              </Badge>
            </div>
            <div className="space-y-2">
              {alerts.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Semua stok aman. Stok kosong: {summary.emptyStock.length}{" "}
                  item.
                </div>
              ) : (
                alerts.map((alert) => <AlertCard key={alert.id} {...alert} />)
              )}
            </div>
          </div>
        </div>
      </section>

      <div id="riwayat" className="sr-only" aria-hidden />
    </div>
  );
}
