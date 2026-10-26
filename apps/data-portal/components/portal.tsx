"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Compass,
  GitBranch,
  Globe2,
  Heart,
  Map as MapIcon,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
  TrainFront,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import {
  searchStations,
  type Catalog,
  type CatalogStation,
  type Lang,
} from "../lib/catalog";
import { contributorHref } from "../lib/usernames";
import { THEME_STORAGE_KEY } from "../lib/theme";
import { STRINGS, type StringKey } from "../lib/i18n";
import { ContributionForm } from "./contribution-form";
import { SelectField } from "./select-field";
import type { PublicReport } from "../lib/reports";
import { Account, usePortalAccount } from "./account";
import type { Leader } from "../lib/leaderboard";
import { NetworkMap } from "./network-map";
import type { PublicMemberProfile } from "../lib/profile";
import { CommunityReportPanel } from "./community-report-panel";
import { PublicProfile } from "./public-profile";
type View =
  | "home"
  | "stations"
  | "map"
  | "contribute"
  | "reports"
  | "account"
  | "leaderboard"
  | "profile";
const input =
  "w-full rounded-xl border border-input bg-background px-3 py-3 text-base";
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground";
const secondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 font-semibold hover:bg-muted";
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
  initialReportId?: string;
  intakeEnabled: boolean;
  previewMode: boolean;
  authConfigured: boolean;
  githubEnabled: boolean;
  authReturnTo?: string;
  ranking: { leaders: Leader[]; unavailable: boolean; partial: boolean };
  profileId: string;
  profileUsername?: string;
  profilePhotoUrl?: string | null;
  publicProfile: PublicMemberProfile | null;
  reports: PublicReport[];
  reportsUnavailable: boolean;
};
export function Portal(props: PortalProps) {
  const { catalog, view } = props;
  const account = usePortalAccount(props.authConfigured);
  const profile = props.ranking.leaders.find(
    (person) => person.id === props.profileId,
  );
  const [lang, setLang] = useState<Lang>(props.initialLang),
    [city, setCity] = useState(props.initialCity),
    [query, setQuery] = useState(""),
    [dark, setDark] = useState(false),
    [line, setLine] = useState(""),
    [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const t = STRINGS[lang],
    number = (value: number) =>
      new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(value);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  }, [lang]);
  useEffect(() => {
    // The head script already set the theme. Mounting a page must not reset it.
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    const media = matchMedia("(prefers-color-scheme: dark)");
    const updatePreference = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(THEME_STORAGE_KEY);
      } catch {}
      root.classList.toggle(
        "dark",
        saved === "dark" || (saved !== "light" && media.matches),
      );
    };
    const storage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null)
        updatePreference();
    };
    media.addEventListener("change", updatePreference);
    window.addEventListener("storage", storage);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", updatePreference);
      window.removeEventListener("storage", storage);
    };
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);
  const toggleTheme = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {}
  };
  const chooseCity = (value: string) => {
    setCity(value);
    setLine("");
    const url = new URL(location.href);
    value
      ? url.searchParams.set("city", value)
      : url.searchParams.delete("city");
    history.replaceState(null, "", url);
  };
  const filtered = useMemo(
    () =>
      searchStations(catalog, city, query).filter(
        (station) => !line || station.lines.some((item) => item.id === line),
      ),
    [catalog, city, query, line],
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
    ["leaderboard", t.leaderboard, Trophy],
    ["account", account ? t.account : t.login, UserRound],
  ] as const;
  const citySelect = (
    <div className="min-w-44">
      <SelectField
        label={t.city}
        hideLabel
        value={city}
        onChange={chooseCity}
        options={[
          { value: "", label: t.all },
          ...catalog.cities.map((item) => ({
            value: item.id,
            label: item.names[lang],
          })),
        ]}
      />
    </div>
  );
  const reports = (
    <section className={view === "home" ? "mt-8" : ""}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          {view === "reports" ? (
            <h1 className="text-3xl font-bold">{t.reports}</h1>
          ) : (
            <h2 className="text-2xl font-bold">{t.reportsTitle}</h2>
          )}
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
                <Badge>
                  {report.verified
                    ? t.verifiedContribution
                    : report.state === "open"
                      ? t.pending
                      : t.closed}
                </Badge>
              </div>
              <h3 className="font-bold">
                <a
                  href={report.url}
                  className="underline-offset-4 hover:underline"
                >
                  {report.names?.[lang] ?? report.title}
                </a>
              </h3>
              <p className="mt-2 text-xs text-muted-foreground">
                <time dateTime={report.createdAt}>
                  {new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en", {
                    dateStyle: "medium",
                    timeZone: "Asia/Tehran",
                  }).format(new Date(report.createdAt))}
                </time>
              </p>
              {report.contributorName && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {report.contributorId ? (
                    <Link
                      href={contributorHref(
                        report.contributorId,
                        report.contributorUsername,
                        lang,
                      )}
                      className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {report.contributorName}
                      {report.contributorUsername && (
                        <span
                          dir="ltr"
                          className="ms-2 text-xs font-normal text-muted-foreground"
                        >
                          @{report.contributorUsername}
                        </span>
                      )}
                    </Link>
                  ) : (
                    report.contributorName
                  )}
                </p>
              )}
              {report.kind === "historical" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t.historicalContribution}
                </p>
              )}
              {report.reportId && (
                <Link
                  href={href("reports", { report: report.reportId })}
                  className={`${secondary} mt-4 text-sm`}
                >
                  {t.reviewReport}
                </Link>
              )}
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
          <Link href={href("home")} className="flex items-center gap-3 py-2">
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
            className="hidden items-center gap-1 lg:flex"
          >
            {navItems.map(([id, label, Icon]) => (
              <Link
                key={id}
                href={href(id)}
                target={
                  id === "account" && view === "contribute"
                    ? "_blank"
                    : undefined
                }
                rel={
                  id === "account" && view === "contribute"
                    ? "noopener noreferrer"
                    : undefined
                }
                aria-current={view === id ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted ${view === id ? "bg-muted font-semibold text-primary" : "text-muted-foreground"}`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
                {id === "account" && view === "contribute" && (
                  <span className="sr-only"> — {t.opensNewTab}</span>
                )}
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
              onClick={toggleTheme}
              aria-label={t.theme}
              aria-pressed={dark}
              className="grid size-11 place-items-center rounded-lg hover:bg-muted"
            >
              {dark ? (
                <Sun className="size-4" aria-hidden />
              ) : (
                <Moon className="size-4" aria-hidden />
              )}
            </button>
            <button
              type="button"
              ref={menuButton}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={t.menu}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className="grid size-11 place-items-center rounded-lg lg:hidden"
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
            className="flex flex-col gap-1 border-t border-border px-4 py-3 lg:hidden"
          >
            {navItems.map(([id, label]) => (
              <Link
                key={id}
                href={href(id)}
                target={
                  id === "account" && view === "contribute"
                    ? "_blank"
                    : undefined
                }
                rel={
                  id === "account" && view === "contribute"
                    ? "noopener noreferrer"
                    : undefined
                }
                onClick={() => setMenuOpen(false)}
                aria-current={view === id ? "page" : undefined}
                className="rounded-lg p-3 hover:bg-muted"
              >
                {label}
                {id === "account" && view === "contribute" && (
                  <span className="sr-only"> — {t.opensNewTab}</span>
                )}
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
            <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-8">
              <div className="flex flex-col gap-6">
                <Badge>
                  <Globe2 className="me-1 size-3.5" aria-hidden />
                  {t.brand}
                </Badge>
                <h1 className="text-balance text-3xl font-bold leading-snug sm:text-5xl">
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
              <div className="rounded-2xl border border-border bg-card p-6">
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
                  type="search"
                  aria-label={t.search}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.search}
                  className={`${input} ps-10`}
                />
              </label>
              {citySelect}
              <div className="min-w-44">
                <SelectField
                  label={t.lineFilter}
                  hideLabel
                  value={line}
                  onChange={setLine}
                  options={[
                    { value: "", label: t.allLines },
                    ...catalog.cities
                      .filter((item) => !city || item.id === city)
                      .flatMap((item) =>
                        item.lines.map((route) => ({
                          value: route.id,
                          label:
                            (city ? "" : item.names[lang] + " · ") +
                            route.names[lang],
                        })),
                      ),
                  ]}
                />
              </div>
            </div>
            {(query || line) && (
              <button
                type="button"
                className="mb-4 min-h-11 text-sm font-semibold text-primary underline underline-offset-4"
                onClick={() => {
                  setQuery("");
                  setLine("");
                }}
              >
                {t.clearFilters}
              </button>
            )}
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
            {props.initialReportId ? (
              <section className="mx-auto max-w-3xl">
                <Link
                  href={href("reports")}
                  className="mb-5 inline-flex min-h-11 items-center text-sm font-semibold text-primary"
                >
                  {t.allReports}
                </Link>
                <h1 className="mb-5 text-3xl font-bold">{t.reviewReport}</h1>
                <CommunityReportPanel
                  id={props.initialReportId}
                  lang={lang}
                  account={account}
                  catalog={catalog}
                />
              </section>
            ) : (
              reports
            )}
          </>
        )}
        {view === "account" && (
          <Account
            lang={lang}
            configured={props.authConfigured}
            githubEnabled={props.githubEnabled}
            returnTo={props.authReturnTo}
            user={account}
          />
        )}
        {view === "leaderboard" && (
          <section className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-bold">{t.leaderboard}</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {t.leaderboardIntro}
            </p>
            {props.ranking.unavailable &&
            !props.ranking.leaders.some((person) => person.accepted > 0) ? (
              <p
                role="status"
                className="mt-7 rounded-xl border border-border bg-card p-5"
              >
                {t.leaderboardUnavailable}
              </p>
            ) : props.ranking.leaders.some((person) => person.accepted > 0) ? (
              <ol className="mt-7 flex flex-col gap-3">
                {props.ranking.leaders
                  .filter((person) => person.accepted > 0)
                  .map((person, index) => (
                    <li
                      key={person.id}
                      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-primary">
                        {number(index + 1)}
                      </span>
                      <a
                        href={contributorHref(person.id, person.username, lang)}
                        className="min-w-0 flex-1 break-words font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        <span className="block">{person.name}</span>
                        {person.username && (
                          <span
                            dir="ltr"
                            className="mt-1 block w-fit text-xs font-normal text-muted-foreground"
                          >
                            @{person.username}
                          </span>
                        )}
                      </a>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {number(person.accepted)} {t.acceptedContributions}
                      </span>
                    </li>
                  ))}
              </ol>
            ) : (
              <p
                role="status"
                className="mt-7 rounded-2xl border border-border bg-card p-6 text-sm leading-7"
              >
                {t.leaderboardEmpty}
              </p>
            )}
            {props.ranking.unavailable &&
              props.ranking.leaders.some((person) => person.accepted > 0) && (
                <p role="status" className="mt-4 text-sm text-muted-foreground">
                  {t.contributionsUnavailable}
                </p>
              )}
            {props.ranking.partial && (
              <p role="status" className="mt-4 text-sm">
                {t.leaderboardPartial}
              </p>
            )}
            <a href={href("contribute")} className={`${primary} mt-6`}>
              {t.contribute}
            </a>
          </section>
        )}
        {view === "profile" && (
          <PublicProfile
            id={props.profileId}
            username={props.profileUsername}
            photoUrl={props.profilePhotoUrl}
            profile={props.publicProfile}
            person={profile}
            unavailable={props.ranking.unavailable}
            partial={props.ranking.partial}
            lang={lang}
          />
        )}
        {view === "contribute" && (
          <ContributionForm
            catalog={catalog}
            lang={lang}
            initialCity={props.initialCity}
            initialStation={props.initialStation}
            initialKind={props.initialKind}
            enabled={props.intakeEnabled}
            previewMode={props.previewMode}
            account={account}
            authConfigured={props.authConfigured}
          />
        )}
      </main>
      <footer className="mx-auto flex max-w-7xl flex-wrap gap-6 border-t border-border px-4 pt-7 pb-28 text-sm text-muted-foreground sm:px-6 lg:pb-7">
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
      <nav
        aria-label={t.quickNav}
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-sm lg:hidden"
      >
        {(
          [
            ["stations", t.stations, TrainFront],
            ["map", t.map, MapIcon],
            ["contribute", t.contribute, Plus],
            ["account", account ? t.account : t.login, UserRound],
          ] as const
        ).map(([id, label, Icon]) => (
          <Link
            key={id}
            href={href(id)}
            target={
              id === "account" && view === "contribute" ? "_blank" : undefined
            }
            rel={
              id === "account" && view === "contribute"
                ? "noopener noreferrer"
                : undefined
            }
            aria-current={view === id ? "page" : undefined}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs ${view === id ? "font-bold text-primary" : "text-muted-foreground"}`}
          >
            <Icon className="size-5" aria-hidden />
            {label}
            {id === "account" && view === "contribute" && (
              <span className="sr-only"> — {t.opensNewTab}</span>
            )}
          </Link>
        ))}
      </nav>
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
            data-line-id={line.id}
            data-line-boardable={station.operationalLineIds.includes(line.id)}
            className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs"
          >
            <span
              style={{ background: line.color }}
              className="size-2.5 rounded-full"
              aria-hidden
            />
            {line.names[lang]}
            {!station.operationalLineIds.includes(line.id) && (
              <span className="text-muted-foreground">
                {" "}
                · {t.under_construction}
              </span>
            )}
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
      {amenities.length > 0 && !station.amenitiesVerified && (
        <p className="mb-4 text-xs leading-6 text-muted-foreground">
          {t.unverified}
        </p>
      )}
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
