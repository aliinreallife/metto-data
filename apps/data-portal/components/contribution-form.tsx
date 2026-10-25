"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  MapPin,
  MessageSquare,
  TrainFront,
  Accessibility,
  CircleAlert,
} from "lucide-react";
import type { Catalog, Lang } from "../lib/catalog";
import { STRINGS, type StringKey } from "../lib/i18n";
import { preparePhoto } from "../lib/photo";
import { SelectField } from "./select-field";
type Kind =
  | "timetable"
  | "facility"
  | "status"
  | "location"
  | "wagon"
  | "other";
const kinds: Kind[] = [
  "timetable",
  "facility",
  "status",
  "location",
  "wagon",
  "other",
];
const icons = {
  timetable: Clock3,
  facility: Accessibility,
  status: CircleAlert,
  location: MapPin,
  wagon: TrainFront,
  other: MessageSquare,
};
const input =
  "w-full min-h-12 rounded-xl border border-input bg-background px-3 py-3 text-base focus-visible:ring-2 focus-visible:ring-ring";
const primary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring";
const secondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring";
export function ContributionForm({
  catalog,
  lang,
  initialCity,
  initialStation,
  initialKind,
  enabled,
}: {
  catalog: Catalog;
  lang: Lang;
  initialCity: string;
  initialStation: string;
  initialKind: string;
  enabled: boolean;
}) {
  const t = STRINGS[lang],
    [cityId, setCityId] = useState(initialCity || "mashhad"),
    [step, setStep] = useState<1 | 2>(1),
    [kind, setKind] = useState<Kind>(
      kinds.includes(initialKind as Kind) ? (initialKind as Kind) : "other",
    ),
    [stationId, setStationId] = useState(initialStation),
    [carCount, setCarCount] = useState(""),
    [car, setCar] = useState<number | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState<StringKey | null>(null),
    [receipt, setReceipt] = useState<{ id: string; issueUrl?: string } | null>(
      null,
    );
  const heading = useRef<HTMLHeadingElement>(null),
    typeButtons = useRef<HTMLDivElement>(null),
    form = useRef<HTMLFormElement>(null),
    message = useRef<HTMLParagraphElement>(null),
    success = useRef<HTMLDivElement>(null),
    last = useRef<{ fingerprint: string; id: string } | null>(null);
  useEffect(() => {
    if (error) message.current?.focus();
  }, [error]);
  useEffect(() => {
    if (receipt) success.current?.focus();
  }, [receipt]);
  const city = catalog.cities.find((item) => item.id === cityId),
    stations = city?.stations ?? [];
  const chooseKind = (value: Kind) => {
    setKind(value);
    setError(null);
    setStep(2);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    });
  };
  const backToKinds = () => {
    setStep(1);
    setError(null);
    requestAnimationFrame(() =>
      typeButtons.current
        ?.querySelector<HTMLButtonElement>(`[data-kind=${kind}]`)
        ?.focus(),
    );
  };
  const changeCity = (value: string) => {
    setCityId(value);
    setStationId("");
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step !== 2 || pending || !enabled) return;
    const fields = new FormData(event.currentTarget),
      details = String(fields.get("details") ?? "").trim(),
      file = (fields.get("photo") as File | null) ?? undefined;
    let observation = "";
    if (kind === "facility" && fields.get("amenity") && fields.get("value"))
      observation = `Amenity: ${fields.get("amenity")}; observed value: ${fields.get("value")}`;
    if (kind === "status" && fields.get("status"))
      observation = `Observed status: ${fields.get("status")}`;
    if (kind === "wagon" && car)
      observation = `Observed car ${car} of ${carCount}; direction: ${String(fields.get("direction") ?? "").trim()}`;
    if (!details && !observation && !file?.size) {
      setError("required");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const source = String(fields.get("source") ?? "").trim();
      if (source) {
        try {
          const u = new URL(source);
          if (
            !["http:", "https:"].includes(u.protocol) ||
            u.username ||
            u.password
          )
            throw Error();
        } catch {
          throw Error("sourceError");
        }
      }
      const photo = await preparePhoto(file);
      const payload = {
        cityId,
        stationId,
        kind,
        subject: String(fields.get("subject") ?? "").trim(),
        details: [details, observation].filter(Boolean).join("\n\n"),
        source,
        name: String(fields.get("name") ?? "").trim(),
        contact: String(fields.get("contact") ?? "").trim(),
        website: String(fields.get("website") ?? ""),
        ...(photo ? { photo } : {}),
      };
      const fingerprint = JSON.stringify(payload);
      if (last.current?.fingerprint !== fingerprint)
        last.current = { fingerprint, id: crypto.randomUUID() };
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({ ...payload, id: last.current!.id }),
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok)
        throw Error(
          response.status === 429
            ? "limited"
            : response.status === 503
              ? "busy"
              : "failed",
        );
      const result = (await response.json()) as {
        id: string;
        issueUrl?: string;
      };
      if (!result.id) throw Error("failed");
      setReceipt(result);
    } catch (caught) {
      const key = caught instanceof Error ? caught.message : "";
      setError(
        ["required", "photoError", "sourceError", "limited", "busy"].includes(
          key,
        )
          ? (key as StringKey)
          : "failed",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="mx-auto max-w-3xl">
      {!receipt && (
        <>
          <ol
            aria-label={t.reportSteps}
            className="mb-7 flex items-center gap-3 text-sm"
          >
            {[1, 2].map((value) => (
              <li
                key={value}
                aria-current={step === value ? "step" : undefined}
                className={`flex items-center gap-2 ${step === value ? "font-semibold text-primary" : "text-muted-foreground"}`}
              >
                <span
                  className={`grid size-7 place-items-center rounded-full ${step === value ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(
                    value,
                  )}
                </span>
                {value === 1 ? t.chooseChange : t.changeDetails}
                {value === 1 && (
                  <span
                    aria-hidden
                    className="ms-1 h-px w-6 bg-border sm:w-12"
                  />
                )}
              </li>
            ))}
          </ol>
          {step === 2 && (
            <button
              type="button"
              disabled={pending}
              onClick={backToKinds}
              className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
            >
              <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
              {t.changeType}
            </button>
          )}
          <h1
            ref={heading}
            tabIndex={-1}
            className="scroll-mt-24 text-2xl font-bold sm:text-3xl"
          >
            {step === 1 ? t.chooseTitle : t[kind]}
          </h1>
          <p className="mb-6 mt-3 text-sm leading-7 text-muted-foreground">
            {step === 1 ? t.chooseIntro : t[`${kind}Hint`]}
          </p>
        </>
      )}
      {!receipt && step === 1 && (
        <div
          ref={typeButtons}
          className="grid gap-3 sm:grid-cols-2"
          data-testid="report-types"
        >
          {kinds.map((item) => {
            const Icon = icons[item];
            return (
              <button
                key={item}
                data-kind={item}
                type="button"
                onClick={() => chooseKind(item)}
                className="group flex min-h-28 items-start gap-3 rounded-2xl border border-border bg-card p-5 text-start hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-base">{t[item]}</strong>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                    {t[`${item}Choice`]}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="mt-2 size-4 shrink-0 text-muted-foreground rtl:rotate-180"
                />
              </button>
            );
          })}
          <p className="mt-2 text-sm leading-7 text-muted-foreground sm:col-span-2">
            {t.openNote}
          </p>
        </div>
      )}
      {receipt ? (
        <div
          ref={success}
          tabIndex={-1}
          className="rounded-2xl border border-border bg-card p-7"
        >
          <Check className="mb-4 size-9 text-primary" aria-hidden />
          <h2 className="text-xl font-bold">{t.thanks}</h2>
          <p className="mt-4 text-sm">
            {t.reference}: <bdi>{receipt.id}</bdi>
          </p>
          {receipt.issueUrl && (
            <a
              href={receipt.issueUrl}
              className="mt-4 inline-block py-2 text-primary underline underline-offset-4"
            >
              {t.seeReport}
            </a>
          )}
          <button
            type="button"
            className={`${secondary} mt-5 block`}
            onClick={() => {
              setReceipt(null);
              last.current = null;
              setError(null);
              setCar(null);
              setCarCount("");
              setStep(1);
              requestAnimationFrame(() => heading.current?.focus());
            }}
          >
            {t.another}
          </button>
        </div>
      ) : (
        <form
          ref={form}
          onSubmit={submit}
          method="post"
          className={
            step === 1
              ? "hidden"
              : "flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:p-7"
          }
          data-testid="report-form"
        >
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <SelectField
              label={t.city}
              name="cityId"
              value={cityId}
              onChange={changeCity}
              options={[
                ...catalog.cities.map((item) => ({
                  value: item.id,
                  label: item.names[lang],
                })),
                { value: "other", label: t.otherCity },
              ]}
            />
            {city && (
              <SelectField
                label={t.selectStation}
                name="stationId"
                value={stationId}
                onChange={setStationId}
                searchLabel={t.findStation}
                emptyLabel={t.empty}
                options={[
                  { value: "", label: t.noStation },
                  ...stations.map((station) => ({
                    value: station.id,
                    label: station.names[lang],
                    search: `${station.names.fa} ${station.names.en} ${city.names[lang]}`,
                  })),
                ]}
              />
            )}
          </div>
          {!city && (
            <p className="text-sm leading-7 text-muted-foreground">
              {t.otherCityHint}
            </p>
          )}
          <input type="hidden" name="kind" value={kind} />
          {!["facility", "status", "wagon"].includes(kind) && (
            <label className="flex flex-col gap-2 text-sm font-semibold">
              {kind === "timetable"
                ? t.lineDirection
                : kind === "location"
                  ? t.stationAddress
                  : t.subject}
              <input name="subject" maxLength={160} className={input} />
            </label>
          )}
          {kind === "facility" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label={t.fieldFacility}
                name="amenity"
                options={[
                  { value: "", label: t.chooseOption },
                  ...[
                    "elevator",
                    "wc",
                    "atm",
                    "coffeeShop",
                    "fastFood",
                    "groceryStore",
                    "freeWifi",
                    "prayerRoom",
                    "parking",
                    "police",
                  ].map((key) => ({ value: key, label: t[key as StringKey] })),
                ]}
              />
              <SelectField
                label={t.observedValue}
                name="value"
                options={[
                  { value: "", label: t.chooseOption },
                  { value: "true", label: t.available },
                  { value: "false", label: t.absent },
                  { value: "null", label: t.unknown },
                ]}
              />
            </div>
          )}
          {kind === "status" && (
            <SelectField
              label={t.status}
              name="status"
              options={[
                { value: "", label: t.chooseOption },
                ...[
                  "operational",
                  "under_construction",
                  "planned",
                  "temporarily_closed",
                ].map((key) => ({ value: key, label: t[key as StringKey] })),
              ]}
            />
          )}
          {kind === "wagon" && (
            <fieldset className="min-w-0 rounded-xl border border-border p-4">
              <legend className="px-1 font-semibold">{t.wagon}</legend>
              <p className="mb-4 text-sm leading-7 text-muted-foreground">
                {t.carHint}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  {t.carCount}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={12}
                    value={carCount}
                    onChange={(event) => {
                      setCarCount(event.target.value);
                      setCar(null);
                    }}
                    className={input}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  {t.direction}
                  <input name="direction" maxLength={100} className={input} />
                </label>
              </div>
              {Number(carCount) >= 2 && Number(carCount) <= 12 && (
                <div className="mt-4 flex gap-1 overflow-x-auto pb-3" dir="ltr">
                  {Array.from(
                    { length: Math.floor(Number(carCount)) },
                    (_, index) => index + 1,
                  ).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={car === value}
                      aria-label={`${t.car} ${value}`}
                      onClick={() => setCar(value)}
                      className={`min-h-16 min-w-14 rounded-lg border-2 p-3 font-bold ${car === value ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
          )}
          <label className="flex flex-col gap-2 text-sm font-semibold">
            {t.details}
            <textarea
              name="details"
              rows={4}
              placeholder={t[`${kind}Placeholder`]}
              maxLength={3600}
              className={input}
            />
          </label>
          <details className="min-w-0 rounded-xl border border-border p-4">
            <summary className="min-h-7 cursor-pointer text-sm font-semibold">
              {t.evidenceHeading}
            </summary>
            <div className="mt-4 grid gap-5">
              <label className="flex flex-col gap-2 text-sm font-semibold">
                {t.source}
                <input
                  name="source"
                  type="text"
                  inputMode="url"
                  maxLength={500}
                  dir="auto"
                  className={input}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold">
                {t.photo}
                <input
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-describedby="photo-hint"
                  className={input}
                />
                <small
                  id="photo-hint"
                  className="text-xs font-normal text-muted-foreground"
                >
                  {t.photoHint}
                </small>
              </label>
            </div>
          </details>
          <details className="border-t border-border pt-3">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
              {t.contactHeading}
            </summary>
            <p className="my-3 text-xs leading-7 text-muted-foreground">
              {t.contactNote}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                {t.name}
                <input
                  name="name"
                  autoComplete="name"
                  maxLength={80}
                  className={input}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                {t.contact}
                <input
                  name="contact"
                  maxLength={200}
                  dir="auto"
                  className={input}
                />
              </label>
            </div>
          </details>
          <div className="sr-only" aria-hidden>
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <p className="text-xs leading-7 text-muted-foreground">
            {t.publicNote}
          </p>
          {!enabled && (
            <p
              role="status"
              className="rounded-xl bg-muted p-4 text-sm leading-7"
            >
              {t.unavailable}{" "}
              <a
                href={`https://github.com/aliinreallife/metto-data/issues/new?title=${encodeURIComponent(`[${cityId}] ${kind}`)}`}
                className="font-semibold text-primary underline underline-offset-4"
              >
                {t.githubReport}
              </a>
            </p>
          )}
          <p
            ref={message}
            role={error ? "alert" : "status"}
            tabIndex={-1}
            aria-live="polite"
            className="text-sm leading-7 text-destructive"
          >
            {error ? t[error] : pending ? t.sending : ""}
          </p>
          <button
            type="submit"
            disabled={pending || !enabled}
            className={primary}
          >
            {pending ? t.sending : t.send}
          </button>
        </form>
      )}
    </section>
  );
}
