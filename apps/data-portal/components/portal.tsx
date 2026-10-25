"use client";
import { useEffect, useMemo, useState } from "react";
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
import { STRINGS, type StringKey } from "../lib/i18n";
import { ContributionForm } from "./contribution-form";
import { SelectField } from "./select-field";
import type { PublicReport } from "../lib/reports";
import { Account, usePortalAccount } from "./account";
import type { Leader } from "../lib/leaderboard";
import { NetworkMap } from "./network-map";
import type { PublicMemberProfile } from "../lib/profile";
import { socialKinds } from "../lib/social-links";
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
  previewMode: boolean;
  authConfigured: boolean;
  githubEnabled: boolean;
  authReturnTo?: string;
  ranking: { leaders: Leader[]; unavailable: boolean; partial: boolean };
  profileId: string;
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
    ["leaderboard", t.leaderboard, Trophy],
    ["account", account ? t.account : t.login, UserRound],
  ] as const;
  const citySelect = (
    <div className="min-w-44">
      <SelectField
        label={t.city}
        hideLabel
        value={city}
        onChange={setCity}
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
              {report.contributorName && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {report.contributorName}
                </p>
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
            {props.ranking.unavailable ? (
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
                        href={`/contributors/${person.id}?lang=${lang}`}
                        className="min-w-0 flex-1 break-words font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        {person.name}
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
          <section className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-bold">
              {props.publicProfile?.publicName ?? profile?.name ?? t.profile}
            </h1>
            {props.publicProfile?.bio && (
              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">
                {props.publicProfile.bio}
              </p>
            )}
            {props.publicProfile && (
              <ul className="mt-5 flex flex-wrap gap-3">
                {socialKinds.map((kind) => {
                  const url = props.publicProfile?.socialLinks[kind];
                  const label = {
                    instagram: t.socialInstagram,
                    telegram: t.socialTelegram,
                    x: t.socialX,
                    github: t.socialGithub,
                    spotify: t.socialSpotify,
                    website: t.socialWebsite,
                  }[kind];
                  return url ? (
                    <li key={kind}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        aria-label={`${label} — ${t.opensNewTab}`}
                        className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-primary"
                      >
                        {label}
                      </a>
                    </li>
                  ) : null;
                })}
              </ul>
            )}
            <p className="mt-3 text-sm text-muted-foreground">{t.profile}</p>
            {props.ranking.unavailable ? (
              <p role="status" className="mt-6">
                {t.leaderboardUnavailable}
              </p>
            ) : !profile ? (
              <p role="status" className="mt-6">
                {t.profileEmpty}
              </p>
            ) : (
              <>
                <p className="mt-5 text-sm font-semibold">
                  {number(profile.accepted)} {t.acceptedContributions}
                </p>
                <ul className="mt-6 grid gap-3">
                  {profile.reports.map((report) => (
                    <li
                      key={report.id}
                      className="rounded-2xl border border-border bg-card p-5"
                    >
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs ${report.accepted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        {report.accepted ? t.accepted : t.submitted}
                      </span>
                      <a
                        className="mt-3 block font-semibold underline-offset-4 hover:underline"
                        href={report.url}
                      >
                        {report.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <a
              className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4"
              href={href("leaderboard")}
            >
              {t.leaderboard}
            </a>
          </section>
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
