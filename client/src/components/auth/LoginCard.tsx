import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { User } from "../../lib/auth";

type LoginCardProps = {
  email: string;
  password: string;
  loading: boolean;
  errorMessage?: string;
  user?: User;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onForgotPassword?: () => void;
};

export function LoginCard({
  email,
  password,
  loading,
  errorMessage,
  user,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onForgotPassword,
}: LoginCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_16px_50px_-30px_rgba(37,99,235,0.35)]">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
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
            onChange={(e) => onEmailChange(e.target.value)}
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
            onChange={(e) => onPasswordChange(e.target.value)}
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
            onClick={onForgotPassword}
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
          <p className="text-center text-sm text-red-600">{errorMessage}</p>
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
  );
}
