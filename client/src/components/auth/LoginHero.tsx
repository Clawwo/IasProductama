type LoginHeroProps = {
  brand: string;
  subtitle: string;
  title: string;
  quote: string;
  author: string;
};

export function LoginHero({
  brand,
  subtitle,
  title,
  quote,
  author,
}: LoginHeroProps) {
  return (
    <div className="flex flex-col justify-between bg-slate-50 px-8 py-6 sm:px-12 sm:py-10">
      <div className="flex items-center gap-3 text-slate-800">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sky-600 text-white font-semibold">
          JD
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Gudang
          </p>
          <p className="text-base font-semibold">{brand}</p>
        </div>
      </div>
      <div className="space-y-4 pb-10">
        <p className="text-4xl font-heading uppercase leading-none text-slate-800 sm:text-5xl">
          {title}
        </p>
        <p className="text-sm leading-relaxed text-slate-600 max-w-lg">
          {subtitle}
        </p>
        <p className="text-sm leading-relaxed text-slate-700 max-w-lg italic">
          “{quote}”
        </p>
        <p className="text-sm font-semibold text-slate-800">— {author}</p>
      </div>
    </div>
  );
}
