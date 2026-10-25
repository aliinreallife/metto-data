"use client";
import { Check, TrainFront, ArrowLeft, ArrowRight } from "lucide-react";
import { STRINGS } from "../lib/i18n";
import type { Lang } from "../lib/catalog";
export function WagonPicker({
  lang,
  count,
  selected,
  onCount,
  onSelect,
}: {
  lang: Lang;
  count: string;
  selected: number | null;
  onCount: (value: string) => void;
  onSelect: (value: number) => void;
}) {
  const t = STRINGS[lang],
    n = Number(count),
    valid = Number.isInteger(n) && n >= 2 && n <= 12;
  const number = (value: number) =>
    new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(value);
  return (
    <fieldset className="min-w-0 rounded-2xl border border-border p-4 sm:p-5">
      <legend className="px-2 font-semibold">{t.wagon}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-semibold">
          {t.carCount}
          <input
            type="number"
            inputMode="numeric"
            min={2}
            max={12}
            step={1}
            value={count}
            onChange={(event) => onCount(event.target.value)}
            className="min-h-12 w-full rounded-xl border border-input bg-card px-3 py-3 text-base"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold">
          {t.direction}
          <input
            name="direction"
            maxLength={100}
            placeholder={t.directionPlaceholder}
            className="min-h-12 w-full rounded-xl border border-input bg-card px-3 py-3 text-base"
          />
        </label>
      </div>
      {valid ? (
        <div className="mt-6 rounded-xl bg-muted/60 p-3">
          <div
            className="mb-3 flex items-center justify-between gap-4 text-xs text-muted-foreground"
            dir="ltr"
          >
            <span className="inline-flex items-center gap-1">
              <ArrowLeft className="size-3" aria-hidden />
              {t.trainFront}
            </span>
            <span className="inline-flex items-center gap-1">
              {t.trainRear}
              <ArrowRight className="size-3" aria-hidden />
            </span>
          </div>
          <div className="overflow-x-auto overscroll-x-contain pb-3" dir="ltr">
            <div
              className="relative grid gap-2 pt-3"
              style={{ gridTemplateColumns: `repeat(${n}, minmax(52px, 1fr))` }}
            >
              {Array.from({ length: n }, (_, index) => index + 1).map((car) => (
                <button
                  key={car}
                  type="button"
                  aria-label={`${t.car} ${car}`}
                  aria-pressed={selected === car}
                  onClick={() => onSelect(car)}
                  className={`relative flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selected === car ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/50"}`}
                >
                  {selected === car && (
                    <span className="absolute -top-3 start-1/2 grid size-5 -translate-x-1/2 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check aria-hidden className="size-3.5" />
                    </span>
                  )}
                  <svg
                    aria-hidden
                    viewBox="0 0 52 38"
                    className="h-10 w-full max-w-14"
                    fill="none"
                  >
                    <path
                      d={
                        car === 1
                          ? "M9 5h35a4 4 0 0 1 4 4v19H4V13Z"
                          : "M7 5h37a4 4 0 0 1 4 4v19H4V9a4 4 0 0 1 3-4Z"
                      }
                      fill="currentColor"
                      opacity=".12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <rect
                      x="10"
                      y="11"
                      width="9"
                      height="9"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <rect
                      x="23"
                      y="11"
                      width="8"
                      height="17"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <rect
                      x="35"
                      y="11"
                      width="8"
                      height="9"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <circle cx="13" cy="31" r="3" fill="currentColor" />
                    <circle cx="39" cy="31" r="3" fill="currentColor" />
                    <path d="M1 36h50" stroke="currentColor" opacity=".4" />
                  </svg>
                  <span className="text-sm font-bold">{number(car)}</span>
                </button>
              ))}
            </div>
          </div>
          <p role="status" className="mt-1 text-center text-sm font-semibold">
            {selected ? `${t.selectedCar}: ${number(selected)}` : t.chooseCar}
          </p>
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-3 rounded-xl bg-muted/60 p-4 text-sm leading-7 text-muted-foreground">
          <TrainFront aria-hidden className="size-8 shrink-0 text-primary/70" />
          <p>{t.trainCountFirst}</p>
        </div>
      )}
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        {t.carHint}
      </p>
    </fieldset>
  );
}
