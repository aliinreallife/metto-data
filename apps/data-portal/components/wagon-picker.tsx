"use client";
import { useId, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  ArrowUp,
  Check,
  DoorOpen,
  Repeat2,
  TrainFront,
  Venus,
} from "lucide-react";
import { STRINGS } from "../lib/i18n";
import type { Lang } from "../lib/catalog";
import {
  availableTrainProfiles,
  trainSources,
  womenZone,
} from "../lib/train-layouts";
import type { TrainDirection } from "../lib/train-directions";
import type { ExitTarget } from "../lib/station-exits";
import { SelectField } from "./select-field";
function EscalatorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="4 20 4 16 9 16 9 12 14 12 14 8 20 8" />
    </svg>
  );
}
export function WagonPicker({
  lang,
  cityId,
  stationId,
  lineIds,
  profileId,
  onProfile,
  directions,
  direction,
  onDirection,
  exits,
  exitId,
  onExit,
  selected,
  onSelect,
}: {
  lang: Lang;
  cityId: string;
  stationId: string;
  lineIds: string[];
  profileId: string;
  onProfile: (value: string) => void;
  directions: TrainDirection[];
  direction: TrainDirection | undefined;
  onDirection: (value: string) => void;
  exits: ExitTarget[];
  exitId: string;
  onExit: (value: string) => void;
  selected: number | null;
  onSelect: (value: number) => void;
}) {
  const t = STRINGS[lang],
    id = useId(),
    [headRight, setHeadRight] = useState(false);
  const profiles = availableTrainProfiles(cityId, lineIds, stationId),
    profile = profiles.find((p) => p.id === profileId),
    count = profile?.cars ?? 0;
  const exit = exits.find((exit) => exit.id === exitId) ?? exits[0],
    knownWomen = !!profile?.women;
  const cars = Array.from({ length: count }, (_, i) => i + 1);
  if (headRight) cars.reverse();
  const number = (n: number) =>
    new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(n);
  const point = selected
    ? (((headRight ? count - selected : selected - 1) + 0.5) / count) * 100
    : 50;
  const ExitIcon =
    exit?.icon === "transfer"
      ? Repeat2
      : exit?.icon === "exit"
        ? DoorOpen
        : EscalatorIcon;
  const head = direction
    ? t.toward + " " + direction.destinationNames[lang]
    : t.chooseDirection;
  const rear = direction?.oppositeNames[lang] ?? "";
  if (!profile)
    return (
      <p className="rounded-xl bg-muted p-4 text-sm leading-7">
        {t.trainLayoutUnavailable}
      </p>
    );
  return (
    <fieldset className="min-w-0" aria-label={t.wagon}>
      <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {profiles.length > 1 ? (
            <SelectField
              label={t.trainLayout}
              name="trainProfile"
              value={profile.id}
              onChange={onProfile}
              options={profiles.map((p) => ({
                value: p.id,
                label: p.names[lang],
              }))}
            />
          ) : (
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TrainFront
                className="size-5 shrink-0 text-primary"
                aria-hidden
              />
              {profile.names[lang]}
              <input type="hidden" name="trainProfile" value={profile.id} />
            </div>
          )}
        </div>
        <span
          data-testid="train-fixed-count"
          className="mt-1 shrink-0 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground"
        >
          <span className="sr-only">{t.carCountFixed}: </span>
          <strong className="text-foreground">{number(count)}</strong>
          {" " + t.trainCarsUnit}
        </span>
      </div>
      <div className="mb-5">
        {directions.length <= 2 ? (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              {t.wagonDirection}
            </legend>
            <input
              type="hidden"
              name="wagonDirection"
              value={direction?.id ?? ""}
            />
            <div className="grid grid-cols-2 gap-2">
              {directions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-direction-id={item.id}
                  aria-pressed={direction?.id === item.id}
                  onClick={() => onDirection(item.id)}
                  className={
                    "min-h-12 rounded-xl border px-3 py-2 text-sm font-semibold " +
                    (direction?.id === item.id
                      ? "border-primary bg-primary/8 text-primary"
                      : "border-input bg-card hover:bg-muted")
                  }
                >
                  {t.toward + " " + item.destinationNames[lang]}
                </button>
              ))}
            </div>
            {!directions.length && (
              <p className="text-sm text-muted-foreground">{t.chooseStation}</p>
            )}
          </fieldset>
        ) : (
          <SelectField
            label={t.wagonDirection}
            name="wagonDirection"
            value={direction?.id ?? ""}
            onChange={onDirection}
            options={[
              { value: "", label: t.chooseDirection },
              ...directions.map((item) => ({
                value: item.id,
                label:
                  item.lineNames[lang] +
                  " · " +
                  t.toward +
                  " " +
                  item.destinationNames[lang],
              })),
            ]}
          />
        )}
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          {t.wagonDirectionHint}
        </p>
      </div>
      {exits.length > 1 && (
        <fieldset className="mb-5">
          <legend className="mb-2 text-sm font-semibold">{t.whichExit}</legend>
          <div className="flex flex-wrap gap-2">
            {exits.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === exitId}
                onClick={() => onExit(item.id)}
                className={
                  "min-h-11 rounded-xl border px-3 py-2 text-sm " +
                  (item.id === exitId
                    ? "border-primary bg-primary/8 text-primary"
                    : "border-input")
                }
              >
                {item.names[lang]}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div
        className="rounded-2xl border border-border bg-muted/30 p-3 sm:p-5"
        data-testid="train-diagram"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold leading-7">
            {t.wagonQuestionStart + exit?.names[lang] + t.wagonQuestionEnd}
          </h2>
          <button
            type="button"
            aria-pressed={headRight}
            onClick={() => setHeadRight((v) => !v)}
            className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-card"
            aria-label={t.flipTrain}
          >
            <ArrowLeftRight className="size-4" aria-hidden />
          </button>
        </div>
        <div
          className="mb-3 flex items-start justify-between gap-4 text-xs"
          dir="ltr"
        >
          {[false, true].map((right) => {
            const isHead = right === headRight;
            return (
              <div
                key={String(right)}
                dir="auto"
                className={
                  "max-w-[48%] " + (right ? "text-right" : "text-left")
                }
              >
                <span
                  className={
                    "inline-flex items-center gap-1 " +
                    (isHead
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground")
                  }
                >
                  {isHead && !right && (
                    <ArrowLeft className="size-3.5" aria-hidden />
                  )}
                  {isHead ? t.trainFront : t.trainRear}
                  {isHead && right && (
                    <ArrowRight className="size-3.5" aria-hidden />
                  )}
                </span>
                <span
                  className="mt-1 block font-semibold leading-6"
                  data-testid={
                    isHead ? "train-head-destination" : "train-rear-destination"
                  }
                >
                  {isHead ? head : rear}
                </span>
              </div>
            );
          })}
        </div>
        <div
          className={"flex pb-1.5 " + (count > 7 ? "gap-1" : "gap-1.5")}
          dir="ltr"
          role="group"
          aria-label={t.trainTapHint}
          data-testid="train-overview"
        >
          {cars.map((car) => {
            const zone = womenZone(profile, count, car),
              active = car === selected,
              leftHalf = zone === "head-half" ? !headRight : headRight;
            const isLeftEnd = headRight ? car === count : car === 1,
              isRightEnd = headRight ? car === 1 : car === count;
            return (
              <button
                key={car}
                type="button"
                data-diagram-car={car}
                data-car-number={car}
                data-women-zone={zone ?? (knownWomen ? "general" : "unknown")}
                aria-label={t.car + " " + car}
                aria-pressed={active}
                aria-describedby={knownWomen ? id + "-role-" + car : undefined}
                onClick={() => onSelect(car)}
                className={
                  "relative h-24 min-w-0 flex-1 cursor-pointer border bg-card focus-visible:outline-none " +
                  (active
                    ? "border-primary ring-1 ring-primary"
                    : "border-foreground/40 hover:border-primary/70")
                }
                style={{
                  borderRadius:
                    profile.kind === "double_deck"
                      ? 6
                      : isLeftEnd
                        ? "22px 6px 6px 6px"
                        : isRightEnd
                          ? "6px 22px 6px 6px"
                          : 6,
                }}
              >
                <span
                  className="pointer-events-none absolute inset-0 overflow-hidden"
                  style={{ borderRadius: "inherit" }}
                >
                  {zone && (
                    <span
                      className="absolute inset-y-0 bg-fuchsia-500/15"
                      style={{
                        width: zone === "full" ? "100%" : "50%",
                        left: zone === "full" || leftHalf ? 0 : undefined,
                        right: zone !== "full" && !leftHalf ? 0 : undefined,
                      }}
                    />
                  )}
                  {active && <span className="absolute inset-0 bg-primary/5" />}
                  <span className="absolute inset-x-1.5 top-2 flex gap-1">
                    <span className="h-3 min-w-0 flex-1 rounded-sm bg-foreground/20" />
                    <span className="h-3 min-w-0 flex-1 rounded-sm bg-foreground/20" />
                  </span>
                  {profile.kind === "double_deck" && (
                    <span className="absolute inset-x-1.5 top-6 flex gap-1">
                      <span className="h-2 min-w-0 flex-1 rounded-sm bg-foreground/20" />
                      <span className="h-2 min-w-0 flex-1 rounded-sm bg-foreground/20" />
                    </span>
                  )}
                  <span
                    className={
                      "absolute inset-x-0 top-9 text-center text-base font-semibold " +
                      (active ? "text-primary" : "text-foreground")
                    }
                  >
                    {number(car)}
                  </span>
                  {zone && (
                    <Venus
                      className="absolute bottom-2.5 size-3 text-fuchsia-800 dark:text-fuchsia-200"
                      aria-hidden
                      style={{
                        left:
                          zone === "full"
                            ? "calc(50% - 6px)"
                            : leftHalf
                              ? "calc(25% - 6px)"
                              : "calc(75% - 6px)",
                      }}
                    />
                  )}
                </span>
                <span
                  aria-hidden
                  className="absolute -bottom-1.5 left-[18%] h-1.5 w-2 rounded-b-sm bg-foreground/50"
                />
                <span
                  aria-hidden
                  className="absolute -bottom-1.5 right-[18%] h-1.5 w-2 rounded-b-sm bg-foreground/50"
                />
                {knownWomen && (
                  <span id={id + "-role-" + car} className="sr-only">
                    {zone === "full"
                      ? t.womenCar
                      : zone
                        ? t.womenHalfCar
                        : t.generalCar}
                  </span>
                )}
                {active && (
                  <span className="absolute -right-1 -top-2 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" aria-hidden />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-1 h-0.5 rounded-full bg-foreground/25" aria-hidden />
        <div
          className="relative mt-3 h-16 rounded-xl bg-muted"
          dir="ltr"
          data-testid="wagon-platform"
        >
          {selected ? (
            <div className="absolute inset-0" aria-hidden>
              <ArrowUp
                className="absolute top-1 size-4 -translate-x-1/2 text-primary"
                style={{ left: point + "%" }}
              />
              <span
                className="absolute top-7 inline-flex h-6 -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-lg border border-primary/40 bg-card px-2 text-[10px] font-semibold text-primary"
                style={{
                  left: "clamp(75px, " + point + "%, calc(100% - 75px))",
                }}
                dir="auto"
              >
                <ExitIcon className="size-3" aria-hidden />
                {exit?.names[lang]}
              </span>
            </div>
          ) : (
            <span className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
              {t.platform}
            </span>
          )}
        </div>
        <p
          className="mt-3 text-center text-sm font-semibold leading-7"
          role="status"
        >
          {selected ? t.selectedCar + ": " + number(selected) : t.trainTapHint}
        </p>
        {knownWomen ? (
          <p className="mt-3 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
            <Venus
              className="mt-1 size-3.5 shrink-0 text-fuchsia-800 dark:text-fuchsia-200"
              aria-hidden
            />
            {t.womenLayoutNote}
          </p>
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
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted-foreground">
        <span>{t.countFromFront}</span>
        {trainSources
          .filter((source) => profile.sourceIds.includes(source.id))
          .map((source) => (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              {t.trainLayoutSource}
              <span className="sr-only"> — {t.opensNewTab}</span>
            </a>
          ))}
      </div>
    </fieldset>
  );
}
