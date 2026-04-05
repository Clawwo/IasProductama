export const ITEM_UNIT_OPTIONS = ["PCS", "GRAM", "METER"] as const;

export type ItemUnit = (typeof ITEM_UNIT_OPTIONS)[number];

export function normalizeItemUnit(value?: string | null): ItemUnit {
  const cleaned = String(value ?? "")
    .trim()
    .toUpperCase();

  if (!cleaned) return "PCS";
  if (cleaned === "PC" || cleaned === "PIECE" || cleaned === "PIECES")
    return "PCS";
  if (cleaned === "G" || cleaned === "GR") return "GRAM";
  if (cleaned === "M" || cleaned === "METERS" || cleaned === "MTR")
    return "METER";

  if ((ITEM_UNIT_OPTIONS as readonly string[]).includes(cleaned)) {
    return cleaned as ItemUnit;
  }

  return "PCS";
}

export function unitLabel(unit: ItemUnit): string {
  switch (unit) {
    case "GRAM":
      return "gram";
    case "METER":
      return "m";
    case "PCS":
    default:
      return "pcs";
  }
}

export function baseQtyToDisplayNumber(baseQty: number, unit: ItemUnit): number {
  const qty = Number.isFinite(baseQty) ? baseQty : 0;
  if (unit === "METER") return qty / 100;
  return qty;
}

export function formatBaseQty(baseQty: number, unit: ItemUnit): string {
  const value = baseQtyToDisplayNumber(baseQty, unit);
  const formatter =
    unit === "METER"
      ? new Intl.NumberFormat("id-ID", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : new Intl.NumberFormat("id-ID", {
          maximumFractionDigits: 0,
        });
  return formatter.format(value);
}

export function formatBaseQtyWithUnit(baseQty: number, unit: ItemUnit): string {
  return `${formatBaseQty(baseQty, unit)} ${unitLabel(unit)}`;
}

export function baseQtyToInputString(baseQty: number, unit: ItemUnit): string {
  const intQty = Number.isFinite(baseQty) ? Math.trunc(baseQty) : 0;
  if (unit !== "METER") return String(intQty);

  const sign = intQty < 0 ? "-" : "";
  const abs = Math.abs(intQty);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${sign}${whole},${fraction}`;
}

export type ParseQtyResult =
  | { ok: true; baseQty: number }
  | { ok: false; message: string };

export function parseInputToBaseQty(
  input: string,
  unit: ItemUnit,
  minBaseQty = 1,
): ParseQtyResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, message: "Qty wajib diisi." };

  const compact = raw.replace(/\s+/g, "");
  if (compact.startsWith("-")) {
    return { ok: false, message: "Qty tidak boleh negatif." };
  }

  if (unit === "METER") {
    const hasComma = compact.includes(",");
    const hasDot = compact.includes(".");
    if (hasComma && hasDot) {
      return {
        ok: false,
        message: "Untuk meter, gunakan koma atau titik sebagai desimal (bukan keduanya).",
      };
    }

    const normalized = compact.replace(",", ".");
    if (normalized === ".") {
      return { ok: false, message: "Qty meter tidak valid." };
    }

    if (!/^\d*(?:\.\d{1,2})?$/.test(normalized)) {
      return {
        ok: false,
        message: "Untuk meter, gunakan format seperti 1,25 (maks 2 desimal).",
      };
    }

    const [intRaw, fracRaw] = normalized.split(".");
    const whole = intRaw ? parseInt(intRaw, 10) : 0;
    if (!Number.isFinite(whole)) {
      return { ok: false, message: "Qty meter tidak valid." };
    }

    const frac = (fracRaw ?? "").padEnd(2, "0");
    const fracInt = frac ? parseInt(frac, 10) : 0;
    const baseQty = whole * 100 + (Number.isFinite(fracInt) ? fracInt : 0);

    if (!Number.isFinite(baseQty) || baseQty < minBaseQty) {
      return {
        ok: false,
        message:
          minBaseQty <= 0
            ? "Qty tidak valid."
            : "Qty harus lebih dari 0.",
      };
    }

    return { ok: true, baseQty };
  }

  if (compact.includes(",") || compact.includes(".")) {
    return {
      ok: false,
      message: `Untuk ${unitLabel(unit)}, qty harus bilangan bulat.`,
    };
  }

  if (!/^\d+$/.test(compact)) {
    return { ok: false, message: "Qty tidak valid." };
  }

  const baseQty = parseInt(compact, 10);
  if (!Number.isFinite(baseQty) || baseQty < minBaseQty) {
    return {
      ok: false,
      message: minBaseQty <= 0 ? "Qty tidak valid." : "Qty harus lebih dari 0.",
    };
  }

  return { ok: true, baseQty };
}
