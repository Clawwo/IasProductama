import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  History,
  PackageCheck,
  PackagePlus,
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
import { useEffect, useMemo, useState } from "react";
import { SummaryChart } from "./SummaryChart";

export type AppNavKey =
  | "dashboard"
  | "inventory"
  | "masuk"
  | "keluar"
  | "bahan-keluar"
  | "drafts"
  | "produksi"
  | "riwayat";
type Env = { VITE_API_BASE?: string };
const API_BASE = ((import.meta as { env?: Env }).env?.VITE_API_BASE ?? "")
  .trim()
  .replace(/\/$/, "");
const ITEMS_URL = `${API_BASE}/api/items`;
const INBOUND_URL = `${API_BASE}/api/inbound`;
const OUTBOUND_URL = `${API_BASE}/api/outbound`;

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Sidebar navigation is provided by the parent Shell; no sidebar rendered here.

function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  icon: typeof ArrowDownLeft;
  tone: string;
}) {
  return (
    <div className="bg-white border text-sm rounded-xl p-4 shadow-sm">
      <div
        className={cn(
          "grid size-10 place-items-center rounded-lg",
          "bg-linear-to-br",
          tone
        )}
      >
        <Icon className="size-4" />
      </div>
      <p className="mt-3 text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        <Badge variant="secondary" className="rounded-full px-2 py-1 text-xs">
          {delta}
        </Badge>
      </div>
    </div>
  );
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
        <p className="text-xs text-muted-foreground">{note}</p>
      </TableCell>
      <TableCell>
        <Badge
          className={cn(
            "rounded-full px-3",
            isIn
              ? "bg-emerald-50 text-emerald-700"
              : "bg-orange-50 text-orange-700"
          )}
        >
          {type}
        </Badge>
      </TableCell>
      <TableCell className="font-semibold">
        {isIn ? `+${qty}` : `-${qty}`}
      </TableCell>
      <TableCell className="text-muted-foreground">{actor}</TableCell>
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
      className="text-left bg-white border rounded-xl p-4 w-full transition shadow-sm hover:border-slate-300 hover:shadow"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <span className="bg-slate-900 text-white grid size-10 place-items-center rounded-lg">
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

function HeroStrip({ onNavigate }: { onNavigate?: (key: AppNavKey) => void }) {
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
            Pantau pergerakan harian
          </h2>
          <p className="text-white/70 text-sm mt-1">
            Fokus pada alur masuk-keluar hari ini. Draftkan dokumen sebelum
            konfirmasi pengiriman.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
          <div className="grid size-12 place-items-center rounded-lg bg-white/15 text-white">
            <History className="size-5" />
          </div>
          <div>
            <p className="text-sm text-white/70">Antrian dokumen</p>
            <p className="text-lg font-semibold">6 draft siap cek</p>
          </div>
          <Button
            variant="secondary"
            className="bg-white text-slate-900 hover:bg-slate-100"
            onClick={() => {
              if (onNavigate) {
                onNavigate("drafts");
              } else {
                window.location.hash = "#drafts";
              }
            }}
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
}: {
  onNavigate?: (key: AppNavKey) => void;
}) {
  type ItemApi = {
    code: string;
    stock: number;
    name?: string;
    category?: string;
  };
  type LineApi = { code: string; qty: number; note?: string; name?: string };
  type InboundApi = {
    id: string;
    code?: string;
    vendor?: string;
    date: string;
    note?: string;
    lines: LineApi[];
    createdAt?: string;
  };
  type OutboundApi = {
    id: string;
    code?: string;
    orderer?: string;
    date: string;
    note?: string;
    lines: LineApi[];
    createdAt?: string;
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
  const [inbound, setInbound] = useState<InboundApi[]>([]);
  const [outbound, setOutbound] = useState<OutboundApi[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingStock(true);
      setStockError(null);
      try {
        const res = await fetch(ITEMS_URL);
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as ItemApi[];
        if (!cancelled) setItems(data);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Gagal memuat stok.";
        if (!cancelled) setStockError(message);
      } finally {
        if (!cancelled) setLoadingStock(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      setLoadingHistory(true);
      setHistoryError(null);
      try {
        const [inRes, outRes] = await Promise.all([
          fetch(`${INBOUND_URL}?limit=30`),
          fetch(`${OUTBOUND_URL}?limit=30`),
        ]);
        if (!inRes.ok) throw new Error(await inRes.text());
        if (!outRes.ok) throw new Error(await outRes.text());
        const inboundData = (await inRes.json()) as InboundApi[];
        const outboundData = (await outRes.json()) as OutboundApi[];
        if (!cancelled) {
          setInbound(inboundData);
          setOutbound(outboundData);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Gagal memuat riwayat.";
        if (!cancelled) setHistoryError(message);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const totalSku = items.length;
    const totalStock = items.reduce((sum, it) => sum + (it.stock ?? 0), 0);
    const lowStock = items.filter(
      (it) => (it.stock ?? 0) > 0 && (it.stock ?? 0) <= 5
    );
    const emptyStock = items.filter((it) => (it.stock ?? 0) === 0);
    const inboundQty = inbound.reduce(
      (sum, rec) => sum + rec.lines.reduce((s, l) => s + l.qty, 0),
      0
    );
    const outboundQty = outbound.reduce(
      (sum, rec) => sum + rec.lines.reduce((s, l) => s + l.qty, 0),
      0
    );
    return {
      totalSku,
      totalStock,
      lowStock,
      emptyStock,
      inboundQty,
      outboundQty,
    };
  }, [items, inbound, outbound]);

  const stats = useMemo(
    () => [
      {
        label: "Barang masuk",
        value: String(inbound.length ?? 0),
        delta: `${summary.inboundQty} pcs`,
        icon: ArrowDownLeft,
        tone: "from-emerald-500/15 to-emerald-700/10 text-emerald-700",
      },
      {
        label: "Barang keluar",
        value: String(outbound.length ?? 0),
        delta: `${summary.outboundQty} pcs`,
        icon: ArrowUpRight,
        tone: "from-amber-500/15 to-amber-700/10 text-amber-700",
      },
      {
        label: "Saldo stok",
        value: String(summary.totalStock ?? 0),
        delta: `${summary.totalSku} SKU`,
        icon: Warehouse,
        tone: "from-sky-500/15 to-sky-700/10 text-sky-700",
      },
      {
        label: "Stok menipis",
        value: String(summary.lowStock.length ?? 0),
        delta: "<= 5 pcs",
        icon: ShieldCheck,
        tone: "from-rose-500/15 to-rose-700/10 text-rose-700",
      },
    ],
    [inbound.length, outbound.length, summary]
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
    const mapLines = (
      rows: Array<InboundApi | OutboundApi>,
      type: Movement["type"],
      actorKey: "vendor" | "orderer"
    ) =>
      rows.flatMap((rec) =>
        rec.lines.map((line, idx) => ({
          timestamp: Date.parse(rec.date ?? rec.createdAt ?? "") || 0,
          id: `${type}-${rec.id}-${idx}-${line.code}`,
          item: line.name ?? line.code,
          type,
          qty: line.qty,
          actor: (rec as never)[actorKey] as string | undefined,
          time: formatDateTime(rec.date ?? rec.createdAt ?? ""),
          note: line.note ?? rec.note,
        }))
      );

    const combined = [
      ...mapLines(inbound, "Masuk", "vendor"),
      ...mapLines(outbound, "Keluar", "orderer"),
    ];
    return combined.sort((a, b) => b.timestamp - a.timestamp).slice(0, 12);
  }, [inbound, outbound]);

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

      const inboundQty = inbound.reduce((sum, rec) => {
        const ts = Date.parse(rec.date ?? rec.createdAt ?? "");
        return ts >= day.getTime() && ts < dayEnd.getTime()
          ? sum + rec.lines.reduce((s, l) => s + l.qty, 0)
          : sum;
      }, 0);

      const outboundQty = outbound.reduce((sum, rec) => {
        const ts = Date.parse(rec.date ?? rec.createdAt ?? "");
        return ts >= day.getTime() && ts < dayEnd.getTime()
          ? sum + rec.lines.reduce((s, l) => s + l.qty, 0)
          : sum;
      }, 0);

      return {
        label: day.toLocaleDateString("id-ID", { weekday: "short" }),
        inbound: inboundQty,
        outbound: outboundQty,
      };
    });

    return byDay;
  }, [inbound, outbound]);

  const quickActions = [
    {
      icon: PackagePlus,
      label: "Catat barang masuk",
      description: "Terima stok baru atau retur vendor",
      onClick: () => onNavigate?.("masuk"),
    },
    {
      icon: PackageCheck,
      label: "Catat barang keluar",
      description: "Pengiriman, peminjaman, atau mutasi",
      onClick: () => onNavigate?.("keluar"),
    },
    {
      icon: ClipboardList,
      label: "Lihat inventory",
      description: "Cek stok dan detail barang",
      onClick: () => onNavigate?.("inventory"),
    },
    {
      icon: History,
      label: "Daftar riwayat",
      description: "Pantau histori masuk-keluar",
      onClick: () => onNavigate?.("riwayat"),
    },
  ];

  return (
    <div className="space-y-6">
      <HeroStrip onNavigate={onNavigate} />

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
                  Masuk / Keluar hari ini
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate?.("riwayat")}
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
                      Belum ada data pergerakan. Catat barang masuk/keluar untuk
                      melihat histori terbaru.
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
              Mulai pencatatan tanpa meninggalkan dashboard.
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
                <h3 className="text-lg font-semibold">Alert cepat</h3>
              </div>
              <Badge variant="outline" className="rounded-full px-3">
                {alerts.length} alert
              </Badge>
            </div>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <AlertCard key={alert.id} {...alert} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <div id="riwayat" className="sr-only" aria-hidden />
    </div>
  );
}
