import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Save,
  CheckCircle,
  Trash2,
  Calendar,
  Truck,
  StickyNote,
  Search,
} from "lucide-react";
import { inventoryItemsWithKind } from "./items";

const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";
const INBOUND_URL = `${
  API_BASE ? API_BASE.replace(/\/$/, "") : ""
}/api/inbound`;

function getInchSize(text: string): string | null {
  const match = /([0-9]+(?:\.[0-9]+)?)\s*''/.exec(text);
  return match ? match[1] : null;
}

function getCmSize(text: string): string | null {
  const match = /([0-9]+(?:\.[0-9]+)?)\s*cm/i.exec(text);
  return match ? match[1] : null;
}

function getRingHoles(text: string): string | null {
  const match = /lubang\s*([0-9]+)/i.exec(text);
  return match ? match[1] : null;
}

function getRingColor(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("hitam")) return "Hitam";
  if (lower.includes("chrome") || lower.includes("chr")) return "Chrome";
  return null;
}

function getBodyKindLabel(kind?: string): string | null {
  switch (kind) {
    case "BODY-SNARE":
      return "Snare";
    case "BODY-TOM":
      return "Tom";
    case "BODY-BASS":
      return "Bass";
    case "BODY-GENERAL":
      return "General";
    default:
      return null;
  }
}

function sortNumericStrings(values: string[]) {
  return values.sort((a, b) => parseFloat(a) - parseFloat(b));
}

type LineItem = {
  id: string;
  code: string;
  name: string;
  qty: number;
  note?: string;
};

