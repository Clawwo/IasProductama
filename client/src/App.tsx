import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LoginCard } from "./components/auth/LoginCard";
import { LoginHero } from "./components/auth/LoginHero";
import { InventoryPage } from "./components/inventory/InventoryPage";
import { InboundPage } from "./components/inventory/InboundPage";
import {
  DashboardPage,
  SidebarNav,
  type AppNavKey,
} from "./components/dashboard/DashboardPage";
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
import { ensureSession, fetchMe, login, type User } from "./lib/auth";
import { queryClient } from "./lib/react-query";

function App() {
  type View = "dashboard" | "inventory" | "masuk";

  const [view, setView] = useState<View>(() =>
    window.location.hash === "#inventory"
      ? "inventory"
      : window.location.hash === "#masuk"
      ? "masuk"
      : "dashboard"
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

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
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Login gagal";
      setErrorMessage(message);
    },
  });

  const loading = loginMutation.isPending;

  const handleNavigate = (key: AppNavKey) => {
    const map: Record<AppNavKey, View> = {
      dashboard: "dashboard",
      inventory: "inventory",
      masuk: "masuk",
      keluar: "inventory",
      riwayat: "dashboard",
      pengaturan: "dashboard",
    };
    const next = map[key] ?? "dashboard";
    setView(next);
    window.location.hash = next === "dashboard" ? "#dashboard" : `#${next}`;
  };

  const Shell = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50 text-slate-900">
        <SidebarNav active={view} onNavigate={handleNavigate} />
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
          </header>
          <main className="px-4 py-6 md:px-6 md:py-8">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );

  if (view === "dashboard") {
    return <DashboardPage onNavigate={handleNavigate} />;
  }

  if (view === "inventory") {
    return (
      <Shell title="Inventory">
        <InventoryPage />
      </Shell>
    );
  }

  return (
    <Shell title="Barang Masuk">
      <InboundPage />
    </Shell>
  );

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

export default App;
