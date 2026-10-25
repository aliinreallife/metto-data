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
  Camera,
  Link2,
  Plus,
  X,
  UserRound,
  ShieldCheck,
  Mail,
} from "lucide-react";
import type { Catalog, Lang } from "../lib/catalog";
import { STRINGS, type StringKey } from "../lib/i18n";
import { preparePhoto } from "../lib/photo";
import { WagonPicker } from "./wagon-picker";
import type { AccountUser } from "./account";
import { SelectField } from "./select-field";
import { resolveTrainProfile } from "../lib/train-layouts";
import { trainDirections } from "../lib/train-directions";
import { stationExits } from "../lib/station-exits";
import {
  reportObservation,
  type WagonObservation,
} from "../lib/report-observation";
import {
  DRAFT_KEY,
  amenityKeys,
  newReportForm,
  parseReportDraft,
  reportKinds,
  saveReportDraft,
  type ReportFormState,
  type ReportKind,
  type SavedReportDraft,
} from "../lib/report-draft";
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
  "w-full min-h-12 rounded-xl border border-input bg-card px-3 py-3 text-base";
const primary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground";
const secondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input bg-card px-4 py-2 text-sm font-semibold hover:bg-muted";
const statuses = [
  "operational",
  "under_construction",
  "planned",
  "temporarily_closed",
];
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
    [state, setState] = useState<ReportFormState>(() =>
      newReportForm(initialCity, initialStation, initialKind),
    );
  const [pending, setPending] = useState(false),
    [photoPending, setPhotoPending] = useState(false),
    [error, setError] = useState<StringKey | null>(null);
  const [receipt, setReceipt] = useState<{
      id: string;
      issueUrl?: string;
      creditId?: string;
    } | null>(null),
    [hydrated, setHydrated] = useState(false);
  const [recover, setRecover] = useState<SavedReportDraft | null>(null),
    [sourceOpen, setSourceOpen] = useState(false),
    [loginSeparate, setLoginSeparate] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null),
    message = useRef<HTMLParagraphElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    form = useRef<HTMLFormElement>(null),
    success = useRef<HTMLDivElement>(null);
  const last = useRef<SavedReportDraft["retry"]>(undefined);
  const city = catalog.cities.find((c) => c.id === state.cityId),
    stations = city?.stations ?? [],
    station = stations.find((s) => s.id === state.stationId);
  const wagonLines = station?.operationalLineIds ?? [];
  const profile = resolveTrainProfile(
    state.cityId,
    wagonLines,
    state.trainProfileId,
    state.stationId,
  );
  const directions = trainDirections(city, profile, state.stationId),
    direction = directions.find((d) => d.id === state.directionId);
  const exits = stationExits(state.stationId, state.directionId),
    exit = exits.find((e) => e.id === state.exitId) ?? exits[0];
  const observation = reportObservation(
    state,
    lang,
    city,
    direction,
    profile,
    exit,
  );
  const number = (n: number) =>
    new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(n);
  const kindLabel = (kind: ReportKind) =>
    kind === "city_request" ? t.cityRequest : t[kind];
  const patch = (value: Partial<ReportFormState>) => {
    setState((s) => ({ ...s, ...value }));
    setError(null);
  };
  const focusHeading = () =>
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    });
  const persist = (value = state) => {
    try {
      return saveReportDraft(window.sessionStorage, value, last.current);
    } catch {
      return false;
    }
  };
  const clearSaved = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {}
  };
  function restoreSaved(saved: SavedReportDraft) {
    const targets = stationExits(saved.form.stationId, saved.form.directionId);
    setState(
      targets.some((exit) => exit.id === saved.form.exitId)
        ? saved.form
        : { ...saved.form, exitId: targets[0]?.id ?? "", car: null },
    );
    last.current = saved.retry;
    setSourceOpen(!!saved.form.source);
    setRecover(null);
  }
  useEffect(() => {
    let saved: SavedReportDraft | null = null;
    try {
      saved = parseReportDraft(sessionStorage.getItem(DRAFT_KEY));
    } catch {}
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (saved) {
      if (
        new URL(location.href).searchParams.get("resume") === "1" ||
        ["reload", "back_forward"].includes(navigation?.type ?? "")
      ) {
        restoreSaved(saved);
      } else setRecover(saved);
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated && state.step > 1 && !receipt) persist();
  }, [state, hydrated, receipt]);
  useEffect(() => {
    if (error) message.current?.focus();
  }, [error]);
  useEffect(() => {
    if (receipt) success.current?.focus();
  }, [receipt]);
  const chooseKind = (kind: ReportKind) => {
    setRecover(null);
    patch({
      kind,
      step: 2,
      ...(kind === "city_request"
        ? {
            cityId: "other",
            stationId: "",
            trainProfileId: "",
            directionId: "",
            exitId: "up-escalator",
            car: null,
            statusLineId: "",
          }
        : {}),
    });
    focusHeading();
  };
  const changeCity = (cityId: string) =>
    patch({
      cityId,
      stationId: "",
      trainProfileId: "",
      directionId: "",
      exitId: "up-escalator",
      car: null,
      statusLineId: "",
    });
  const changeStation = (stationId: string) =>
    patch({
      stationId,
      trainProfileId: "",
      directionId: "",
      exitId: "up-escalator",
      car: null,
      statusLineId: "",
    });
  function valid() {
    if (
      state.kind === "wagon" &&
      state.car &&
      (!station || !direction || !profile || state.car > profile.cars || !exit)
    ) {
      setError("wagonContextRequired");
      return false;
    }
    if (state.kind === "facility") {
      const rows = state.amenities.filter((row) => row.amenity);
      if (rows.length && !station) {
        setError("stationRequired");
        return false;
      }
      if (rows.some((row) => !row.value)) {
        setError("amenityValueRequired");
        return false;
      }
      if (new Set(rows.map((row) => row.amenity)).size !== rows.length) {
        setError("amenityDuplicate");
        return false;
      }
    }
    if (!state.details.trim() && !observation && !state.photo) {
      setError("required");
      return false;
    }
    if (
      [state.details.trim(), observation].filter(Boolean).join("\n\n").length >
      4000
    ) {
      setError("detailsTooLong");
      return false;
    }
    if (state.source.trim()) {
      try {
        const url = new URL(state.source.trim());
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          throw Error();
      } catch {
        setError("sourceError");
        return false;
      }
    }
    return true;
  }
  function review(event: React.FormEvent) {
    event.preventDefault();
    if (pending || photoPending || !valid()) return;
    patch({ step: 3 });
    focusHeading();
  }
  async function photoChange(file: File | undefined) {
    if (!file) return;
    setPhotoPending(true);
    setError(null);
    try {
      const photo = await preparePhoto(file);
      patch({ photo: photo ?? "", photoName: file.name.slice(0, 180) });
    } catch {
      setError("photoError");
      if (fileInput.current) fileInput.current.value = "";
    } finally {
      setPhotoPending(false);
    }
  }
  function removePhoto() {
    patch({ photo: "", photoName: "" });
    if (fileInput.current) fileInput.current.value = "";
  }
  const params = new URLSearchParams({
    lang,
    city: state.cityId,
    kind: state.kind,
    resume: "1",
  });
  if (state.stationId) params.set("station", state.stationId);
  const returnTo = "/contribute?" + params.toString(),
    loginHref =
      "/account?" + new URLSearchParams({ lang, returnTo }).toString();
  function beforeLogin(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!persist()) {
      event.preventDefault();
      window.open(loginHref, "_blank", "noopener,noreferrer");
      setLoginSeparate(true);
    }
  }
  async function send() {
    if (pending || !enabled || !valid()) return;
    const credit = state.contactMode === "credit";
    if (credit && !account?.emailVerified) {
      setError("loginRequired");
      return;
    }
    if (
      credit &&
      (state.publicName.trim().length < 2 ||
        /[@\u0000-\u001f\u007f]/.test(state.publicName))
    ) {
      setError("publicNameError");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const wagon: WagonObservation | undefined =
        state.kind === "wagon" && state.car && profile && direction && exit
          ? {
              car: state.car,
              cars: profile.cars,
              profileId: profile.id,
              lineId: direction.lineId,
              routeId: direction.routeId,
              destinationId: direction.destinationId,
              exitId: exit.id,
            }
          : undefined;
      const payload = {
        cityId: state.cityId,
        stationId: state.stationId,
        kind: state.kind,
        subject: state.subject.trim(),
        details: [state.details.trim(), observation]
          .filter(Boolean)
          .join("\n\n"),
        source: state.source.trim(),
        name: state.contactMode === "anonymous" ? "" : state.name.trim(),
        contact: state.contactMode === "anonymous" ? "" : state.contact.trim(),
        website: String(new FormData(form.current!).get("website") ?? ""),
        publicCredit: credit,
        ...(credit ? { publicName: state.publicName.trim() } : {}),
        ...(state.photo ? { photo: state.photo } : {}),
        ...(wagon ? { wagon } : {}),
      };
      const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          JSON.stringify([payload, credit ? account?.id : null]),
        ),
      );
      const fingerprint = Array.from(new Uint8Array(bytes), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      if (last.current?.fingerprint !== fingerprint)
        last.current = { fingerprint, id: crypto.randomUUID() };
      persist();
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
                  : response.status === 413
                    ? "photoError"
                    : "failed",
        );
      }
      setReceipt(await response.json());
      clearSaved();
    } catch (caught) {
      const key = caught instanceof Error ? caught.message : "failed";
      setError(
        [
          "photoStorageFull",
          "loginRequired",
          "limited",
          "busy",
          "photoError",
        ].includes(key)
          ? (key as StringKey)
          : "failed",
      );
    } finally {
      setPending(false);
    }
  }
  const introduction =
    state.step === 1
      ? t.chooseIntro
      : state.step === 2
        ? t[
            ((state.kind === "city_request" ? "cityRequest" : state.kind) +
              "Hint") as StringKey
          ]
        : t.confirmIntro;
  const labelClass = "flex flex-col gap-2 text-sm font-semibold";
  const contactModes = [
    {
      id: "anonymous",
      label: t.submitAnonymous,
      description: t.anonymousModeNote,
      Icon: ShieldCheck,
    },
    {
      id: "contact",
      label: t.leaveContact,
      description: t.manualContactNote,
      Icon: Mail,
    },
    ...(authConfigured || account
      ? [
          {
            id: "credit",
            label: account ? t.withPublicCredit : t.signInForCredit,
            description: t.leaderboardLoginNote,
            Icon: UserRound,
          },
        ]
      : []),
  ];
  return (
    <section className="mx-auto max-w-3xl">
      {!receipt && (
        <>
          <ol
            aria-label={t.reportSteps}
            className="mb-6 flex items-center gap-2 text-xs sm:gap-3 sm:text-sm"
          >
            {[1, 2, 3].map((step) => (
              <li
                key={step}
                aria-current={state.step === step ? "step" : undefined}
                className={
                  "flex items-center gap-2 " +
                  (state.step === step
                    ? "font-semibold text-primary"
                    : "text-muted-foreground")
                }
              >
                <span
                  className={
                    "grid size-7 place-items-center rounded-full " +
                    (state.step === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted")
                  }
                >
                  {number(step)}
                </span>
                {step === 1
                  ? t.chooseChange
                  : step === 2
                    ? t.changeDetails
                    : t.reviewSend}
                {step < 3 && (
                  <span
                    className="ms-1 h-px w-3 bg-border sm:w-8"
                    aria-hidden
                  />
                )}
              </li>
            ))}
          </ol>
          {state.step > 1 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                patch({ step: state.step === 3 ? 2 : 1 });
                focusHeading();
              }}
              className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
            >
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
              {state.step === 3 ? t.editReport : t.changeType}
            </button>
          )}
          <h1
            ref={heading}
            tabIndex={-1}
            className="scroll-mt-24 text-2xl font-bold sm:text-3xl"
          >
            {state.step === 1
              ? t.chooseTitle
              : state.step === 2
                ? kindLabel(state.kind)
                : t.confirmTitle}
          </h1>
          {introduction && (
            <p className="mb-6 mt-3 text-sm leading-7 text-muted-foreground">
              {introduction}
            </p>
          )}
        </>
      )}
      {!receipt && state.step === 1 && (
        <>
          {recover && (
            <div className="mb-5 mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/50 p-4 text-sm">
              <p className="flex-1">{t.savedDraftFound}</p>
              <button
                type="button"
                className={secondary}
                onClick={() => {
                  restoreSaved(recover);
                  focusHeading();
                }}
              >
                {t.resumeDraft}
              </button>
              <button
                type="button"
                className="min-h-11 px-2 text-muted-foreground"
                onClick={() => {
                  setRecover(null);
                  clearSaved();
                }}
              >
                {t.startFresh}
              </button>
            </div>
          )}
          <div
            className="mt-6 grid gap-3 sm:grid-cols-2"
            data-testid="report-types"
          >
            {reportKinds.map((kind) => {
              const Icon = icons[kind];
              return (
                <button
                  key={kind}
                  data-kind={kind}
                  type="button"
                  onClick={() => chooseKind(kind)}
                  className="group flex min-h-24 items-start gap-3 rounded-2xl border border-border bg-card p-4 text-start hover:border-primary/50 hover:bg-primary/5"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block">{kindLabel(kind)}</strong>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      {
                        t[
                          ((kind === "city_request" ? "cityRequest" : kind) +
                            "Choice") as StringKey
                        ]
                      }
                    </span>
                  </span>
                  <ArrowRight
                    className="mt-2 size-4 shrink-0 text-muted-foreground rtl:rotate-180"
                    aria-hidden
                  />
                </button>
              );
            })}
            <p className="text-sm leading-7 text-muted-foreground sm:col-span-2">
              {t.openNote}
            </p>
          </div>
        </>
      )}
      {receipt ? (
        <div
          ref={success}
          tabIndex={-1}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <Check className="mb-4 size-9 text-primary" aria-hidden />
          <h2 className="text-xl font-bold">{t.thanks}</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {t.receivedNote}
          </p>
          {receipt.issueUrl && (
            <a
              href={receipt.issueUrl}
              className="mt-4 inline-block py-2 text-primary underline"
            >
              {t.viewIssue}
            </a>
          )}
          {receipt.creditId && (
            <a
              href={"/contributors/" + receipt.creditId + "?lang=" + lang}
              className="mt-4 block text-primary underline"
            >
              {t.profile}
            </a>
          )}
          <button
            type="button"
            className={"mt-6 " + secondary}
            onClick={() => {
              const next = newReportForm(
                state.cityId,
                state.stationId,
                "other",
              );
              setState(next);
              setReceipt(null);
              setError(null);
              last.current = undefined;
              setSourceOpen(false);
              clearSaved();
              focusHeading();
            }}
          >
            {t.another}
          </button>
        </div>
      ) : (
        <form
          ref={form}
          onSubmit={review}
          className={
            state.step !== 2
              ? "hidden"
              : "mt-5 flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:p-7"
          }
          data-testid="report-form"
        >
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <SelectField
              label={t.city}
              name="cityId"
              value={state.cityId}
              onChange={changeCity}
              options={[
                ...catalog.cities.map((c) => ({
                  value: c.id,
                  label: c.names[lang],
                })),
                { value: "other", label: t.otherCity },
              ]}
            />
            {city && state.kind !== "city_request" && (
              <SelectField
                label={
                  ["wagon", "facility"].includes(state.kind)
                    ? t.station
                    : t.selectStation
                }
                name="stationId"
                value={state.stationId}
                onChange={changeStation}
                searchLabel={t.findStation}
                emptyLabel={t.empty}
                options={[
                  {
                    value: "",
                    label: ["wagon", "facility"].includes(state.kind)
                      ? t.chooseStation
                      : t.noStation,
                  },
                  ...stations.map((s) => ({
                    value: s.id,
                    label: s.names[lang],
                    search: s.names.fa + " " + s.names.en,
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
          <input type="hidden" name="kind" value={state.kind} />
          {!["facility", "status", "wagon"].includes(state.kind) && (
            <label className={labelClass}>
              {state.kind === "timetable"
                ? t.lineDirection
                : state.kind === "location"
                  ? t.stationAddress
                  : state.kind === "city_request"
                    ? t.cityRequestSubject
                    : t.subject}
              <input
                name="subject"
                required={state.kind === "city_request"}
                value={state.subject}
                onChange={(e) => patch({ subject: e.target.value })}
                maxLength={160}
                className={input}
              />
            </label>
          )}
          {state.kind === "facility" && (
            <fieldset className="min-w-0 space-y-3">
              <legend className="mb-3 text-sm text-muted-foreground">
                {t.multipleAmenities}
              </legend>
              {state.amenities.map((row, index) => (
                <div
                  data-amenity-row={row.id}
                  key={row.id}
                  className="rounded-xl border border-border p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <SelectField
                        label={
                          t.fieldFacility +
                          (state.amenities.length > 1
                            ? " " + number(index + 1)
                            : "")
                        }
                        name="amenity"
                        value={row.amenity}
                        onChange={(value) =>
                          patch({
                            amenities: state.amenities.map((r) =>
                              r.id === row.id
                                ? { ...r, amenity: value, value: "" }
                                : r,
                            ),
                          })
                        }
                        options={[
                          { value: "", label: t.chooseOption },
                          ...amenityKeys
                            .filter(
                              (key) =>
                                key === row.amenity ||
                                !state.amenities.some(
                                  (other) => other.amenity === key,
                                ),
                            )
                            .map((key) => ({ value: key, label: t[key] })),
                        ]}
                      />
                    </div>
                    {state.amenities.length > 1 && (
                      <button
                        type="button"
                        aria-label={t.removeAmenity + " " + (index + 1)}
                        onClick={() =>
                          patch({
                            amenities: state.amenities.filter(
                              (r) => r.id !== row.id,
                            ),
                          })
                        }
                        className="mt-6 grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                  <input type="hidden" name="value" value={row.value} />
                  {row.amenity && (
                    <fieldset className="mt-4">
                      <legend className="mb-2 text-xs text-muted-foreground">
                        {t.observedValue}
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {[
                          ["true", t.available],
                          ["false", t.absent],
                          ["null", t.unknown],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={row.value === value}
                            onClick={() =>
                              patch({
                                amenities: state.amenities.map((r) =>
                                  r.id === row.id ? { ...r, value } : r,
                                ),
                              })
                            }
                            className={
                              "min-h-11 flex-1 rounded-lg border px-3 py-2 text-sm " +
                              (row.value === value
                                ? "border-primary bg-primary/8 font-semibold text-primary"
                                : "border-input hover:bg-muted")
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </div>
              ))}
              {state.amenities.length < 10 && (
                <button
                  type="button"
                  className={secondary}
                  onClick={() =>
                    patch({
                      amenities: [
                        ...state.amenities,
                        {
                          id: Math.max(...state.amenities.map((r) => r.id)) + 1,
                          amenity: "",
                          value: "",
                        },
                      ],
                    })
                  }
                >
                  <Plus className="size-4" aria-hidden />
                  {t.addAmenity}
                </button>
              )}
            </fieldset>
          )}
          {state.kind === "status" && (
            <div className="space-y-4">
              {station && station.lines.length > 1 && (
                <SelectField
                  label={t.affectedLine}
                  name="statusLineId"
                  value={state.statusLineId}
                  onChange={(value) => patch({ statusLineId: value })}
                  options={[
                    { value: "", label: t.wholeStation },
                    ...station.lines.map((line) => ({
                      value: line.id,
                      label: line.names[lang],
                    })),
                  ]}
                />
              )}
              <SelectField
                label={t.status}
                name="status"
                value={state.status}
                onChange={(value) => patch({ status: value })}
                options={[
                  { value: "", label: t.chooseOption },
                  ...statuses.map((key) => ({
                    value: key,
                    label: t[key as StringKey],
                  })),
                ]}
              />
            </div>
          )}
          {state.kind === "wagon" && (
            <WagonPicker
              lang={lang}
              cityId={state.cityId}
              stationId={state.stationId}
              lineIds={wagonLines}
              profileId={profile?.id ?? ""}
              onProfile={(value) =>
                patch({
                  trainProfileId: value,
                  directionId: "",
                  exitId: "up-escalator",
                  car: null,
                })
              }
              directions={directions}
              direction={direction}
              onDirection={(value) =>
                patch({
                  directionId: value,
                  exitId:
                    stationExits(state.stationId, value)[0]?.id ??
                    "up-escalator",
                  car: null,
                })
              }
              exits={exits}
              exitId={exit?.id ?? ""}
              onExit={(value) => patch({ exitId: value, car: null })}
              selected={state.car}
              onSelect={(car) => patch({ car })}
            />
          )}
          <label className={labelClass}>
            {t.descriptionOptional}
            <textarea
              name="details"
              rows={3}
              value={state.details}
              onChange={(e) => patch({ details: e.target.value })}
              placeholder={
                t[
                  ((state.kind === "city_request"
                    ? "cityRequest"
                    : state.kind) + "Placeholder") as StringKey
                ]
              }
              maxLength={3600}
              className={input}
            />
          </label>
          <div
            className="space-y-3 border-t border-border pt-4"
            data-testid="report-evidence"
          >
            <input
              ref={fileInput}
              id="report-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label={t.photo}
              aria-describedby={state.photo ? undefined : "photo-hint"}
              onChange={(e) => void photoChange(e.target.files?.[0])}
              className="sr-only"
            />
            {state.photo ? (
              <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                <img
                  src={"data:image/jpeg;base64," + state.photo}
                  alt={t.attachedPhoto}
                  className="size-14 rounded-lg object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-sm" dir="auto">
                  {state.photoName || t.attachedPhoto}
                </span>
                <button
                  type="button"
                  className="grid size-11 place-items-center rounded-lg hover:bg-card"
                  aria-label={t.removePhotoSimple}
                  onClick={removePhoto}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={photoPending}
                  className={secondary}
                  onClick={() => fileInput.current?.click()}
                >
                  <Camera className="size-4" aria-hidden />
                  {photoPending ? t.preparing : t.addPhoto}
                </button>
                <span id="photo-hint" className="text-xs text-muted-foreground">
                  {t.photoOptionalNote}
                </span>
              </div>
            )}
            {!sourceOpen && !state.source ? (
              <button
                type="button"
                onClick={() => setSourceOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <Link2 className="size-4" aria-hidden />
                {t.addSource}
              </button>
            ) : (
              <label className={labelClass}>
                {t.source}
                <input
                  name="source"
                  inputMode="url"
                  dir="auto"
                  value={state.source}
                  onChange={(e) => patch({ source: e.target.value })}
                  maxLength={500}
                  placeholder="https://"
                  className={input}
                />
              </label>
            )}
          </div>
          <div className="sr-only" aria-hidden>
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <p
            ref={state.step === 2 ? message : undefined}
            role={error && state.step === 2 ? "alert" : "status"}
            tabIndex={-1}
            aria-live="polite"
            className="text-sm leading-7 text-destructive"
          >
            {state.step === 2 && error
              ? t[error]
              : pending && state.step === 2
                ? t.preparing
                : ""}
          </p>
          <button
            type="submit"
            disabled={pending || photoPending}
            className={primary}
          >
            {photoPending ? t.preparing : t.reviewReport}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </button>
        </form>
      )}
      {!receipt && state.step === 3 && (
        <div
          className="mt-5 space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-7"
          data-testid="report-review"
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{t.kind}</dt>
              <dd className="mt-1 font-semibold">{kindLabel(state.kind)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t.city}</dt>
              <dd className="mt-1 font-semibold">
                {city?.names[lang] ?? t.otherCity}
              </dd>
            </div>
            {station && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">{t.station}</dt>
                <dd className="mt-1 font-semibold">{station.names[lang]}</dd>
              </div>
            )}
            {state.subject && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">{t.subject}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-7">
                  {state.subject}
                </dd>
              </div>
            )}
            {observation && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">
                  {t.observedValue}
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-7">
                  {observation}
                </dd>
              </div>
            )}
            {state.details && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">{t.details}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-7">
                  {state.details}
                </dd>
              </div>
            )}
            {state.source && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">{t.source}</dt>
                <dd className="mt-1 break-all text-sm" dir="auto">
                  {state.source}
                </dd>
              </div>
            )}
          </dl>
          {state.photo && (
            <div className="space-y-2">
              <img
                src={"data:image/jpeg;base64," + state.photo}
                alt={t.reviewPhoto}
                className="max-h-64 w-full rounded-xl border border-border object-contain"
              />
              <button
                type="button"
                disabled={pending}
                className={secondary}
                onClick={() => {
                  removePhoto();
                  patch({ step: 2 });
                  focusHeading();
                }}
              >
                {t.removePhoto}
              </button>
            </div>
          )}
          <fieldset className="space-y-3 border-t border-border pt-5">
            <legend className="mb-2 pt-5 text-base font-semibold">
              {t.howToCredit}
            </legend>
            {contactModes.map(({ id, label, description, Icon }) => (
              <label
                key={id}
                className={
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-4 " +
                  (state.contactMode === id
                    ? "border-primary bg-primary/5"
                    : "border-border")
                }
              >
                <input
                  type="radio"
                  name="contactMode"
                  value={id}
                  checked={state.contactMode === id}
                  disabled={pending}
                  onChange={() =>
                    patch({ contactMode: id as ReportFormState["contactMode"] })
                  }
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <Icon
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span>
                  <strong className="block text-sm">{label}</strong>
                  <span className="mt-1 block text-xs leading-6 text-muted-foreground">
                    {description}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {state.contactMode === "credit" && !account?.emailVerified && (
            <div className="rounded-xl bg-muted/50 p-4">
              <a href={loginHref} onClick={beforeLogin} className={primary}>
                {t.continueToLogin}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </a>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                {loginSeparate ? t.loginNewTabDraft : t.loginKeepsDraft}
              </p>
            </div>
          )}
          {state.contactMode === "credit" && account?.emailVerified && (
            <div className={labelClass}>
              <label htmlFor="report-public-name">{t.displayName}</label>
              <input
                id="report-public-name"
                name="publicName"
                disabled={pending}
                value={state.publicName}
                onChange={(e) => patch({ publicName: e.target.value })}
                maxLength={80}
                autoComplete="nickname"
                className={input}
                aria-describedby="public-name-hint"
              />
              <span
                id="public-name-hint"
                className="text-xs font-normal leading-6 text-muted-foreground"
              >
                {t.publicNameHint}
              </span>
            </div>
          )}
          {state.contactMode !== "anonymous" && (
            <div className="space-y-3" data-testid="report-contact">
              <p className="text-xs leading-6 text-muted-foreground">
                {t.contactNote}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  {t.name}
                  <input
                    name="name"
                    autoComplete="name"
                    disabled={pending}
                    maxLength={80}
                    value={state.name}
                    onChange={(e) => patch({ name: e.target.value })}
                    className={input}
                  />
                </label>
                <label className={labelClass}>
                  {t.contact}
                  <input
                    name="contact"
                    dir="auto"
                    autoComplete="off"
                    disabled={pending}
                    maxLength={200}
                    value={state.contact}
                    onChange={(e) => patch({ contact: e.target.value })}
                    className={input}
                  />
                </label>
              </div>
            </div>
          )}
          {previewMode && (
            <p
              role="note"
              className="rounded-xl bg-muted p-3 text-xs leading-6"
            >
              {t.previewReportNote}
            </p>
          )}
          {!previewMode && (
            <p className="text-xs leading-6 text-muted-foreground">
              {t.publicNote}
            </p>
          )}
          {!enabled && (
            <p className="text-sm leading-7 text-muted-foreground">
              {t.unavailable}{" "}
              <a
                className="text-primary underline"
                href={
                  "https://github.com/aliinreallife/metto-data/issues/new?title=" +
                  encodeURIComponent("گزارش " + kindLabel(state.kind))
                }
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
            onClick={() => void send()}
            className={primary + " w-full"}
          >
            <Check className="size-4" aria-hidden />
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