export function InboundPage() {
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [lineItem, setLineItem] = useState({
    code: "",
    name: "",
    qty: 1,
    note: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [ringSub, setRingSub] = useState<"all" | "SNARE" | "TOM">("all");
  const [ringSize, setRingSize] = useState("all");
  const [ringHole, setRingHole] = useState("all");
  const [ringColor, setRingColor] = useState("all");
  const [bodyKind, setBodyKind] = useState("all");
  const [bodySize, setBodySize] = useState("all");
  const [headSize, setHeadSize] = useState("all");
  const [lugSize, setLugSize] = useState("all");
  const [pipeLength, setPipeLength] = useState("all");
  const [packSize, setPackSize] = useState("all");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [formError, setFormError] = useState<string>("");
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [submitMessage, setSubmitMessage] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const categories = useMemo(() => {
    const set = new Set<string>();
    inventoryItemsWithKind.forEach((it) => set.add(it.category));
    return ["all", ...Array.from(set).sort()];
  }, []);

  const ringSubOptions = useMemo(() => {
    const set = new Set<string>();
    inventoryItemsWithKind.forEach((it) => {
      if (it.category === "Ring" && it.subCategory) set.add(it.subCategory);
    });
    return ["all", ...Array.from(set)] as Array<"all" | "SNARE" | "TOM">;
  }, []);

  const ringSizeOptions = useMemo(() => {
    const set = new Set<string>();
    inventoryItemsWithKind.forEach((it) => {
      if (it.category === "Ring") {
        const size = getInchSize(it.name);
        if (size) set.add(size);
      }
    });
    return ["all", ...sortNumericStrings(Array.from(set))];
  }, []);

  const ringHoleOptions = useMemo(() => {
    const set = new Set<string>();
    inventoryItemsWithKind.forEach((it) => {
      if (it.category === "Ring") {
        const hole = getRingHoles(it.name);
        if (hole) set.add(hole);
      }
    });
    return ["all", ...Array.from(set).sort()];
  }, []);

  const ringColorOptions = useMemo(() => {
    const set = new Set<string>();
    inventoryItemsWithKind.forEach((it) => {
      if (it.category === "Ring") {
        const color = getRingColor(it.name);
        if (color) set.add(color);
      }
    });
    return ["all", ...Array.from(set)];
  }, []);

  const bodyKindOptions = useMemo(() => {
    const set = new Set<string>();
    inventoryItemsWithKind.forEach((it) => {
      if (it.category === "Body") {
        const label = getBodyKindLabel(it.kind);
        if (label) set.add(label);
      }
    });
    return ["all", ...Array.from(set)];
  }, []);

  const bodySizeOptions = useMemo(() => {
    const set = new Set<string>();
    inventoryItemsWithKind.forEach((it) => {
      if (it.category === "Body") {
        const size = getInchSize(it.name);
        if (size) set.add(size);
      }
    });
    return ["all", ...sortNumericStrings(Array.from(set))];
  }, []);

  const headSizeOptions = useMemo(() => {
    const set = new Set<string>();
    inventoryItemsWithKind.forEach((it) => {
      if (it.category === "Head") {
        const size = getInchSize(it.name);
        if (size) set.add(size);
      }
    });
    return ["all", ...sortNumericStrings(Array.from(set))];
  }, []);

  const lugSizeOptions = useMemo(() => {
    const set = new Set<string>();
    inventoryItemsWithKind.forEach((it) => {
      if (it.category === "Lug") {
        const size = getCmSize(it.name);
        if (size) set.add(size);
      }
    });
    return ["all", ...sortNumericStrings(Array.from(set))];
  }, []);

  const pipeLengthOptions = useMemo(() => {
    const set = new Set<string>();
    inventoryItemsWithKind.forEach((it) => {
      if (it.category === "Pipe") {
        const len = getCmSize(it.name);
        if (len) set.add(len);
      }
    });
    return ["all", ...sortNumericStrings(Array.from(set))];
  }, []);

  const packSizeOptions = useMemo(() => {
    const set = new Set<string>();
    inventoryItemsWithKind.forEach((it) => {
      if (it.category === "Pack") {
        const size = getInchSize(it.name);
        if (size) set.add(size);
      }
    });
    return ["all", ...sortNumericStrings(Array.from(set))];
  }, []);

  const totals = useMemo(() => {
    const totalItem = lines.length;
    const totalQty = lines.reduce((sum, l) => sum + l.qty, 0);
    return { totalItem, totalQty };
  }, [lines]);

  useEffect(() => {
    setRingSub("all");
    setRingSize("all");
    setRingHole("all");
    setRingColor("all");
    setBodyKind("all");
    setBodySize("all");
    setHeadSize("all");
    setLugSize("all");
    setPipeLength("all");
    setPackSize("all");
  }, [selectedCategory]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [
    searchTerm,
    selectedCategory,
    ringSub,
    ringSize,
    ringHole,
    ringColor,
    bodyKind,
    bodySize,
    headSize,
    lugSize,
    pipeLength,
    packSize,
  ]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return inventoryItemsWithKind.filter((it) => {
      if (selectedCategory !== "all" && it.category !== selectedCategory)
        return false;

      if (selectedCategory === "Ring") {
        if (ringSub !== "all" && it.subCategory !== ringSub) return false;
        const size = getInchSize(it.name);
        if (ringSize !== "all" && ringSize !== size) return false;
        const holes = getRingHoles(it.name);
        if (ringHole !== "all" && ringHole !== holes) return false;
        const color = getRingColor(it.name);
        if (ringColor !== "all" && ringColor !== color) return false;
      }

      if (selectedCategory === "Body") {
        const kindLabel = getBodyKindLabel(it.kind);
        if (bodyKind !== "all" && bodyKind !== kindLabel) return false;
        const size = getInchSize(it.name);
        if (bodySize !== "all" && bodySize !== size) return false;
      }

      if (selectedCategory === "Head") {
        const size = getInchSize(it.name);
        if (headSize !== "all" && headSize !== size) return false;
      }

      if (selectedCategory === "Lug") {
        const size = getCmSize(it.name);
        if (lugSize !== "all" && lugSize !== size) return false;
      }

      if (selectedCategory === "Pipe") {
        const len = getCmSize(it.name);
        if (pipeLength !== "all" && pipeLength !== len) return false;
      }

      if (selectedCategory === "Pack") {
        const size = getInchSize(it.name);
        if (packSize !== "all" && packSize !== size) return false;
      }

      if (!term) return true;
      return (
        it.name.toLowerCase().includes(term) ||
        it.code.toLowerCase().includes(term)
      );
    });
  }, [
    selectedCategory,
    ringSub,
    ringSize,
    ringHole,
    ringColor,
    bodyKind,
    bodySize,
    headSize,
    lugSize,
    pipeLength,
    packSize,
    searchTerm,
  ]);

  const filterControls: React.ReactNode[] = useMemo(() => {
    if (selectedCategory === "Ring") {
      return [
        <FilterDropdown
          key="ring-sub"
          label="Model"
          value={ringSub}
          options={ringSubOptions}
          onSelect={setRingSub}
        />,
        <FilterDropdown
          key="ring-size"
          label="Ukuran"
          value={ringSize}
          options={ringSizeOptions}
          onSelect={setRingSize}
        />,
        <FilterDropdown
          key="ring-hole"
          label="Lubang"
          value={ringHole}
          options={ringHoleOptions}
          onSelect={setRingHole}
        />,
        <FilterDropdown
          key="ring-color"
          label="Warna"
          value={ringColor}
          options={ringColorOptions}
          onSelect={setRingColor}
        />,
      ];
    }

    if (selectedCategory === "Body") {
      return [
        <FilterDropdown
          key="body-kind"
          label="Jenis"
          value={bodyKind}
          options={bodyKindOptions}
          onSelect={setBodyKind}
        />,
        <FilterDropdown
          key="body-size"
          label="Ukuran"
          value={bodySize}
          options={bodySizeOptions}
          onSelect={setBodySize}
        />,
      ];
    }

    if (selectedCategory === "Head") {
      return [
        <FilterDropdown
          key="head-size"
          label="Ukuran"
          value={headSize}
          options={headSizeOptions}
          onSelect={setHeadSize}
        />,
      ];
    }

    if (selectedCategory === "Lug") {
      return [
        <FilterDropdown
          key="lug-size"
          label="Panjang"
          value={lugSize}
          options={lugSizeOptions}
          onSelect={setLugSize}
        />,
      ];
    }

    if (selectedCategory === "Pipe") {
      return [
        <FilterDropdown
          key="pipe-length"
          label="Panjang"
          value={pipeLength}
          options={pipeLengthOptions}
          onSelect={setPipeLength}
        />,
      ];
    }

    if (selectedCategory === "Pack") {
      return [
        <FilterDropdown
          key="pack-size"
          label="Ukuran"
          value={packSize}
          options={packSizeOptions}
          onSelect={setPackSize}
        />,
      ];
    }

    return [];
  }, [
    selectedCategory,
    ringSub,
    ringSize,
    ringHole,
    ringColor,
    ringSubOptions,
    ringSizeOptions,
    ringHoleOptions,
    ringColorOptions,
    bodyKind,
    bodySize,
    headSize,
    lugSize,
    pipeLength,
    packSize,
    bodyKindOptions,
    bodySizeOptions,
    headSizeOptions,
    lugSizeOptions,
    pipeLengthOptions,
    packSizeOptions,
  ]);

  const gridTemplateColumns = useMemo(() => {
    const cols = [
      "1.1fr",
      ...filterControls.map(() => "1fr"),
      "2fr",
      "1.4fr",
      "0.6fr",
      "auto",
    ];
    return cols.join(" ");
  }, [filterControls]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, 50),
    [filteredItems]
  );

  function addLine() {
    if (!lineItem.code || !lineItem.name) {
      setFormError("Pilih barang terlebih dahulu.");
      return;
    }
    if (lineItem.qty <= 0) {
      setFormError("Qty harus lebih dari 0.");
      return;
    }
    const newNote = lineItem.note.trim();
    setLines((prev) => {
      const existing = prev.find((l) => l.code === lineItem.code);
      if (existing) {
        return prev.map((l) => {
          if (l.code !== lineItem.code) return l;
          const combinedNote = newNote
            ? l.note
              ? `${l.note} | ${newNote}`
              : newNote
            : l.note;
          return { ...l, qty: l.qty + lineItem.qty, note: combinedNote };
        });
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          code: lineItem.code,
          name: lineItem.name,
          qty: lineItem.qty,
          note: newNote || undefined,
        },
      ];
    });
    setLineItem({ code: "", name: "", qty: 1, note: "" });
    setSearchTerm("");
    setFormError("");
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  async function handleComplete() {
    if (!vendor.trim()) {
      setFormError("Isi pemasok/pengirim terlebih dahulu.");
      return;
    }
    if (!date) {
      setFormError("Tanggal tidak boleh kosong.");
      return;
    }
    if (lines.length === 0) {
      setFormError("Tambah minimal 1 baris barang.");
      return;
    }

    const payload = {
      vendor: vendor.trim(),
      date,
      note: note.trim() || undefined,
      lines: lines.map((l) => ({ code: l.code, qty: l.qty, note: l.note })),
    };

    try {
      setSubmitStatus("loading");
      setSubmitMessage("");
      setFormError("");
      const res = await fetch(INBOUND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Gagal menyimpan");
      }
      setSubmitStatus("success");
      setSubmitMessage("Berhasil disimpan.");
    } catch (err: any) {
      setSubmitStatus("error");
      setSubmitMessage(err?.message || "Gagal menyimpan.");
    }
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6 text-slate-900 md:px-6 md:py-8">
      <div className="space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                Gudang
              </p>
              <h1 className="text-3xl font-semibold text-slate-900 leading-tight">
                Barang Masuk
              </h1>
              <p className="text-sm text-slate-600">
                Catat penerimaan stok baru atau retur vendor dengan detail yang
                terstruktur.
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full px-3">
                Draft
              </Badge>
              <Button
                variant="outline"
                className="border-dashed"
                disabled={submitStatus === "loading"}
              >
                <Save className="mr-2 size-4" /> Simpan draft
              </Button>
              <Button
                onClick={handleComplete}
                disabled={submitStatus === "loading"}
              >
                <CheckCircle className="mr-2 size-4" /> Tandai selesai
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Status Draft"
              value="Aktif"
              sub="Belum diposting"
            />
            <SummaryCard
              label="Total item"
              value={String(totals.totalItem)}
              sub="Baris diterima"
            />
            <SummaryCard
              label="Total qty (pcs)"
              value={String(totals.totalQty)}
              sub="Semua baris"
            />
            <SummaryCard
              label="Tanggal"
              value={date || "-"}
              sub="Tanggal penerimaan"
            />
          </div>
        </header>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <LabeledInput
              label="Tanggal masuk"
              icon={<Calendar className="size-4" />}
            >
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </LabeledInput>
            <LabeledInput
              label="Pemasok / pengirim"
              icon={<Truck className="size-4" />}
            >
              <Input
                placeholder="Nama vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
            </LabeledInput>
            <LabeledInput
              label="Catatan"
              icon={<StickyNote className="size-4" />}
            >
              <Input
                placeholder="Opsional"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </LabeledInput>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Baris barang
              </p>
              <p className="text-sm text-slate-600">
                Tambahkan setiap barang yang diterima beserta jumlahnya.
              </p>
            </div>
          </div>

          <div
            className="grid grid-cols-1 gap-3 md:items-end md:[grid-template-columns:var(--cols)]"
            style={{ ["--cols" as string]: gridTemplateColumns }}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="justify-between">
                  <span className="truncate text-left">
                    {selectedCategory === "all"
                      ? "Semua kategori"
                      : selectedCategory}
                  </span>
                  <Search className="size-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Pilih kategori</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {categories.map((cat) => (
                  <DropdownMenuItem
                    key={cat}
                    onSelect={() => {
                      setSelectedCategory(cat);
                    }}
                  >
                    <span className="truncate" title={cat}>
                      {cat}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {filterControls.map((control) => control)}

            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="justify-between">
                  <span className="truncate text-left">
                    {lineItem.name
                      ? `${lineItem.code} — ${lineItem.name}`
                      : "Pilih / cari barang"}
                  </span>
                  <Search className="size-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[360px] p-0">
                <div className="p-2">
                  <Input
                    autoFocus
                    placeholder="Ketik nama atau kode"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHighlightIndex((idx) =>
                          Math.min(
                            idx + 1,
                            Math.max(visibleItems.length - 1, 0)
                          )
                        );
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHighlightIndex((idx) => Math.max(idx - 1, 0));
                        return;
                      }
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const target = visibleItems[highlightIndex];
                        if (target) {
                          setLineItem((l) => ({
                            ...l,
                            code: target.code,
                            name: target.name,
                          }));
                          setDropdownOpen(false);
                        }
                      }
                    }}
                    className="h-9"
                  />
                </div>
                <DropdownMenuSeparator />
                <div className="max-h-64 overflow-y-auto">
                  {visibleItems.map((it, idx) => (
                    <DropdownMenuItem
                      key={it.code}
                      className={
                        highlightIndex === idx ? "bg-slate-100" : undefined
                      }
                      onSelect={() => {
                        setLineItem((l) => ({
                          ...l,
                          code: it.code,
                          name: it.name,
                        }));
                        setDropdownOpen(false);
                      }}
                    >
                      <div className="flex flex-col">
                        <span
                          className="font-semibold text-slate-900 truncate max-w-[280px]"
                          title={it.code}
                        >
                          {it.code}
                        </span>
                        <span
                          className="text-xs text-slate-600 truncate max-w-[280px]"
                          title={it.name}
                        >
                          {it.name}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  {filteredItems.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-slate-500">
                      Barang tidak ditemukan.
                    </div>
                  ) : null}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <Input
              placeholder="Catatan baris (opsional)"
              value={lineItem.note}
              onChange={(e) =>
                setLineItem((l) => ({ ...l, note: e.target.value }))
              }
            />
            <Input
              type="number"
              min={1}
              value={lineItem.qty}
              onChange={(e) =>
                setLineItem((l) => ({ ...l, qty: Number(e.target.value) }))
              }
            />
            <Button onClick={addLine}>
              <Plus className="mr-2 size-4" /> Tambah baris
            </Button>
          </div>

          {formError ? (
            <div className="text-sm text-red-600">{formError}</div>
          ) : null}
          {submitStatus === "success" ? (
            <div className="text-sm text-green-600">
              {submitMessage || "Berhasil disimpan."}
            </div>
          ) : null}
          {submitStatus === "error" ? (
            <div className="text-sm text-red-600">
              {submitMessage || "Gagal menyimpan."}
            </div>
          ) : null}

          <Separator />

          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-12">No</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead>Nama Barang</TableHead>
                <TableHead className="w-32">Qty (pcs)</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, idx) => (
                <TableRow key={line.id}>
                  <TableCell className="text-slate-500">{idx + 1}</TableCell>
                  <TableCell className="font-semibold text-slate-900">
                    {line.code}
                  </TableCell>
                  <TableCell className="text-slate-800">{line.name}</TableCell>
                  <TableCell className="font-semibold">{line.qty}</TableCell>
                  <TableCell className="text-slate-600">
                    {line.note || "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-red-600"
                      onClick={() => removeLine(line.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-sm text-slate-500"
                  >
                    Belum ada baris. Tambahkan barang masuk di atas.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </section>
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
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub ? <p className="text-sm text-slate-600">{sub}</p> : null}
    </div>
  );
}

function LabeledInput({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-2">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function FilterDropdown({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="justify-between">
          <span className="truncate text-left">
            {value === "all" ? `${label}: semua` : `${label}: ${value}`}
          </span>
          <Search className="size-4 text-slate-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((opt) => (
          <DropdownMenuItem key={opt} onSelect={() => onSelect(opt)}>
            {opt === "all" ? "Semua" : opt}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
