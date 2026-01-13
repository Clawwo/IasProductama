import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

type ChartPoint = {
  label: string;
  inbound: number;
  outbound: number;
};

type Totals = { inbound: number; outbound: number };

export function SummaryChart({ data }: { data: ChartPoint[] }) {
  const totals = data.reduce<Totals>(
    (acc, point) => ({
      inbound: acc.inbound + point.inbound,
      outbound: acc.outbound + point.outbound,
    }),
    { inbound: 0, outbound: 0 }
  );

  const maxValue = Math.max(
    1,
    ...data.map((point) => Math.max(point.inbound, point.outbound))
  );

  return (
    <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">7 hari terakhir</p>
          <h3 className="text-lg font-semibold">Ringkasan pergerakan</h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-emerald-500" />
            Masuk
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-orange-500" />
            Keluar
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 rounded-lg border bg-emerald-50 px-3 py-2 text-emerald-700">
          <ArrowDownLeft className="size-4" />
          <div>
            <p className="text-xs text-emerald-700/80">Masuk</p>
            <p className="font-semibold">{totals.inbound} pcs</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-orange-50 px-3 py-2 text-orange-700">
          <ArrowUpRight className="size-4" />
          <div>
            <p className="text-xs text-orange-700/80">Keluar</p>
            <p className="font-semibold">{totals.outbound} pcs</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {data.map((point) => {
          const inboundPct =
            point.inbound === 0
              ? 0
              : Math.min(
                  Math.max((point.inbound / maxValue) * 100, 12),
                  100
                );
          const outboundPct =
            point.outbound === 0
              ? 0
              : Math.min(
                  Math.max((point.outbound / maxValue) * 100, 12),
                  100
                );

          return (
            <div key={point.label} className="flex flex-col items-center gap-2">
              <div className="flex h-28 w-full items-end gap-1 rounded-lg bg-slate-50 p-1">
                <span
                  className="w-1/2 rounded-sm bg-emerald-500/80"
                  style={{ height: `${inboundPct}%` }}
                  title={`Masuk: ${point.inbound} pcs`}
                />
                <span
                  className="w-1/2 rounded-sm bg-orange-500/80"
                  style={{ height: `${outboundPct}%` }}
                  title={`Keluar: ${point.outbound} pcs`}
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold leading-tight">{point.label}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {point.inbound} / {point.outbound}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
