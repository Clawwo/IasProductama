import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LoginCard } from "./components/auth/LoginCard";
import { LoginHero } from "./components/auth/LoginHero";
import { InventoryPage } from "./components/inventory/InventoryPage";
import { InboundPage } from "./components/inventory/InboundPage";
import { OutboundPage } from "./components/inventory/OutboundPage";
import {
  DashboardPage,
  type AppNavKey,
} from "./components/dashboard/DashboardPage";
import { DraftsPage } from "./components/drafts/DraftsPage";
import { RiwayatPage } from "./components/history/RiwayatPage";
import { ProductionPage } from "./components/production/ProductionPage";
import { RawMaterialsOutboundTrackingPage } from "./components/raw/RawMaterialsOutboundTrackingPage";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ensureSession, fetchMe, login, logout, type User } from "./lib/auth";
import { LogOut } from "lucide-react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  History,
  LayoutDashboard,
  Box,
  Factory,
  PackageCheck,
  Users as UsersIcon,
} from "lucide-react";
import { queryClient } from "./lib/react-query";
import { UsersPage } from "./components/users/UsersPage";

type View =
  | "dashboard"
  | "inventory"
  | "masuk"
  | "keluar"
  | "bahan-keluar"
  | "produksi"
  | "drafts"
  | "riwayat"
  | "users";

