"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Compass,
  GitBranch,
  Globe2,
  Heart,
  Map as MapIcon,
  Menu,
  Moon,
  Plus,
  Search,
  TrainFront,
  X,
} from "lucide-react";
import {
  searchStations,
  type Catalog,
  type CatalogStation,
  type Lang,
} from "../lib/catalog";
import { STRINGS, type StringKey } from "../lib/i18n";
import { preparePhoto } from "../lib/photo";
import type { PublicReport } from "../lib/reports";
import { NetworkMap } from "./network-map";
type View = "home" | "stations" | "map" | "contribute" | "reports";
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
const input =
  "w-full rounded-xl border border-input bg-background px-3 py-3 text-base focus-visible:ring-2 focus-visible:ring-ring";
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring";
const secondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring";
function Badge({
  children,
  candidate = false,
}: {
  children: React.ReactNode;
  candidate?: boolean;
}) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${candidate ? "bg-amber-100 text-amber-950" : "bg-primary/10 text-primary"}`}
    >
      {children}
    </span>
  );
}
export type PortalProps = {
  catalog: Catalog;
  view: View;
  initialLang: Lang;
  initialCity: string;
  initialStation: string;
  initialKind: string;
  intakeEnabled: boolean;
  reports: PublicReport[];
  reportsUnavailable: boolean;
};
export function Portal(props: PortalProps) {
  const { catalog, view } = props;
  const [lang, setLang] = useState<Lang>(props.initialLang),
    [city, setCity] = useState(props.initialCity),
    [query, setQuery] = useState(""),
    [dark, setDark] = useState(false),
    [menuOpen, setMenuOpen] = useState(false);
  const t = STRINGS[lang],
    number = (value: number) =>
      new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(value);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  }, [lang]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const filtered = useMemo(
    () => searchStations(catalog, city, query),
    [catalog, city, query],
  );
  const href = (next: View, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({
      lang,
      ...(city ? { city } : {}),
      ...extra,
    });
    return `${next === "home" ? "/" : `/${next}`}?${params}`;
  };
  const switchLanguage = () => {
    const next = lang === "fa" ? "en" : "fa";
    setLang(next);
    const url = new URL(location.href);
    url.searchParams.set("lang", next);
    history.replaceState(null, "", url);
  };
  const navItems = [
    ["home", t.home, Compass],
    ["stations", t.stations, TrainFront],
    ["map", t.map, MapIcon],
    ["reports", t.reports, GitBranch],
  ] as const;
  const citySelect = (
    <label className="flex min-w-44 flex-col gap-2 text-sm">
      <span className="sr-only">{t.city}</span>
      <select
        aria-label={t.city}
        value={city}
        onChange={(event) => setCity(event.target.value)}
        className={input}
      >
        <option value="">{t.all}</option>
        {catalog.cities.map((item) => (
          <option key={item.id} value={item.id}>
            {item.names[lang]}
          </option>
        ))}
      </select>
    </label>
  );
  const reports = (
    <section className="mt-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t.reportsTitle}</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {t.reportsIntro}
          </p>
        </div>
        <a
          className="py-2 text-sm font-semibold text-primary underline underline-offset-4"
          href="https://github.com/aliinreallife/metto-data/issues"
        >
          {t.github}
        </a>
      </div>
      {props.reports.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {props.reports.map((report) => (
            <article
              key={report.id}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="mb-4">
                <Badge>{report.state === "open" ? t.pending : t.closed}</Badge>
              </div>
              <h3 className="font-bold">
                <a
                  href={report.url}
                  className="underline-offset-4 hover:underline"
                >
                  {report.title}
                </a>
              </h3>
            </article>
          ))}
        </div>
      ) : (
        <p
          role="status"
          className="rounded-2xl border border-border bg-card p-6 text-sm leading-7 text-muted-foreground"
        >
          {props.reportsUnavailable ? t.reportsUnavailable : t.noReports}
        </p>
      )}
    </section>
  );
  return (
    <div
      lang={lang}
      dir={lang === "fa" ? "rtl" : "ltr"}
      className="min-h-screen bg-background text-foreground"
    >
      <a
        href="#main"
        className="fixed start-3 -top-20 z-50 rounded-lg bg-card px-4 py-3 focus:top-3"
      >
        {t.skip}
      </a>
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href={href("home")}
            className="flex items-center gap-3 py-2"
            aria-label="Metto Data"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <TrainFront className="size-5" aria-hidden />
            </span>
            <span>
              <strong className="block">Metto Data</strong>
              <span className="block text-xs text-muted-foreground">
                {t.brand}
              </span>
            </span>
          </Link>
          <nav
            aria-label={t.menu}
            className="hidden items-center gap-1 md:flex"
          >
            {navItems.map(([id, label, Icon]) => (
              <Link
                key={id}
                href={href(id)}
                aria-current={view === id ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted ${view === id ? "bg-muted font-semibold text-primary" : "text-muted-foreground"}`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center">
            <button
              type="button"
              onClick={switchLanguage}
              lang={lang === "fa" ? "en" : "fa"}
              className="min-h-11 rounded-lg px-3 text-sm hover:bg-muted"
            >
              {lang === "fa" ? "EN" : "فارسی"}
            </button>
            <button
              type="button"
              onClick={() => setDark(!dark)}
              aria-label={t.theme}
              aria-pressed={dark}
              className="grid size-11 place-items-center rounded-lg hover:bg-muted"
            >
              <Moon className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={t.menu}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className="grid size-11 place-items-center rounded-lg md:hidden"
            >
              {menuOpen ? (
                <X className="size-5" aria-hidden />
              ) : (
                <Menu className="size-5" aria-hidden />
              )}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            id="mobile-menu"
            aria-label={t.menu}
            className="flex flex-col gap-1 border-t border-border px-4 py-3 md:hidden"
          >
            {navItems.map(([id, label]) => (
              <Link
                key={id}
                href={href(id)}
                onClick={() => setMenuOpen(false)}
                aria-current={view === id ? "page" : undefined}
                className="rounded-lg p-3 hover:bg-muted"
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6"
      >
        {view === "home" && (
          <>
            <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-14">
              <div className="flex flex-col gap-6">
                <Badge>
                  <Globe2 className="me-1 size-3.5" aria-hidden />
                  {t.brand}
                </Badge>
                <h1 className="text-balance text-4xl font-bold leading-tight sm:text-6xl">
                  {t.hero}
                  <br />
                  <span className="text-primary">{t.heroAccent}</span>
                </h1>
                <p className="max-w-xl text-lg leading-8 text-muted-foreground">
                  {t.intro}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href={href("stations")} className={primary}>
                    {t.browse}
                    <ArrowLeft
                      className={`size-4 ${lang === "en" ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </Link>
                  <Link href={href("contribute")} className={secondary}>
                    {t.contribute}
                    <Plus className="size-4" aria-hidden />
                  </Link>
                </div>
                <div className="flex gap-8 border-t border-border pt-5 text-sm">
                  {[
                    [catalog.cities.length, t.cityCount],
                    [catalog.stationCount, t.stationCount],
                    [catalog.lineCount, t.lineCount],
                  ].map(([value, label]) => (
                    <div key={String(label)}>
                      <strong className="block text-2xl">
                        {number(Number(value))}
                      </strong>
                      <span className="text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{t.countsHint}</p>
              </div>
              <div className="rounded-[2rem] border border-border bg-card p-6">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-bold">{t.chooseCity}</h2>
                    <p className="mt-1 text-sm leading-7 text-muted-foreground">
                      {t.cityHint}
                    </p>
                  </div>
                  <MapIcon
                    className="size-6 shrink-0 text-primary"
                    aria-hidden
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {catalog.cities.map((item) => (
                    <Link
                      key={item.id}
                      href={href("stations", { city: item.id })}
                      className="rounded-xl border border-border p-4 hover:border-primary hover:bg-primary/5"
                    >
                      <strong>{item.names[lang]}</strong>
                      <span className="my-2 block text-xs text-muted-foreground">
                        {number(item.stations.length)} {t.stations}
                      </span>
                      {item.candidate && <Badge candidate>{t.candidate}</Badge>}
                    </Link>
                  ))}
                </div>
                <Link
                  href={href("contribute", { city: "other", kind: "other" })}
                  className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4"
                >
                  {t.suggestCity}
                </Link>
              </div>
            </section>
            <section className="mt-8 grid gap-4 lg:grid-cols-3">
              {[
                [Heart, t.open, t.openNote],
                [GitBranch, t.review, t.reviewNote],
                [Check, t.privacy, t.privacyNote],
              ].map(([Icon, title, note]) => {
                const CardIcon = Icon as typeof Heart;
                return (
                  <article
                    key={String(title)}
                    className="rounded-2xl border border-border bg-card p-5"
                  >
                    <CardIcon
                      className="mb-4 size-5 text-primary"
                      aria-hidden
                    />
                    <h2 className="font-bold">{title as string}</h2>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {note as string}
                    </p>
                  </article>
                );
              })}
            </section>
            {reports}
          </>
        )}
        {view === "stations" && (
          <section>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <h1 className="text-3xl font-bold sm:text-4xl">{t.directory}</h1>
              <Link href={href("contribute")} className={primary}>
                <Plus className="size-4" aria-hidden />
                {t.contribute}
              </Link>
            </div>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">{t.search}</span>
                <Search
                  className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  aria-label={t.search}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.search}
                  className={`${input} ps-10`}
                />
              </label>
              {citySelect}
            </div>
            <p role="status" className="mb-5 text-sm text-muted-foreground">
              {number(filtered.length)} {t.stations}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((station) => (
                <StationCard
                  key={station.id}
                  station={station}
                  cityName={
                    catalog.cities.find((item) => item.id === station.cityId)!
                      .names[lang]
                  }
                  lang={lang}
                />
              ))}
            </div>
            {!filtered.length && (
              <p className="py-10 text-center text-muted-foreground">
                {t.empty}
              </p>
            )}
          </section>
        )}
        {view === "map" && (
          <section>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <h1 className="text-3xl font-bold">{t.map}</h1>
              {citySelect}
            </div>
            <div className="grid gap-5">
              {catalog.cities
                .filter((item) => !city || city === item.id)
                .map((item) => (
                  <NetworkMap key={item.id} city={item} lang={lang} />
                ))}
            </div>
          </section>
        )}
        {view === "reports" && (
          <>
            <h1 className="text-3xl font-bold">{t.reports}</h1>
            {reports}
          </>
        )}
        {view === "contribute" && (
          <ContributionForm
            catalog={catalog}
            lang={lang}
            initialCity={props.initialCity}
            initialStation={props.initialStation}
            initialKind={props.initialKind}
            enabled={props.intakeEnabled}
          />
        )}
      </main>
      <footer className="mx-auto flex max-w-7xl flex-wrap gap-6 border-t border-border px-4 py-7 text-sm text-muted-foreground sm:px-6">
        <a
          href="https://metto.ir"
          className="inline-flex min-h-11 items-center hover:text-primary"
        >
          {t.back}
        </a>
        <a
          href="https://github.com/aliinreallife/metto-data"
          className="inline-flex min-h-11 items-center hover:text-primary"
        >
          {t.github}
        </a>
        <a
          href="https://github.com/aliinreallife/metto-data/blob/main/ATTRIBUTION.md"
          className="inline-flex min-h-11 items-center hover:text-primary"
        >
          {t.sources}
        </a>
      </footer>
    </div>
  );
}
function StationCard({
  station,
  cityName,
  lang,
}: {
  station: CatalogStation;
  cityName: string;
  lang: Lang;
}) {
  const t = STRINGS[lang],
    amenities = Object.entries(station.amenities).filter(
      ([, value]) => value === true,
    );
  return (
    <article
      data-testid="station-card"
      data-station-id={station.id}
      className="flex flex-col rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{station.names[lang]}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{cityName}</p>
        </div>
        <Badge candidate={station.candidate}>
          {station.candidate
            ? t.candidate
            : t[(station.status ?? "operational") as StringKey]}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {station.lines.map((line) => (
          <span
            key={line.id}
            className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs"
          >
            <span
              style={{ background: line.color }}
              className="size-2.5 rounded-full"
              aria-hidden
            />
            {line.names[lang]}
          </span>
        ))}
      </div>
      <div className="my-5 flex flex-wrap gap-2">
        {amenities.length ? (
          amenities.map(([key]) => (
            <span
              className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
              key={key}
            >
              {t[key as StringKey] ?? key}
            </span>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">{t.noAmenities}</span>
        )}
      </div>
      <p className="mb-4 text-xs leading-6 text-muted-foreground">
        {t.unverified}
      </p>
      <Link
        prefetch={false}
        href={`/contribute?city=${station.cityId}&station=${encodeURIComponent(station.id)}&lang=${lang}`}
        className={`${secondary} mt-auto text-sm`}
      >
        {t.changeStation}
      </Link>
    </article>
  );
}
function ContributionForm({
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
  const form = useRef<HTMLFormElement>(null),
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
  const changeCity = (value: string) => {
    setCityId(value);
    setStationId("");
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !enabled) return;
    const fields = new FormData(event.currentTarget),
      details = String(fields.get("details") ?? "").trim(),
      file = (fields.get("photo") as File | null) ?? undefined;
    if (!details && !file?.size) {
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
      let observation = "";
      if (kind === "facility")
        observation = `Amenity: ${fields.get("amenity")}; observed value: ${fields.get("value")}`;
      if (kind === "status")
        observation = `Observed status: ${fields.get("status")}`;
      if (kind === "wagon" && car)
        observation = `Observed car ${car} of ${carCount}; direction: ${String(fields.get("direction") ?? "").trim()}`;
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
      <h1 className="text-3xl font-bold">{t.formTitle}</h1>
      <p className="mb-7 mt-3 leading-8 text-muted-foreground">{t.formIntro}</p>
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
          className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:p-7"
          data-testid="report-form"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold">
              {t.city}
              <select
                name="cityId"
                value={cityId}
                onChange={(event) => changeCity(event.target.value)}
                className={input}
              >
                {catalog.cities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.names[lang]}
                  </option>
                ))}
                <option value="other">{t.otherCity}</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold">
              {t.kind}
              <select
                name="kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as Kind)}
                className={input}
              >
                {kinds.map((item) => (
                  <option key={item} value={item}>
                    {t[item]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {city?.candidate && (
            <p className="text-xs leading-7 text-muted-foreground">
              {t.candidateNote}
            </p>
          )}
          <label className="flex flex-col gap-2 text-sm font-semibold">
            {t.selectStation}
            <select
              name="stationId"
              value={stationId}
              onChange={(event) => setStationId(event.target.value)}
              className={input}
            >
              <option value="">{t.noStation}</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.names[lang]} · {city?.names[lang]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            {t.subject}
            <input name="subject" maxLength={160} className={input} />
          </label>
          {kind === "facility" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-semibold">
                {t.fieldFacility}
                <select name="amenity" className={input}>
                  {[
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
                  ].map((key) => (
                    <option key={key} value={key}>
                      {t[key as StringKey]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold">
                {t.observedValue}
                <select name="value" className={input}>
                  <option value="true">{t.available}</option>
                  <option value="false">{t.absent}</option>
                  <option value="null">{t.unknown}</option>
                </select>
              </label>
            </div>
          )}
          {kind === "status" && (
            <label className="flex flex-col gap-2 text-sm font-semibold">
              {t.status}
              <select name="status" className={input}>
                {[
                  "operational",
                  "under_construction",
                  "planned",
                  "temporarily_closed",
                ].map((key) => (
                  <option key={key} value={key}>
                    {t[key as StringKey]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === "wagon" && (
            <fieldset className="rounded-xl border border-border p-4">
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
              rows={5}
              maxLength={3600}
              aria-describedby="details-hint"
              className={input}
            />
            <small
              id="details-hint"
              className="text-xs font-normal leading-7 text-muted-foreground"
            >
              {t.detailsHint}
            </small>
          </label>
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
