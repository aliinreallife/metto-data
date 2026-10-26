"use client";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Share2,
} from "lucide-react";
import { ProfileAvatar } from "./profile-avatar";
import { STRINGS } from "../lib/i18n";
import { socialKinds } from "../lib/social-links";
import type { PublicMemberProfile } from "../lib/profile";
import type { Leader } from "../lib/leaderboard";
import type { Lang } from "../lib/catalog";
export function PublicProfile({
  id,
  username,
  photoUrl,
  profile,
  person,
  unavailable,
  partial,
  lang,
}: {
  id: string;
  username?: string;
  photoUrl?: string | null;
  profile: PublicMemberProfile | null;
  person?: Leader;
  unavailable: boolean;
  partial: boolean;
  lang: Lang;
}) {
  const t = STRINGS[lang],
    number = (value: number) =>
      new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(value);
  const [acceptedOnly, setAcceptedOnly] = useState(false),
    [shareMessage, setShareMessage] = useState("");
  const name =
    profile?.publicName ||
    person?.name ||
    (username ? "@" + username : t.profile);
  const labels = {
    instagram: t.socialInstagram,
    telegram: t.socialTelegram,
    x: t.socialX,
    github: t.socialGithub,
    spotify: t.socialSpotify,
    website: t.socialWebsite,
  };
  const reports = [...(person?.reports ?? [])]
    .filter((report) => !acceptedOnly || report.accepted)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const Back = lang === "fa" ? ArrowRight : ArrowLeft;
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage(t.profileLinkCopied);
    } catch {
      setShareMessage(t.profileCopyFailed);
    }
  }
  return (
    <section className="mx-auto max-w-3xl">
      <a
        href={`/leaderboard?lang=${lang}`}
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <Back className="size-4" aria-hidden />
        {t.leaderboard}
      </a>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="p-5 sm:p-7">
          <div className="flex items-start gap-4 sm:gap-5">
            <ProfileAvatar
              id={id}
              src={photoUrl}
              size={88}
              className="border border-border"
            />
            <div className="min-w-0 flex-1 self-center">
              <h1 className="break-words text-2xl font-bold sm:text-3xl">
                {name}
              </h1>
              {username && name !== "@" + username && (
                <p
                  dir="ltr"
                  className="mt-1 w-fit break-all text-sm text-muted-foreground"
                >
                  @{username}
                </p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                {t.profileContributor}
              </p>
            </div>
          </div>
          {profile?.bio && (
            <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7">
              {profile.bio}
            </p>
          )}
          {profile && socialKinds.some((kind) => profile.socialLinks[kind]) && (
            <ul
              aria-label={t.profileSocialLinks}
              className="mt-4 flex flex-wrap gap-2"
            >
              {socialKinds.map((kind) =>
                profile.socialLinks[kind] ? (
                  <li key={kind}>
                    <a
                      href={profile.socialLinks[kind]}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      aria-label={`${labels[kind]} — ${t.opensNewTab}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm hover:bg-muted"
                    >
                      {labels[kind]}
                      <ExternalLink
                        className="size-3.5 text-muted-foreground"
                        aria-hidden
                      />
                    </a>
                  </li>
                ) : null,
              )}
            </ul>
          )}
          <button
            type="button"
            onClick={() => void share()}
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
          >
            <Share2 className="size-4" aria-hidden />
            {t.profileShare}
          </button>
          <p role="status" className="text-xs leading-6 text-muted-foreground">
            {shareMessage}
          </p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border border-t border-border bg-muted/35 rtl:divide-x-reverse">
          <p className="p-4 text-center text-sm leading-7">
            <strong className="block text-2xl font-bold">
              {unavailable && !person ? "—" : number(person?.accepted ?? 0)}
            </strong>{" "}
            {t.acceptedContributions}
          </p>
          <p className="p-4 text-center text-sm leading-7">
            <strong className="block text-2xl font-bold">
              {unavailable && !person
                ? "—"
                : number(person?.reports.length ?? 0)}
            </strong>{" "}
            {t.profileAllContributions}
          </p>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t.profileActivity}</h2>
        {!!person?.reports.length && (
          <div
            role="group"
            aria-label={t.profileActivityFilter}
            className="flex rounded-xl bg-muted p-1"
          >
            {[false, true].map((only) => (
              <button
                key={String(only)}
                type="button"
                aria-pressed={acceptedOnly === only}
                onClick={() => setAcceptedOnly(only)}
                className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${acceptedOnly === only ? "bg-card shadow-sm" : "text-muted-foreground"}`}
              >
                {only ? t.accepted : t.profileAll}
              </button>
            ))}
          </div>
        )}
      </div>
      {unavailable && (
        <p
          role="status"
          className="mt-4 text-sm leading-7 text-muted-foreground"
        >
          {t.contributionsUnavailable}
        </p>
      )}
      {partial && (
        <p
          role="status"
          className="mt-4 text-sm leading-7 text-muted-foreground"
        >
          {t.leaderboardPartial}
        </p>
      )}
      {!reports.length ? (
        <p
          role="status"
          className="mt-4 rounded-2xl border border-border bg-card p-5 text-sm leading-7 text-muted-foreground"
        >
          {unavailable
            ? t.leaderboardUnavailable
            : acceptedOnly
              ? t.profileNoAccepted
              : t.profileEmpty}
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {reports.map((report) => {
            const date = new Date(report.createdAt),
              validDate = !Number.isNaN(date.getTime());
            return (
              <li
                key={report.id}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${report.accepted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    {report.accepted && (
                      <Check className="size-3.5" aria-hidden />
                    )}
                    {report.accepted ? t.accepted : t.submitted}
                  </span>
                  {validDate && (
                    <time
                      dateTime={report.createdAt}
                      className="text-xs text-muted-foreground"
                    >
                      {new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      }).format(date)}
                    </time>
                  )}
                </div>
                <a
                  href={report.url}
                  className="mt-4 flex min-h-11 items-center justify-between gap-4 break-words font-semibold leading-7 underline-offset-4 hover:underline"
                >
                  <span>{report.names?.[lang] ?? report.title}</span>
                  <ExternalLink
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </a>
                {report.kind === "historical" && (
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    {t.historicalContributionNote}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