function SidebarNav({
  active = "dashboard",
  onNavigate,
  userRole,
}: {
  active?: AppNavKey;
  onNavigate?: (key: AppNavKey) => void;
  userRole?: string;
}) {
  const isAdmin = userRole === "ADMIN";
  const isViewer = userRole === "PELIHAT";

  const items: Array<{
    key: AppNavKey;
    label: string;
    icon: typeof LayoutDashboard;
    href: string;
    adminOnly?: boolean;
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
    {
      key: "bahan-keluar",
      label: "Bahan Baku Keluar",
      icon: PackageCheck,
      href: "#bahan-keluar",
    },
    {
      key: "produksi",
      label: "Produksi",
      icon: Factory,
      href: "#produksi",
    },
    { key: "drafts", label: "Draft", icon: ClipboardList, href: "#drafts" },
    { key: "riwayat", label: "Riwayat", icon: History, href: "#riwayat" },
    {
      key: "users",
      label: "Pengguna",
      icon: UsersIcon,
      href: "#users",
      adminOnly: true,
    },
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <div className="bg-linear-to-br from-slate-900 to-slate-700 text-white grid size-9 place-items-center rounded-lg font-semibold shadow-sm">
            IP
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">
              Ias Productama
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
              {items
                .filter((item) => {
                  if (item.adminOnly && !isAdmin) return false;
                  if (isViewer) {
                    return ["dashboard", "inventory", "riwayat"].includes(
                      item.key,
                    );
                  }
                  return true;
                })
                .map((item) => (
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
            <History className="size-4" />
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

function Shell({
  title,
  view,
  userEmail,
  userRole,
  onNavigate,
  onLogout,
  logoutLoading,
  children,
}: {
  title: string;
  view: View;
  userEmail?: string;
  userRole?: string;
  onNavigate: (key: AppNavKey) => void;
  onLogout: () => void;
  logoutLoading: boolean;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50 text-slate-900">
        <SidebarNav active={view} onNavigate={onNavigate} userRole={userRole} />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-white/90 px-4 py-3 backdrop-blur md:px-6">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#dashboard">Beranda</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-3 text-sm text-slate-700">
              {userEmail ? (
                <span className="hidden sm:inline">{userEmail}</span>
              ) : null}
              <button
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-70"
                onClick={onLogout}
                disabled={logoutLoading}
              >
                <LogOut className="size-4" />
                {logoutLoading ? "Keluar..." : "Logout"}
              </button>
            </div>
          </header>
          <main className="px-4 py-6 md:px-6 md:py-8">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function resolveViewFromHash(hash: string, role?: string): View {
  const key = (hash || "#dashboard").replace(/^#/, "");
  const allowed: Record<string, View> = {
    dashboard: "dashboard",
    inventory: "inventory",
    masuk: role === "PELIHAT" ? "dashboard" : "masuk",
    keluar: role === "PELIHAT" ? "dashboard" : "keluar",
    "bahan-keluar": role === "PELIHAT" ? "dashboard" : "bahan-keluar",
    produksi: role === "PELIHAT" ? "dashboard" : "produksi",
    drafts: role === "PELIHAT" ? "dashboard" : "drafts",
    riwayat: "riwayat",
    users: role === "ADMIN" ? "users" : "dashboard",
  };
  return allowed[key] ?? "dashboard";
}

function App() {
  const [view, setView] = useState<View>("dashboard");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [authLoading, setAuthLoading] = useState(true);

  const { data: user } = useQuery<User>({
    queryKey: ["me"],
    queryFn: fetchMe,
    enabled: false,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      const current = await ensureSession();
      if (mounted && current) {
        queryClient.setQueryData(["me"], current);
        setEmail((prev) => (prev ? prev : current.email));
      }
      if (mounted) setAuthLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const applyHash = () => {
      setView(resolveViewFromHash(window.location.hash, user?.role));
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [user?.role]);

  const loginMutation = useMutation({
    mutationFn: () => login({ email, password }),
    onSuccess: (data) => {
      queryClient.setQueryData(["me"], data.user);
      setErrorMessage(undefined);
      setView("dashboard");
      window.location.hash = "#dashboard";
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Login gagal";
      setErrorMessage(message);
    },
  });

  const loading = loginMutation.isPending;

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["me"] });
      setView("dashboard");
      window.location.hash = "#dashboard";
    },
  });

  const handleNavigate = (key: AppNavKey) => {
    const isViewer = user?.role === "PELIHAT";

    if (key === "users" && user?.role !== "ADMIN") {
      setView("dashboard");
      window.location.hash = "#dashboard";
      return;
    }

    const viewerBlocked: AppNavKey[] = [
      "masuk",
      "keluar",
      "bahan-keluar",
      "produksi",
      "drafts",
    ];

    if (isViewer && viewerBlocked.includes(key)) {
      setView("dashboard");
      window.location.hash = "#dashboard";
      return;
    }
    const map: Record<AppNavKey, View> = {
      dashboard: "dashboard",
      inventory: "inventory",
      masuk: "masuk",
      keluar: "keluar",
      "bahan-keluar": "bahan-keluar",
      produksi: "produksi",
      drafts: "drafts",
      riwayat: "riwayat",
      users: "users",
    };
    const next = map[key] ?? "dashboard";
    setView(next);
    const hash = next === "dashboard" ? "#dashboard" : `#${next}`;
    window.location.hash = hash;
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-800">
        Memeriksa sesi...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-white text-slate-900">
        <div className="flex min-h-screen w-full overflow-hidden border-y border-slate-200 shadow-xl shadow-sky-100 md:rounded-none md:border-x-0">
          <div className="hidden w-1/2 border-r border-slate-200 md:flex">
            <LoginHero
              brand="IasProductama"
              subtitle="Sistem ini bikin stok dan pergerakan alat drumband tertib. Peminjaman jadi tercatat rapi dan cepat."
              title="Rapi. Terpantau. Siap Dipakai."
              quote="Sistem ini bikin stok dan pergerakan alat drumband jauh lebih tertib. Peminjaman jadi tercatat rapi dan cepat."
              author="Dewa, Admin Gudang"
            />
          </div>

          <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
            <div className="w-full max-w-md space-y-8">
              <div className="space-y-2 text-center">
                <h1 className="font-heading text-3xl uppercase tracking-wide text-slate-900">
                  Masuk Akun
                </h1>
                <p className="text-sm text-slate-600">
                  Gunakan akun admin atau petugas untuk masuk ke dashboard.
                </p>
              </div>

              <LoginCard
                email={email}
                password={password}
                loading={loading}
                errorMessage={errorMessage}
                user={user}
                onEmailChange={(value) => {
                  setEmail(value);
                  if (errorMessage) setErrorMessage(undefined);
                }}
                onPasswordChange={(value) => {
                  setPassword(value);
                  if (errorMessage) setErrorMessage(undefined);
                }}
                onSubmit={() => loginMutation.mutate()}
                onForgotPassword={() =>
                  setErrorMessage(
                    "Silakan hubungi admin untuk reset kata sandi sementara.",
                  )
                }
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "dashboard") {
    return (
      <Shell
        title="Dashboard"
        view={view}
        userEmail={user?.email}
        userRole={user?.role}
        onNavigate={handleNavigate}
        onLogout={() => logoutMutation.mutate()}
        logoutLoading={logoutMutation.isPending}
      >
        <DashboardPage onNavigate={handleNavigate} />
      </Shell>
    );
  }

  if (view === "users") {
    return (
      <Shell
        title="Pengguna"
        view={view}
        userEmail={user?.email}
        userRole={user?.role}
        onNavigate={handleNavigate}
        onLogout={() => logoutMutation.mutate()}
        logoutLoading={logoutMutation.isPending}
      >
        {user?.role === "ADMIN" ? (
          <UsersPage />
        ) : (
          <div className="rounded-lg border bg-white p-6 text-sm text-slate-700">
            Akses halaman pengguna khusus admin.
          </div>
        )}
      </Shell>
    );
  }

  if (view === "inventory") {
    return (
      <Shell
        title="Inventory"
        view={view}
        userEmail={user?.email}
        userRole={user?.role}
        onNavigate={handleNavigate}
        onLogout={() => logoutMutation.mutate()}
        logoutLoading={logoutMutation.isPending}
      >
        <InventoryPage readOnly={user?.role === "PELIHAT"} />
      </Shell>
    );
  }

  if (view === "keluar") {
    return (
      <Shell
        title="Barang Keluar"
        view={view}
        userEmail={user?.email}
        userRole={user?.role}
        onNavigate={handleNavigate}
        onLogout={() => logoutMutation.mutate()}
        logoutLoading={logoutMutation.isPending}
      >
        {user?.role === "PELIHAT" ? (
          <div className="rounded-lg border bg-white p-6 text-sm text-slate-700">
            Akses transaksi barang keluar dibatasi untuk petugas atau admin.
          </div>
        ) : (
          <OutboundPage />
        )}
      </Shell>
    );
  }

  if (view === "bahan-keluar") {
    return (
      <Shell
        title="Bahan Baku Keluar"
        view={view}
        userEmail={user?.email}
        userRole={user?.role}
        onNavigate={handleNavigate}
        onLogout={() => logoutMutation.mutate()}
        logoutLoading={logoutMutation.isPending}
      >
        {user?.role === "PELIHAT" ? (
          <div className="rounded-lg border bg-white p-6 text-sm text-slate-700">
            Akses transaksi bahan baku keluar dibatasi untuk petugas atau admin.
          </div>
        ) : (
          <RawMaterialsOutboundTrackingPage />
        )}
      </Shell>
    );
  }

  if (view === "drafts") {
    return (
      <Shell
        title="Draft"
        view={view}
        userEmail={user?.email}
        userRole={user?.role}
        onNavigate={handleNavigate}
        onLogout={() => logoutMutation.mutate()}
        logoutLoading={logoutMutation.isPending}
      >
        {user?.role === "PELIHAT" ? (
          <div className="rounded-lg border bg-white p-6 text-sm text-slate-700">
            Akses draft dibatasi untuk petugas atau admin.
          </div>
        ) : (
          <DraftsPage />
        )}
      </Shell>
    );
  }

  if (view === "riwayat") {
    return (
      <Shell
        title="Riwayat"
        view={view}
        userEmail={user?.email}
        userRole={user?.role}
        onNavigate={handleNavigate}
        onLogout={() => logoutMutation.mutate()}
        logoutLoading={logoutMutation.isPending}
      >
        <RiwayatPage />
      </Shell>
    );
  }

  if (view === "produksi") {
    return (
      <Shell
        title="Produksi"
        view={view}
        userEmail={user?.email}
        userRole={user?.role}
        onNavigate={handleNavigate}
        onLogout={() => logoutMutation.mutate()}
        logoutLoading={logoutMutation.isPending}
      >
        {user?.role === "PELIHAT" ? (
          <div className="rounded-lg border bg-white p-6 text-sm text-slate-700">
            Akses produksi dibatasi untuk petugas atau admin.
          </div>
        ) : (
          <ProductionPage />
        )}
      </Shell>
    );
  }

  return (
    <Shell
      title="Barang Masuk"
      view={view}
      userEmail={user?.email}
      userRole={user?.role}
      onNavigate={handleNavigate}
      onLogout={() => logoutMutation.mutate()}
      logoutLoading={logoutMutation.isPending}
    >
      <InboundPage />
    </Shell>
  );
}

export default App;
