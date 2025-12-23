import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Checkbox } from "./components/ui/checkbox";
import { ensureSession, fetchMe, login, type User } from "./lib/auth";

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    enabled: false, // enabled after ensureSession or login
  });

  useEffect(() => {
    (async () => {
      const user = await ensureSession();
      if (user) {
        meQuery.refetch();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginMutation = useMutation({
    mutationFn: () => login({ email, password }),
    onSuccess: async () => {
      setPassword("");
      await meQuery.refetch();
    },
  });

  const user: User | undefined = meQuery.data;
  const loading = loginMutation.isPending || meQuery.isFetching;
  const errorMessage = loginMutation.error
    ? (loginMutation.error as Error).message || "Gagal masuk"
    : undefined;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left panel */}
        <div className="flex flex-col justify-between bg-slate-50 px-8 py-6 sm:px-12 sm:py-10">
          <div className="flex items-center gap-3 text-slate-800">
            <div className="flex size-9 items-center justify-center rounded-lg bg-sky-600 text-white font-semibold">
              JD
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Gudang
              </p>
              <p className="text-base font-semibold">Jogja Drumband</p>
            </div>
          </div>
          <div className="space-y-4 pb-10">
            <p className="text-4xl font-heading uppercase leading-none text-slate-800 sm:text-5xl">
              Rapi. Terpantau. Siap Dipakai.
            </p>
            <p className="text-sm leading-relaxed text-slate-600 max-w-lg">
              "Sistem ini bikin stok dan pergerakan alat drumband jauh lebih
              tertib. Peminjaman jadi tercatat rapi dan cepat." — Dewa, Admin
              Gudang
            </p>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md space-y-8">
            <div className="space-y-2 text-center">
              <h1 className="font-heading text-3xl uppercase tracking-wide text-slate-900">
                Masuk Akun
              </h1>
              <p className="text-sm text-slate-600">
                Gunakan akun admin atau petugas untuk masuk ke dashboard.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_16px_50px_-30px_rgba(37,99,235,0.35)]">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  loginMutation.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="nama@contoh.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-lg border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm focus-visible:border-sky-500 focus-visible:ring-sky-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Kata sandi</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-lg border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm focus-visible:border-sky-500 focus-visible:ring-sky-200"
                  />
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <label className="flex items-center gap-2 font-medium text-slate-700">
                    <Checkbox className="border-slate-300 data-[state=checked]:bg-sky-600 data-[state=checked]:border-sky-600" />
                    Ingat saya
                  </label>
                  <button
                    type="button"
                    className="font-medium text-sky-700 hover:text-sky-800"
                  >
                    Lupa sandi?
                  </button>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-sky-600 text-white hover:bg-sky-700 disabled:cursor-not-allowed shadow-md shadow-sky-200"
                >
                  {loading ? "Memproses..." : "Masuk"}
                </Button>
                {errorMessage ? (
                  <p className="text-center text-sm text-red-600">
                    {errorMessage}
                  </p>
                ) : null}
                {user ? (
                  <div className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-800">
                    <p className="font-semibold">Berhasil masuk</p>
                    <p>{user.email}</p>
                    <p className="text-xs uppercase tracking-wide text-sky-700">
                      Role: {user.role}
                    </p>
                  </div>
                ) : null}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
