import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, type User } from "@/lib/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Users as UsersIcon,
  Pencil,
  Trash2,
  Check,
  X,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

async function fetchUsers(q: string) {
  const { data } = await api.get<User[]>("/users", {
    params: q ? { q } : undefined,
  });
  return data;
}

function RoleBadge({ role }: { role: string }) {
  const tone =
    role === "ADMIN"
      ? "border-green-200 bg-green-50 text-green-800"
      : role === "PETUGAS"
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : "border-slate-200 bg-slate-50 text-slate-800";
  return (
    <Badge className={`rounded-full px-3 py-1 text-xs ${tone}`}>{role}</Badge>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">
      Aktif
    </Badge>
  ) : (
    <Badge className="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-700">
      Nonaktif
    </Badge>
  );
}

export function UsersPage() {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "PETUGAS" as User["role"],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "PETUGAS" as User["role"],
    isActive: true,
    password: "",
  });

  const fetchUsersQuery = useQuery({
    queryKey: ["users", search],
    queryFn: () => fetchUsers(search),
  });

  const { data, isLoading, isError, error } = fetchUsersQuery;

  const createUser = useMutation({
    mutationFn: async () => {
      const payload = {
        email: form.email.trim(),
        name: form.name.trim() || undefined,
        password: form.password,
        role: form.role,
      } satisfies Partial<User> & {
        email: string;
        password: string;
        role: string;
      };
      await api.post("/users", payload);
    },
    onSuccess: async () => {
      toast.success("Pengguna berhasil ditambahkan");
      setForm({ email: "", name: "", password: "", role: "PETUGAS" });
      await fetchUsersQuery.refetch();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Gagal menambah pengguna";
      toast.error(message);
    },
  });

  const updateUser = useMutation({
    mutationFn: async (id: string) => {
      const payload: Record<string, unknown> = {
        name: editForm.name.trim() || undefined,
        role: editForm.role,
        isActive: editForm.isActive,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }
      await api.patch(`/users/${id}`, payload);
    },
    onSuccess: async () => {
      toast.success("Pengguna diperbarui");
      setEditingId(null);
      setEditForm({ name: "", role: "PETUGAS", isActive: true, password: "" });
      await fetchUsersQuery.refetch();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Gagal memperbarui pengguna";
      toast.error(message);
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: async () => {
      toast.success("Pengguna dihapus");
      if (editingId) setEditingId(null);
      await fetchUsersQuery.refetch();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus pengguna";
      toast.error(message);
    },
  });

  const users = useMemo(() => data ?? [], [data]);

  const canSubmit =
    form.email.trim() !== "" && form.password.length >= 6 && form.role !== "";

  if (isError) {
    const message =
      error instanceof Error ? error.message : "Gagal memuat data pengguna";
    return (
      <Alert variant="destructive">
        <AlertTitle>Gagal memuat</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Administrasi
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <UsersIcon className="size-5" />
            Data Pengguna
          </h1>
          <p className="text-sm text-slate-600">
            Hanya admin yang dapat melihat daftar pengguna dan perannya.
          </p>
        </div>
        <div className="bg-slate-50 text-sm text-slate-700 flex items-center gap-2 rounded-lg border px-3 py-2">
          <Shield className="size-4" />
          Admin-only
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2 top-2.5 size-4 text-slate-400" />
          <Input
            placeholder="Cari email/nama"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          Total: {isLoading ? "…" : users.length}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tambah Pengguna</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSubmit || createUser.isPending) return;
              createUser.mutate();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                placeholder="Nama pengguna"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimal 6 karakter"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                required
                minLength={6}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="role">Role</Label>
              <Select
                value={form.role}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, role: value as User["role"] }))
                }
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="PETUGAS">PETUGAS</SelectItem>
                  <SelectItem value="PELIHAT">PELIHAT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <Button
                type="submit"
                disabled={!canSubmit || createUser.isPending}
              >
                {createUser.isPending ? "Menyimpan..." : "Tambah Pengguna"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Daftar Pengguna</CardTitle>
          <div className="text-sm text-muted-foreground">
            Total: {isLoading ? "…" : users.length}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead>Diperbarui</TableHead>
                    <TableHead className="w-48">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>
                        {editingId === u.id ? (
                          <Input
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                name: e.target.value,
                              }))
                            }
                            placeholder="Nama"
                          />
                        ) : (
                          (u.name ?? "-")
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === u.id ? (
                          <Select
                            value={editForm.role}
                            onValueChange={(value) =>
                              setEditForm((f) => ({
                                ...f,
                                role: value as User["role"],
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ADMIN">ADMIN</SelectItem>
                              <SelectItem value="PETUGAS">PETUGAS</SelectItem>
                              <SelectItem value="PELIHAT">PELIHAT</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <RoleBadge role={u.role} />
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === u.id ? (
                          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300"
                              checked={editForm.isActive}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  isActive: e.target.checked,
                                }))
                              }
                            />
                            Aktif
                          </label>
                        ) : (
                          <StatusBadge isActive={u.isActive} />
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(u.createdAt).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        {new Date(u.updatedAt).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {editingId === u.id ? (
                          <div className="mt-2">
                            <Input
                              type="password"
                              placeholder="Ubah password (opsional)"
                              value={editForm.password}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  password: e.target.value,
                                }))
                              }
                            />
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {editingId === u.id ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              disabled={updateUser.isPending}
                              onClick={() => updateUser.mutate(u.id)}
                            >
                              <Check className="size-4" /> Simpan
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditingId(null);
                                setEditForm({
                                  name: "",
                                  role: "PETUGAS",
                                  isActive: true,
                                  password: "",
                                });
                              }}
                            >
                              <X className="size-4" /> Batal
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(u.id);
                                setEditForm({
                                  name: u.name ?? "",
                                  role: u.role,
                                  isActive: u.isActive,
                                  password: "",
                                });
                              }}
                            >
                              <Pencil className="size-4" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={deleteUser.isPending}
                              onClick={() => {
                                if (confirm(`Hapus pengguna ${u.email}?`)) {
                                  deleteUser.mutate(u.id);
                                }
                              }}
                            >
                              <Trash2 className="size-4" /> Hapus
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!users.length && !isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-sm text-muted-foreground"
                      >
                        Belum ada pengguna terdaftar.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
