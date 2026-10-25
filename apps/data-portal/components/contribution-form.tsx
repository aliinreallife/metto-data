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
import { WagonPicker } from "./wagon-picker";
import type { AccountUser } from "./account";
import { SelectField } from "./select-field";
import { resolveTrainProfile } from "../lib/train-layouts";
type Kind =
  | "timetable"
  | "facility"
  | "status"
  | "location"
  | "wagon"
  | "other"
  | "city_request";
const kinds: Kind[] = [
  "timetable",
  "facility",
  "status",
  "location",
  "wagon",
  "other",
  "city_request",
];
const icons = {
  timetable: Clock3,
  facility: Accessibility,
  status: CircleAlert,
  location: MapPin,
  wagon: TrainFront,
  other: MessageSquare,
  city_request: MapPin,
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
  previewMode,
  account,
  authConfigured,
}: {
  catalog: Catalog;
  lang: Lang;
  initialCity: string;
  initialStation: string;
  initialKind: string;
  enabled: boolean;
  previewMode: boolean;
  account: AccountUser | null;
  authConfigured: boolean;
}) {
  const t = STRINGS[lang],
    [cityId, setCityId] = useState(initialCity || "mashhad"),
    [step, setStep] = useState<1 | 2 | 3>(1),
    [kind, setKind] = useState<Kind>(
      kinds.includes(initialKind as Kind) ? (initialKind as Kind) : "other",
    ),
    [stationId, setStationId] = useState(initialStation),
    [trainProfileId, setTrainProfileId] = useState(""),
    [amenityRows, setAmenityRows] = useState([0]),
    [car, setCar] = useState<number | null>(null),
    [pending, setPending] = useState(false),
    [draft, setDraft] = useState<{
      cityId: string;
      stationId: string;
      kind: Kind;
      subject: string;
      details: string;
      source: string;
      name: string;
      contact: string;
      website: string;
      publicCredit: boolean;
      photo?: string;
    } | null>(null),
    [reviewNotes, setReviewNotes] = useState(""),
    [reviewObservation, setReviewObservation] = useState(""),
    [credit, setCredit] = useState(false),
    [publicName, setPublicName] = useState(""),
    [error, setError] = useState<StringKey | null>(null),
    [receipt, setReceipt] = useState<{
      id: string;
      issueUrl?: string;
      creditId?: string;
    } | null>(null);
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
  const kindLabel = (value: Kind) =>
    value === "city_request" ? t.cityRequest : t[value];
  const chooseKind = (value: Kind) => {
    if (value === "city_request") {
      setCityId("other");
      setStationId("");
      setTrainProfileId("");
      setCar(null);
    }
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
    setTrainProfileId("");
    setCar(null);
  };
  const wagonLines =
    stations
      .find((station) => station.id === stationId)
      ?.lines.map((line) => line.id) ?? [];
  const selectedTrain = resolveTrainProfile(
    cityId,
    wagonLines,
    trainProfileId,
    stationId,
  );
  const carCount = selectedTrain?.cars ?? 0;
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step !== 2 || pending) return;
    const fields = new FormData(event.currentTarget),
      details = String(fields.get("details") ?? "").trim(),
      file = (fields.get("photo") as File | null) ?? undefined;
    let observation = "";
    if (kind === "facility")
      observation = fields
        .getAll("amenity")
        .map((amenity, index) =>
          amenity && fields.getAll("value")[index]
            ? `Amenity: ${amenity}; observed value: ${fields.getAll("value")[index]}`
            : "",
        )
        .filter(Boolean)
        .join("\n");
    if (kind === "status" && fields.get("status"))
      observation = `Observed status: ${fields.get("status")}`;
    if (kind === "wagon" && selectedTrain && car && car <= selectedTrain.cars)
      observation = `Car ${car} of ${carCount}; direction: ${String(fields.get("direction") ?? "").trim()}; layout reference: ${selectedTrain.id}`;
    if (!details && !observation && !file?.size) {
      setError("required");
      return;
    }
    if ([details, observation].filter(Boolean).join("\n\n").length > 4000) {
      setError("detailsTooLong");
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
        publicCredit: credit && !!account?.emailVerified,
        ...(photo ? { photo } : {}),
      };
      setDraft(payload);
      setReviewNotes(details);
      setReviewObservation(
        kind === "facility"
          ? fields
              .getAll("amenity")
              .map((amenity, index) => {
                const value = fields.getAll("value")[index];
                return amenity && value
                  ? `${t[String(amenity) as StringKey]}: ${value === "true" ? t.available : value === "false" ? t.absent : t.unknown}`
                  : "";
              })
              .filter(Boolean)
              .join(" · ")
          : kind === "status" && fields.get("status")
            ? t[String(fields.get("status")) as StringKey]
            : kind === "wagon" && car
              ? `${t.car} ${new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(car)} ${t.ofCars} ${new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(Number(carCount))}${fields.get("direction") ? ` · ${fields.get("direction")}` : ""}`
              : "",
      );
      setStep(3);
      requestAnimationFrame(() => {
        heading.current?.focus({ preventScroll: true });
        window.scrollTo({ top: 0 });
      });
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
  const sendDraft = async () => {
    if (step !== 3 || !draft || pending || !enabled) return;
    if (credit && !account?.emailVerified) {
      setError("loginRequired");
      return;
    }
    if (
      credit &&
      account &&
      (publicName.trim().length < 2 ||
        publicName.trim().length > 80 ||
        /[@\u0000-\u001f\u007f]/.test(publicName))
    ) {
      setError("publicNameError");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const payload = {
        ...draft,
        publicCredit: credit && !!account?.emailVerified,
        ...(credit && account ? { publicName: publicName.trim() } : {}),
      };
      const fingerprint = JSON.stringify([
        payload,
        credit && account ? { id: account.id, name: account.name } : null,
      ]);
      if (last.current?.fingerprint !== fingerprint)
        last.current = { fingerprint, id: crypto.randomUUID() };
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...payload, id: last.current!.id }),
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw Error(
          failure?.error === "photo_capacity"
            ? "photoStorageFull"
            : response.status === 401
              ? "loginRequired"
              : response.status === 429
                ? "limited"
                : response.status === 503
                  ? "busy"
                  : "failed",
        );
      }
      const result = (await response.json()) as {
        id: string;
        issueUrl?: string;
      };
      if (!result.id) throw Error("failed");
      setReceipt(result);
    } catch (caught) {
      const key = caught instanceof Error ? caught.message : "";
      setError(
        ["loginRequired", "limited", "busy", "photoStorageFull"].includes(key)
          ? (key as StringKey)
          : "failed",
      );
    } finally {
      setPending(false);
    }
  };
  const reviewCity = catalog.cities.find((city) => city.id === draft?.cityId);
  const reviewStation = reviewCity?.stations.find(
    (station) => station.id === draft?.stationId,
  );
  return (
    <section className="mx-auto max-w-3xl">
      {!receipt && (
        <>
          <ol
            aria-label={t.reportSteps}
            className="mb-7 flex items-center gap-2 text-xs sm:gap-3 sm:text-sm"
          >
            {[1, 2, 3].map((value) => (
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
                {value === 1
                  ? t.chooseChange
                  : value === 2
                    ? t.changeDetails
                    : t.reviewSend}
                {value < 3 && (
                  <span
                    aria-hidden
                    className="ms-1 h-px w-3 bg-border sm:w-8"
                  />
                )}
              </li>
            ))}
          </ol>
          {step > 1 && (
            <button
              type="button"
              disabled={pending}
              onClick={
                step === 3
                  ? () => {
                      setStep(2);
                      setError(null);
                      requestAnimationFrame(() =>
                        heading.current?.focus({ preventScroll: true }),
                      );
                    }
                  : backToKinds
              }
              className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
            >
              <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
              {step === 3 ? t.editReport : t.changeType}
            </button>
          )}
          <h1
            ref={heading}
            tabIndex={-1}
            className="scroll-mt-24 text-2xl font-bold sm:text-3xl"
          >
            {step === 1
              ? t.chooseTitle
              : step === 2
                ? kindLabel(kind)
                : t.confirmTitle}
          </h1>
          <p className="mb-6 mt-3 text-sm leading-7 text-muted-foreground">
            {step === 1
              ? t.chooseIntro
              : step === 2
                ? t[`${kind === "city_request" ? "cityRequest" : kind}Hint`]
                : t.confirmIntro}
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
                  <strong className="block text-base">{kindLabel(item)}</strong>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                    {
                      t[
                        `${item === "city_request" ? "cityRequest" : item}Choice`
                      ]
                    }
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
          <h2 className="text-xl font-bold">
            {previewMode ? t.testThanks : t.thanks}
          </h2>
          <p className="mt-4 text-sm">
            {t.reference}: <bdi>{receipt.id}</bdi>
          </p>
          {receipt.creditId && (
            <a
              href={`/contributors/${receipt.creditId}?lang=${lang}`}
              className="mt-4 inline-block py-2 text-primary underline underline-offset-4"
            >
              {t.profile}
            </a>
          )}
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
              setTrainProfileId("");
              setDraft(null);
              setCredit(false);
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
            step !== 2
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
            {city && kind !== "city_request" && (
              <SelectField
                label={t.selectStation}
                name="stationId"
                value={stationId}
                onChange={(value) => {
                  setStationId(value);
                  setTrainProfileId("");
                  setCar(null);
                }}
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
                  : kind === "city_request"
                    ? t.cityRequestSubject
                    : t.subject}
              <input
                name="subject"
                required={kind === "city_request"}
                maxLength={160}
                className={input}
              />
            </label>
          )}
          {kind === "facility" && (
            <fieldset className="min-w-0 space-y-4">
              <legend className="mb-3 text-sm text-muted-foreground">
                {t.multipleAmenities}
              </legend>
              {amenityRows.map((row, index) => (
                <div key={row} className="rounded-xl border border-border p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField
                      label={
                        t.fieldFacility +
                        (amenityRows.length > 1
                          ? ` ${new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(index + 1)}`
                          : "")
                      }
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
                        ].map((key) => ({
                          value: key,
                          label: t[key as StringKey],
                        })),
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
                  {amenityRows.length > 1 && (
                    <button
                      className="mt-3 min-h-11 text-sm font-semibold text-primary"
                      type="button"
                      aria-label={`${t.removeAmenity} ${index + 1}`}
                      onClick={() =>
                        setAmenityRows((rows) =>
                          rows.filter((value) => value !== row),
                        )
                      }
                    >
                      {t.removeAmenity}
                    </button>
                  )}
                </div>
              ))}
              {amenityRows.length < 10 && (
                <button
                  type="button"
                  className={secondary}
                  onClick={() =>
                    setAmenityRows((rows) => [...rows, Math.max(...rows) + 1])
                  }
                >
                  {t.addAmenity}
                </button>
              )}
            </fieldset>
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
            <WagonPicker
              lang={lang}
              cityId={cityId}
              stationId={stationId}
              lineIds={wagonLines}
              profileId={selectedTrain?.id ?? ""}
              onProfile={(value) => {
                setTrainProfileId(value);
                setCar(null);
              }}
              selected={car}
              onSelect={setCar}
            />
          )}
          <label className="flex flex-col gap-2 text-sm font-semibold">
            {t.details}
            <textarea
              name="details"
              rows={4}
              placeholder={
                t[
                  `${kind === "city_request" ? "cityRequest" : kind}Placeholder`
                ]
              }
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
          <p
            ref={step === 2 ? message : undefined}
            role={error && step === 2 ? "alert" : "status"}
            tabIndex={-1}
            aria-live="polite"
            className="text-sm leading-7 text-destructive"
          >
            {step === 2 && error
              ? t[error]
              : pending && step === 2
                ? t.preparing
                : ""}
          </p>
          <button type="submit" disabled={pending} className={primary}>
            {pending ? t.preparing : t.reviewReport}
            <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
          </button>
        </form>
      )}
      {!receipt && step === 3 && draft && (
        <div
          className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7"
          data-testid="report-review"
        >
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{t.kind}</dt>
              <dd className="mt-1 font-semibold">{kindLabel(draft.kind)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t.city}</dt>
              <dd className="mt-1 font-semibold">
                {reviewCity?.names[lang] ?? t.otherCity}
              </dd>
            </div>
            {draft.stationId && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">{t.station}</dt>
                <dd className="mt-1 font-semibold">
                  {reviewStation?.names[lang]}
                </dd>
              </div>
            )}
            {draft.subject && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">{t.subject}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">
                  {draft.subject}
                </dd>
              </div>
            )}
            {reviewObservation && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">
                  {t.observedValue}
                </dt>
                <dd className="mt-1 font-semibold">{reviewObservation}</dd>
              </div>
            )}
            {reviewNotes && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">{t.details}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-7">
                  {reviewNotes}
                </dd>
              </div>
            )}
            {draft.source && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">{t.source}</dt>
                <dd dir="auto" className="mt-1 break-all text-sm">
                  {draft.source}
                </dd>
              </div>
            )}
          </dl>
          {draft.photo && (
            <div className="space-y-2">
              <img
                src={`data:image/jpeg;base64,${draft.photo}`}
                alt={t.reviewPhoto}
                className="max-h-72 w-full rounded-xl border border-border object-contain"
              />
              <button
                type="button"
                className={secondary}
                disabled={pending}
                onClick={() => {
                  const file = form.current?.querySelector<HTMLInputElement>(
                    'input[name="photo"]',
                  );
                  if (file) file.value = "";
                  setDraft({ ...draft, photo: undefined });
                  setError(null);
                  setStep(2);
                  requestAnimationFrame(() =>
                    heading.current?.focus({ preventScroll: true }),
                  );
                }}
              >
                {t.removePhoto}
              </button>
            </div>
          )}
          {(draft.name || draft.contact) && (
            <div className="rounded-xl bg-muted/60 p-4 text-sm leading-7">
              <p className="font-semibold">{t.privateContact}</p>
              <p>{draft.name}</p>
              <p dir="auto">{draft.contact}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.contactNote}
              </p>
            </div>
          )}
          {account?.emailVerified || credit ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 text-sm leading-7">
              <input
                className="mt-1.5 size-4 shrink-0 accent-primary"
                type="checkbox"
                checked={credit}
                disabled={pending}
                onChange={(event) => setCredit(event.target.checked)}
              />
              <span>
                <strong className="block">{t.creditAs}</strong>
                <span className="text-muted-foreground">{t.creditHint}</span>
              </span>
            </label>
          ) : (
            authConfigured && (
              <p className="text-sm leading-7 text-muted-foreground">
                {t.anonymousCredit}{" "}
                <a
                  href={`/account?lang=${lang}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary underline underline-offset-4"
                >
                  {t.optionalLogin}
                </a>
              </p>
            )
          )}
          {account?.emailVerified && credit && (
            <div className="flex flex-col gap-2 text-sm">
              <label htmlFor="report-public-name" className="font-semibold">
                {t.displayName}
              </label>
              <input
                id="report-public-name"
                disabled={pending}
                value={publicName}
                onChange={(event) => setPublicName(event.target.value)}
                maxLength={80}
                autoComplete="nickname"
                aria-describedby="report-public-name-hint"
                aria-invalid={error === "publicNameError" || undefined}
                className={input}
              />
              <p
                id="report-public-name-hint"
                className="text-xs text-muted-foreground"
              >
                {t.publicNameHint}
              </p>
            </div>
          )}
          {!previewMode && (
            <p className="text-xs leading-7 text-muted-foreground">
              {t.publicNote}
            </p>
          )}
          {previewMode && (
            <p
              role="note"
              className="rounded-xl bg-muted p-4 text-sm leading-7"
            >
              {t.previewReportNote}
            </p>
          )}
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
            type="button"
            disabled={pending || !enabled}
            onClick={sendDraft}
            className={`${primary} w-full`}
          >
            <Check aria-hidden className="size-4" />
            {pending
              ? t.sending
              : previewMode
                ? t.confirmTestSend
                : t.confirmSend}
          </button>
        </div>
      )}
    </section>
  );
}
