import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LoginCard } from "./components/auth/LoginCard";
import { LoginHero } from "./components/auth/LoginHero";
import { InventoryPage } from "./components/inventory/InventoryPage";
import { InboundPage } from "./components/inventory/InboundPage";
import { OutboundPage } from "./components/inventory/OutboundPage";
import {
  DashboardPage,
  SidebarNav,
  type AppNavKey,
} from "./components/dashboard/DashboardPage";
import { DraftsPage } from "./components/drafts/DraftsPage";
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
import { queryClient } from "./lib/react-query";

type View = "dashboard" | "inventory" | "masuk" | "keluar" | "drafts";

function Shell({
  title,
  view,
  userEmail,
  onNavigate,
  onLogout,
  logoutLoading,
  children,
}: {
  title: string;
  view: View;
  userEmail?: string;
  onNavigate: (key: AppNavKey) => void;
  onLogout: () => void;
  logoutLoading: boolean;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50 text-slate-900">
        <SidebarNav active={view} onNavigate={onNavigate} />
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

function App() {
  const [view, setView] = useState<View>(() =>
    window.location.hash === "#inventory"
      ? "inventory"
      : window.location.hash === "#masuk"
      ? "masuk"
      : window.location.hash === "#keluar"
      ? "keluar"
      : window.location.hash === "#drafts"
      ? "drafts"
      : "dashboard"
  );

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
    const onHashChange = () => {
      if (window.location.hash === "#inventory") {
        setView("inventory");
      } else if (window.location.hash === "#masuk") {
        setView("masuk");
      } else if (window.location.hash === "#keluar") {
        setView("keluar");
      } else if (window.location.hash === "#drafts") {
        setView("drafts");
      } else {
        setView("dashboard");
      }
    };
    window.addEventListener("hashchange", onHashChange);

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
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

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
    const map: Record<AppNavKey, View> = {
      dashboard: "dashboard",
      inventory: "inventory",
      masuk: "masuk",
      keluar: "keluar",
      drafts: "drafts",
      riwayat: "dashboard",
      pengaturan: "dashboard",
    };
    const next = map[key] ?? "dashboard";
    setView(next);
    window.location.hash = next === "dashboard" ? "#dashboard" : `#${next}`;
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
              brand="Jogja Drumband"
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
                    "Silakan hubungi admin untuk reset kata sandi sementara."
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
        onNavigate={handleNavigate}
        onLogout={() => logoutMutation.mutate()}
        logoutLoading={logoutMutation.isPending}
      >
        <DashboardPage onNavigate={handleNavigate} />
      </Shell>
    );
  }

  if (view === "inventory") {
    return (
      <Shell
        title="Inventory"
        view={view}
        userEmail={user?.email}
        onNavigate={handleNavigate}
        onLogout={() => logoutMutation.mutate()}
        logoutLoading={logoutMutation.isPending}
      >
        <InventoryPage />
      </Shell>
    );
  }

  if (view === "keluar") {
    return (
      <Shell
        title="Barang Keluar"
        view={view}
        userEmail={user?.email}
        onNavigate={handleNavigate}
        onLogout={() => logoutMutation.mutate()}
        logoutLoading={logoutMutation.isPending}
      >
        <OutboundPage />
      </Shell>
    );
  }

  if (view === "drafts") {
    return (
      <Shell
        title="Draft"
        view={view}
        userEmail={user?.email}
        onNavigate={handleNavigate}
        onLogout={() => logoutMutation.mutate()}
        logoutLoading={logoutMutation.isPending}
      >
        <DraftsPage />
      </Shell>
    );
  }

  return (
    <Shell
      title="Barang Masuk"
      view={view}
      userEmail={user?.email}
      onNavigate={handleNavigate}
      onLogout={() => logoutMutation.mutate()}
      logoutLoading={logoutMutation.isPending}
    >
      <InboundPage />
    </Shell>
  );
}

export default App;
