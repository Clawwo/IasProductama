import {
  ArrowDownLeft,
  ArrowUpRight,
  Box,
  Boxes,
  ChartNoAxesCombined,
  ClipboardList,
  History,
  LayoutDashboard,
  PackageCheck,
  PackagePlus,
  Settings,
  ShieldCheck,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
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

export type AppNavKey =
  | "dashboard"
  | "inventory"
  | "masuk"
  | "keluar"
  | "riwayat"
  | "pengaturan";
type Env = { VITE_API_BASE?: string };
const API_BASE = ((import.meta as { env?: Env }).env?.VITE_API_BASE ?? "")
  .trim()
  .replace(/\/$/, "");
const ITEMS_URL = `${API_BASE}/api/items`;

export function SidebarNav({
  active = "dashboard",
  onNavigate,
}: {
  active?: AppNavKey;
  onNavigate?: (key: AppNavKey) => void;
}) {
  const items: Array<{
    key: AppNavKey;
    label: string;
    icon: typeof LayoutDashboard;
    href: string;
  }> = [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      href: "#dashboard",
    },
    { key: "inventory", label: "Inventory", icon: Box, href: "#inventory" },
    {
      key: "masuk",
      label: "Barang Masuk",
      icon: ArrowDownLeft,
      href: "#masuk",
    },
    {
      key: "keluar",
      label: "Barang Keluar",
      icon: ArrowUpRight,
      href: "#keluar",
    },
    { key: "riwayat", label: "Riwayat", icon: History, href: "#riwayat" },
    {
      key: "pengaturan",
      label: "Pengaturan",
      icon: Settings,
      href: "#pengaturan",
    },
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <div className="bg-gradient-to-br from-slate-900 to-slate-700 text-white grid size-9 place-items-center rounded-lg font-semibold shadow-sm">
            JD
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">
              Jogja Drumband
            </span>
            <span className="text-xs text-muted-foreground leading-tight">
              Warehouse Control
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu utama</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    isActive={active === item.key}
                    asChild
                    onClick={(e) => {
                      if (onNavigate) {
                        e.preventDefault();
                        onNavigate(item.key);
                      }
                    }}
                  >
                    <a href={item.href} className="flex items-center gap-2">
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <div className="bg-muted/60 text-xs text-muted-foreground rounded-md border px-2 py-2">
          <div className="flex items-center gap-2 text-foreground">
            <ChartNoAxesCombined className="size-4" />
            Mode pantau stok
          </div>
          <p className="mt-1 leading-relaxed">
            Pantau pergerakan harian dan simpan pencatatan masuk-keluar.
          </p>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

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
          "bg-gradient-to-br",
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

function DashboardHeader({
  onNavigate,
}: {
  onNavigate?: (key: AppNavKey) => void;
}) {
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-white/85 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-6" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Beranda</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Input placeholder="Cari barang atau kode" className="w-48 md:w-64" />
        <Button
          variant="outline"
          className="border-dashed"
          onClick={() => onNavigate?.("masuk")}
        >
          <ArrowDownLeft className="mr-2 size-4" />
          Catat masuk
        </Button>
        <Button onClick={() => onNavigate?.("keluar")}>
          <ArrowUpRight className="mr-2 size-4" />
          Catat keluar
        </Button>
      </div>
    </header>
  );
}

function HeroStrip() {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow-md">
      <div
        className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-white/5 to-transparent"
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
  const [items, setItems] = useState<Array<{ code: string; stock: number; name?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(ITEMS_URL);
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as Array<{ code: string; stock: number; name?: string }>;
        if (!cancelled) setItems(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Gagal memuat stok.";
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const totalSku = items.length;
    const totalStock = items.reduce((sum, it) => sum + (it.stock ?? 0), 0);
    const lowStock = items.filter((it) => (it.stock ?? 0) > 0 && (it.stock ?? 0) <= 5);
    const emptyStock = items.filter((it) => (it.stock ?? 0) === 0);
    return { totalSku, totalStock, lowStock, emptyStock };
  }, [items]);

  const stats = useMemo(
    () => [
      {
        label: "Total SKU",
        value: String(summary.totalSku ?? 0),
        delta: "Semua kode terdaftar",
        icon: Boxes,
        tone: "from-slate-500/15 to-slate-700/10 text-slate-700",
      },
      {
        label: "Total stok (pcs)",
        value: String(summary.totalStock ?? 0),
        delta: "Jumlah seluruh item",
        icon: Warehouse,
        tone: "from-sky-500/15 to-sky-700/10 text-sky-700",
      },
      {
        label: "Stok menipis",
        value: String(summary.lowStock.length ?? 0),
        delta: "<= 5 pcs",
        icon: TrendingUp,
        tone: "from-amber-500/15 to-amber-700/10 text-amber-700",
      },
      {
        label: "Stok habis",
        value: String(summary.emptyStock.length ?? 0),
        delta: "Butuh restock",
        icon: ShieldCheck,
        tone: "from-rose-500/15 to-rose-700/10 text-rose-700",
      },
    ],
    [summary]
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
  ];
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50 text-slate-900">
        <SidebarNav active="dashboard" onNavigate={onNavigate} />
        <SidebarInset className="flex-1">
          <DashboardHeader onNavigate={onNavigate} />
          <main id="dashboard" className="px-4 py-6 md:px-6 md:py-8 space-y-6">
            <HeroStrip />

            <section
              id="inventory"
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            >
              {loading ? (
                <p className="text-sm text-muted-foreground md:col-span-4">
                  Memuat data stok...
                </p>
              ) : null}
              {error ? (
                <p className="text-sm text-red-600 md:col-span-4">{error}</p>
              ) : null}
              {stats.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </section>

            <section id="masuk" className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-3">
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
                    <Button variant="ghost" size="sm" onClick={() => onNavigate?.("riwayat")}>
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
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                          Belum ada data pergerakan. Catat barang masuk/keluar untuk melihat histori terbaru.
                        </TableCell>
                      </TableRow>
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
                      <p className="text-sm text-muted-foreground">
                        Monitor stok
                      </p>
                      <h3 className="text-lg font-semibold">Alert cepat</h3>
                    </div>
                    <Badge variant="outline" className="rounded-full px-3">
                      {alerts.length} alert
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {alerts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Tidak ada peringatan stok.
                      </p>
                    ) : (
                      alerts.map((alert) => (
                        <AlertCard key={alert.id} {...alert} />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>

            <div id="riwayat" className="h-px" aria-hidden />
            <div id="pengaturan" className="h-px" aria-hidden />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
