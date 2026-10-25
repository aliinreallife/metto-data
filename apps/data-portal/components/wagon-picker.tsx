"use client";
import { useId, useState } from "react";
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
  stationId,
  lineIds,
  profileId,
  onProfile,
  selected,
  onSelect,
}: {
  lang: Lang;
  cityId: string;
  stationId: string;
  lineIds: string[];
  profileId: string;
  onProfile: (value: string) => void;
  selected: number | null;
  onSelect: (value: number) => void;
}) {
  const t = STRINGS[lang],
    profiles = availableTrainProfiles(cityId, lineIds, stationId);
  const profile = profiles.find((item) => item.id === profileId),
    count = profile?.cars ?? 0;
  const [headRight, setHeadRight] = useState(false),
    id = useId().replace(/:/g, "");
  const number = (value: number) =>
    new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(value);
  const cars = Array.from({ length: count }, (_, index) => index + 1);
  if (headRight) cars.reverse();
  const sources = trainSources.filter((item) =>
    profile?.sourceIds.includes(item.id),
  );
  const knownWomen = !!profile?.women;
  const width = count * 80 + 16;
  return (
    <fieldset className="min-w-0 rounded-2xl border border-border p-4 sm:p-5">
      <legend className="px-2 font-semibold">{t.wagon}</legend>
      {profile ? (
        <>
          <div className="mb-4">
            {profiles.length > 1 ? (
              <SelectField
                label={t.trainLayout}
                name="trainProfile"
                value={profile.id}
                onChange={onProfile}
                options={profiles.map((item) => ({
                  value: item.id,
                  label: item.names[lang],
                }))}
              />
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-3">
                <TrainFront
                  className="size-5 shrink-0 text-primary"
                  aria-hidden
                />
                <span className="text-sm font-semibold">
                  {profile.names[lang]}
                </span>
                <input type="hidden" name="trainProfile" value={profile.id} />
              </div>
            )}
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {t.trainLayoutHint}
            </p>
          </div>
          <div
            className="mb-4 flex items-center justify-between gap-4 px-1"
            data-testid="train-fixed-count"
          >
            <span className="text-sm text-muted-foreground">
              {t.carCountFixed}
            </span>
            <span className="flex items-baseline gap-1.5">
              <strong className="text-xl font-bold tabular-nums">
                {number(count)}
              </strong>
              <span className="text-xs text-muted-foreground">
                {t.trainCarsUnit}
              </span>
            </span>
          </div>
          <div
            className="rounded-xl border border-border bg-muted/40 p-3 sm:p-4"
            data-testid="train-diagram"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold">{t.countFromFront}</p>
              <button
                type="button"
                aria-pressed={headRight}
                onClick={() => setHeadRight((value) => !value)}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-card"
              >
                <ArrowLeftRight className="size-4" aria-hidden />
                {t.flipTrain}
              </button>
            </div>
            <div
              className="mb-1 flex items-center justify-between gap-4 text-[11px] font-semibold"
              dir="ltr"
            >
              <span
                className={`inline-flex items-center gap-1 ${headRight ? "text-muted-foreground" : "text-foreground"}`}
                dir="auto"
              >
                {!headRight && <ArrowLeft className="size-3.5" aria-hidden />}
                {headRight ? t.trainRear : t.trainFront}
              </span>
              <span
                className={`inline-flex items-center gap-1 ${headRight ? "text-foreground" : "text-muted-foreground"}`}
                dir="auto"
              >
                {headRight ? t.trainFront : t.trainRear}
                {headRight && <ArrowRight className="size-3.5" aria-hidden />}
              </span>
            </div>
            <svg
              viewBox={`0 0 ${width} 88`}
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
              className="block h-24 w-full"
              data-testid="train-overview"
            >
              <defs>
                {cars.map((car, index) => {
                  const x = 8 + index * 80,
                    noseLeft =
                      profile.kind !== "double_deck" &&
                      ((!headRight && car === 1) ||
                        (headRight && car === count)),
                    noseRight =
                      profile.kind !== "double_deck" &&
                      ((headRight && car === 1) ||
                        (!headRight && car === count));
                  const path = noseLeft
                    ? `M${x + 20} 18H${x + 62}a6 6 0 0 1 6 6v40H${x}V42Q${x} 26 ${x + 20} 18Z`
                    : noseRight
                      ? `M${x + 6} 18H${x + 48}Q${x + 68} 26 ${x + 68} 42v22H${x}V24a6 6 0 0 1 6-6Z`
                      : `M${x + 6} 18h56a6 6 0 0 1 6 6v40H${x}V24a6 6 0 0 1 6-6Z`;
                  return (
                    <clipPath key={car} id={`${id}-car-${car}`}>
                      <path id={`${id}-outline-${car}`} d={path} />
                    </clipPath>
                  );
                })}
              </defs>
              <path
                d={`M12 69H${width - 12}`}
                className="stroke-foreground/15"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              {cars.map((car, index) => {
                const x = 8 + index * 80,
                  zone = womenZone(profile, count, car),
                  active = selected === car;
                const leftHalf = zone === "head-half" ? !headRight : headRight;
                return (
                  <g key={car} data-diagram-car={car}>
                    {index < count - 1 && (
                      <path
                        d={`M${x + 66} 45h16`}
                        className="stroke-muted-foreground/50"
                        strokeWidth="3"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    <g clipPath={`url(#${id}-car-${car})`}>
                      <rect
                        x={x}
                        y="18"
                        width="68"
                        height="46"
                        className="fill-card"
                      />
                      {zone && (
                        <rect
                          x={zone === "full" || leftHalf ? x : x + 34}
                          y="18"
                          width={zone === "full" ? 68 : 34}
                          height="46"
                          className="fill-fuchsia-500/25"
                        />
                      )}
                      <path
                        d={`M${x + 13} 27h42M${x + 13} 56h42`}
                        className="stroke-foreground/35"
                        strokeWidth="3"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      {profile.kind === "double_deck" ? (
                        <path
                          d={`M${x + 13} 38h42M${x + 13} 46h42`}
                          className="stroke-foreground/25"
                          strokeWidth="2"
                          strokeDasharray="5 4"
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : (
                        <rect
                          x={x + 24}
                          y="34"
                          width="20"
                          height="14"
                          rx="3"
                          className="fill-foreground/10"
                        />
                      )}
                      {profile.kind === "lrt" && (
                        <path
                          d={`M${x + 22} 20v42M${x + 46} 20v42`}
                          className="stroke-muted-foreground/40"
                          strokeDasharray="2 3"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                    </g>
                    <use
                      href={`#${id}-outline-${car}`}
                      fill="none"
                      className={
                        active ? "stroke-primary" : "stroke-foreground/50"
                      }
                      strokeWidth={active ? 2.5 : 1.2}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
            </svg>
            <p className="sr-only" role="status">
              {headRight ? t.trainHeadRight : t.trainHeadLeft}
            </p>
            <div
              role="group"
              aria-label={t.chooseCar}
              className="mt-2 grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${count > 7 ? 3 : count > 5 ? 4 : count}, minmax(0, 1fr))`,
              }}
              dir="ltr"
            >
              {cars.map((car) => {
                const zone = womenZone(profile, count, car),
                  active = selected === car;
                const description =
                  zone === "full"
                    ? t.womenCar
                    : zone
                      ? t.womenHalfCar
                      : knownWomen
                        ? t.generalCar
                        : "";
                const leftHalf = zone === "head-half" ? !headRight : headRight;
                return (
                  <button
                    key={car}
                    type="button"
                    aria-label={`${t.car} ${car}`}
                    aria-describedby={
                      description ? `${id}-role-${car}` : undefined
                    }
                    aria-pressed={active}
                    onClick={() => onSelect(car)}
                    data-car-number={car}
                    data-women-zone={
                      zone ?? (knownWomen ? "general" : "unknown")
                    }
                    className={`relative inline-flex min-h-12 items-center justify-center gap-1 rounded-lg border-2 px-1 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${active ? "border-primary text-primary" : "border-border text-foreground hover:border-foreground/40"} ${zone === "full" ? "bg-fuchsia-500/10" : "bg-card"}`}
                    style={
                      zone && zone !== "full"
                        ? {
                            backgroundImage: `linear-gradient(to ${leftHalf ? "right" : "left"}, rgb(217 70 239 / .12) 50%, transparent 50%)`,
                          }
                        : undefined
                    }
                  >
                    {zone && (
                      <Venus
                        className="size-3 shrink-0 text-fuchsia-800 dark:text-fuchsia-200"
                        aria-hidden
                      />
                    )}
                    {number(car)}
                    {active && (
                      <span className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" aria-hidden />
                      </span>
                    )}
                    {description && (
                      <span id={`${id}-role-${car}`} className="sr-only">
                        {description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-center text-sm font-semibold" role="status">
              {selected ? `${t.selectedCar}: ${number(selected)}` : t.chooseCar}
            </p>
            {knownWomen ? (
              <div className="mt-4 space-y-2 border-t border-border pt-3 text-[11px] leading-6 text-muted-foreground">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {!!profile.women?.full.length && (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-3 rounded border border-fuchsia-600/30 bg-fuchsia-500/20"
                        aria-hidden
                      />
                      {t.womenCar}
                    </span>
                  )}
                  {!!(
                    profile.women?.headHalf.length ||
                    profile.women?.rearHalf.length
                  ) && (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-3 rounded border border-fuchsia-600/30 bg-[linear-gradient(to_right,rgb(217_70_239_/_0.2)_50%,transparent_50%)]"
                        aria-hidden
                      />
                      {t.womenHalfCar}
                    </span>
                  )}
                </div>
                <p>{t.womenLayoutNote}</p>
              </div>
            ) : (
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                {t.womenLayoutUnknown}
              </p>
            )}
            {profile.kind === "double_deck" && (
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {t.passengerCarsOnly}
              </p>
            )}
          </div>
          <label className="mt-5 flex flex-col gap-2 text-sm font-semibold">
            {t.direction}
            <input
              name="direction"
              maxLength={100}
              placeholder={t.directionPlaceholder}
              className="min-h-12 w-full rounded-xl border border-input bg-card px-3 py-3 text-base"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-x-4">
            {sources.map((source) => (
              <a
                key={source.id}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center text-xs text-muted-foreground underline underline-offset-4"
              >
                {t.trainLayoutSource}
                {source.publishedOn
                  ? ` · ${source.publishedOn.slice(0, 4)}`
                  : ""}
                <span className="sr-only"> — {t.opensNewTab}</span>
              </a>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm leading-7 text-muted-foreground">
          {t.trainLayoutUnavailable}
        </p>
      )}
    </fieldset>
  );
}
