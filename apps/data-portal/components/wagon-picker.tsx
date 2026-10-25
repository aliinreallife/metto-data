"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  Check,
  TrainFront,
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  Venus,
} from "lucide-react";
import { STRINGS } from "../lib/i18n";
import type { Lang } from "../lib/catalog";
import {
  availableTrainProfiles,
  trainSources,
  womenZone,
} from "../lib/train-layouts";
import { SelectField } from "./select-field";
export function WagonPicker({
  lang,
  cityId,
  lineIds,
  profileId,
  onProfile,
  count,
  selected,
  onCount,
  onSelect,
}: {
  lang: Lang;
  cityId: string;
  lineIds: string[];
  profileId: string;
  onProfile: (value: string) => void;
  count: string;
  selected: number | null;
  onCount: (value: string) => void;
  onSelect: (value: number) => void;
}) {
  const t = STRINGS[lang],
    n = Number(count),
    valid = Number.isInteger(n) && n >= 2 && n <= 12;
  const profiles = availableTrainProfiles(cityId, lineIds),
    profile = profiles.find((item) => item.id === profileId);
  const knownWomen = !!profile?.women && profile.cars === n;
  const [headRight, setHeadRight] = useState(false),
    scroll = useRef<HTMLDivElement>(null),
    id = useId();
  useEffect(() => {
    if (scroll.current)
      scroll.current.scrollLeft = headRight ? scroll.current.scrollWidth : 0;
  }, [headRight, n]);
  const number = (value: number) =>
    new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(value);
  const cars = Array.from({ length: valid ? n : 0 }, (_, index) => index + 1);
  if (headRight) cars.reverse();
  const source = trainSources.find((item) =>
    profile?.sourceIds.includes(item.id),
  );
  return (
    <fieldset className="min-w-0 rounded-2xl border border-border p-4 sm:p-5">
      <legend className="px-2 font-semibold">{t.wagon}</legend>
      {!!profiles.length && (
        <div className="mb-5">
          <SelectField
            label={t.trainLayout}
            name="trainProfile"
            value={profileId}
            onChange={onProfile}
            options={[
              { value: "", label: t.trainLayoutManual },
              ...profiles.map((item) => ({
                value: item.id,
                label: item.names[lang],
              })),
            ]}
          />
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            {t.trainLayoutHint}
          </p>
        </div>
      )}
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
        <div
          className="mt-5 rounded-xl border border-border bg-muted/40 p-3 sm:p-4"
          data-testid="train-diagram"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold">{t.countFromFront}</p>
            <button
              type="button"
              aria-pressed={headRight}
              onClick={() => setHeadRight((value) => !value)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-card"
            >
              <ArrowLeftRight className="size-4" aria-hidden />
              {t.flipTrain}
            </button>
          </div>
          <p className="mb-2 text-xs text-muted-foreground" role="status">
            {headRight ? t.trainHeadRight : t.trainHeadLeft}
          </p>
          <div
            ref={scroll}
            className="overflow-x-auto overscroll-x-contain pb-3"
            dir="ltr"
            tabIndex={0}
            role="group"
            aria-label={t.trainScroll}
          >
            <div className="w-max min-w-full px-1">
              <div
                className="mb-3 flex items-center justify-between gap-5"
                style={{ minWidth: `${n * 72 - 8}px` }}
              >
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold ${headRight ? "bg-card text-muted-foreground" : "bg-foreground text-background"}`}
                  dir="auto"
                >
                  {headRight ? t.trainRear : t.trainFront}
                  {!headRight && <ArrowLeft className="size-4" aria-hidden />}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold ${headRight ? "bg-foreground text-background" : "bg-card text-muted-foreground"}`}
                  dir="auto"
                >
                  {headRight && <ArrowRight className="size-4" aria-hidden />}
                  {headRight ? t.trainFront : t.trainRear}
                </span>
              </div>
              <div
                className="relative grid gap-2 pt-3"
                style={{
                  gridTemplateColumns: `repeat(${n}, minmax(64px, 1fr))`,
                  minWidth: `${n * 72 - 8}px`,
                }}
              >
                <span
                  aria-hidden
                  className="absolute inset-x-3 top-12 h-1 bg-foreground/20"
                />
                {cars.map((car) => {
                  const zone = womenZone(profile, n, car),
                    front = car === 1,
                    rear = car === n;
                  const halfOnLeft =
                    zone === "head-half" ? !headRight : headRight;
                  const description =
                    zone === "full"
                      ? t.womenCar
                      : zone
                        ? t.womenHalfCar
                        : knownWomen
                          ? t.generalCar
                          : "";
                  return (
                    <button
                      key={car}
                      type="button"
                      aria-label={`${t.car} ${car}`}
                      aria-describedby={
                        description ? `${id}-${car}` : undefined
                      }
                      aria-pressed={selected === car}
                      onClick={() => onSelect(car)}
                      data-car-number={car}
                      data-women-zone={
                        zone ?? (knownWomen ? "general" : "unknown")
                      }
                      className={`relative flex min-h-32 flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selected === car ? "border-primary" : "border-border hover:border-foreground/40"} ${zone === "full" ? "bg-fuchsia-500/10" : "bg-card"}`}
                      style={
                        zone && zone !== "full"
                          ? {
                              backgroundImage: `linear-gradient(to ${halfOnLeft ? "right" : "left"}, rgb(217 70 239 / .14) 50%, transparent 50%)`,
                            }
                          : undefined
                      }
                    >
                      {selected === car && (
                        <span className="absolute -top-3 left-1/2 grid size-5 -translate-x-1/2 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3.5" aria-hidden />
                        </span>
                      )}
                      <svg
                        aria-hidden
                        viewBox="0 0 64 44"
                        className={`h-11 w-full max-w-16 ${zone ? "text-fuchsia-700 dark:text-fuchsia-300" : "text-foreground/70"}`}
                        fill="none"
                      >
                        <path
                          d={
                            profile?.kind !== "double_deck" &&
                            ((front && !headRight) || (rear && headRight))
                              ? "M13 5h41a5 5 0 0 1 5 5v24H5V16Z"
                              : profile?.kind !== "double_deck" &&
                                  ((front && headRight) || (rear && !headRight))
                                ? "M10 5h41l8 11v18H5V10a5 5 0 0 1 5-5Z"
                                : "M10 5h44a5 5 0 0 1 5 5v24H5V10a5 5 0 0 1 5-5Z"
                          }
                          fill="currentColor"
                          fillOpacity=".08"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        {profile?.kind === "double_deck" ? (
                          [11, 22, 33, 44].flatMap((x) =>
                            [11, 23].map((y) => (
                              <rect
                                key={`${x}-${y}`}
                                x={x}
                                y={y}
                                width="7"
                                height="7"
                                rx="1.5"
                                stroke="currentColor"
                              />
                            )),
                          )
                        ) : (
                          <>
                            <rect
                              x="14"
                              y="13"
                              width="10"
                              height="10"
                              rx="2"
                              stroke="currentColor"
                            />
                            <rect
                              x="28"
                              y="13"
                              width="8"
                              height="21"
                              rx="1.5"
                              stroke="currentColor"
                            />
                            <rect
                              x="40"
                              y="13"
                              width="10"
                              height="10"
                              rx="2"
                              stroke="currentColor"
                            />
                            {profile?.kind === "lrt" && (
                              <>
                                <path
                                  d="M23 6v27M41 6v27"
                                  stroke="currentColor"
                                  strokeDasharray="1 2"
                                  opacity=".55"
                                />
                              </>
                            )}
                          </>
                        )}
                        <circle cx="15" cy="37" r="3" fill="currentColor" />
                        <circle cx="49" cy="37" r="3" fill="currentColor" />
                        <path d="M3 42h58" stroke="currentColor" opacity=".4" />
                      </svg>
                      <span className="text-sm font-bold">{number(car)}</span>
                      {description && (
                        <span
                          id={`${id}-${car}`}
                          className={`flex min-h-5 items-center gap-0.5 text-[10px] font-semibold ${zone ? "text-fuchsia-800 dark:text-fuchsia-200" : "text-muted-foreground"}`}
                          dir="auto"
                        >
                          {zone && (
                            <Venus className="size-3 shrink-0" aria-hidden />
                          )}
                          {description}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <p role="status" className="mt-2 text-center text-sm font-semibold">
            {selected ? `${t.selectedCar}: ${number(selected)}` : t.chooseCar}
          </p>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            {t.trainScrollHint}
          </p>
          {knownWomen ? (
            <p className="mt-3 flex items-start gap-1.5 text-xs leading-6 text-fuchsia-800 dark:text-fuchsia-200">
              <Venus className="mt-1 size-3.5 shrink-0" aria-hidden />
              {t.womenLayoutNote}
            </p>
          ) : (
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              {t.womenLayoutUnknown}
            </p>
          )}
          {profile?.kind === "double_deck" && (
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {t.passengerCarsOnly}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-3 rounded-xl bg-muted/60 p-4 text-sm leading-7 text-muted-foreground">
          <TrainFront aria-hidden className="size-8 shrink-0 text-primary/70" />
          <p>{t.trainCountFirst}</p>
        </div>
      )}
      {source && (
        <a
          className="mt-3 inline-flex min-h-11 items-center text-xs text-muted-foreground underline underline-offset-4"
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.trainLayoutSource}
          {source.publishedOn ? ` · ${source.publishedOn.slice(0, 4)}` : ""}
          <span className="sr-only"> — {t.opensNewTab}</span>
        </a>
      )}
    </fieldset>
  );
}
