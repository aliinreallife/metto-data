"use client";
import { useEffect, useState } from "react";
import { Check, X, ExternalLink, MessageCircle } from "lucide-react";
import type { PublicCommunity, VoteChoice } from "../lib/community";
import type { Catalog, Lang } from "../lib/catalog";
import type { AccountUser } from "./account";
const copy = {
  fa: {
    loading: "در حال دریافت گزارش…",
    missing: "این گزارش هنوز منتشر نشده یا فعلاً در دسترس نیست.",
    retry: "دوباره تلاش کن",
    source: "منبع گزارش",
    issue: "گزارش در گیت‌هاب",
    question: "این اطلاعات درسته؟",
    intro:
      "اگه این ایستگاه رو می‌شناسی، تجربه‌ات رو بگو. می‌تونی رأیت رو عوض کنی یا پس بگیری.",
    confirm: "تأیید می‌کنم",
    deny: "درست نیست",
    withdraw: "پس گرفتن رأی من",
    login: "برای تأیید یا رد گزارش وارد شو",
    anonymous: "برای خواندن گزارش نیازی به ورود نیست.",
    failed: "رأی ثبت نشد؛ دوباره تلاش کن.",
    threshold:
      "رأی هم‌نظر، گزارش برای بررسی مدیر فرستاده می‌شه. تغییر داده فقط بعد از تأیید مدیر انجام می‌شه.",
    queued: "این گزارش در صف بررسی مدیر است.",
    notified: "مدیر برای بررسی این گزارش مطلع شده.",
    automatic:
      "اصلاح امکانات این گزارش، بعد از تأیید مدیر و بررسی خودکار، در داده‌ها ثبت می‌شه.",
    manual: "این گزارش بخش‌هایی داره که مدیر باید دستی بررسی و ثبت کنه.",
    approved: "مدیر گزارش رو تأیید کرده؛ ثبت اصلاحات در حال بررسیه.",
    applied: "اصلاحات تأییدشده در داده‌ها ثبت شد.",
    rejected: "مدیر این گزارش رو نپذیرفته.",
    manualState: "این گزارش برای ثبت دستی به مدیر ارجاع شده.",
    counts: "رأی‌ها",
    saved: "رأی تو ثبت شد.",
    photo: "عکس پیوست گزارش",
  },
  en: {
    loading: "Loading report…",
    missing:
      "This report has not been published or is temporarily unavailable.",
    retry: "Try again",
    source: "Report source",
    issue: "Report on GitHub",
    question: "Is this information correct?",
    intro:
      "Know this station? Share what you have seen. You can change or withdraw your vote.",
    confirm: "Confirm",
    deny: "Disagree",
    withdraw: "Withdraw my vote",
    login: "Sign in to confirm or disagree",
    anonymous: "You can read reports without signing in.",
    failed: "Your vote was not saved. Please try again.",
    threshold:
      "matching votes queue a report for the maintainer. Data changes still require the maintainer’s approval.",
    queued: "Queued for maintainer review.",
    notified: "The maintainer has been notified to review this report.",
    automatic:
      "After maintainer approval and validation, this report’s structured amenity corrections can be added to the data automatically.",
    manual:
      "Parts of this report need the maintainer to review and record them manually.",
    approved: "Approved by the maintainer; checking the data update.",
    applied: "Approved corrections have been recorded in the data.",
    rejected: "The maintainer did not accept this report.",
    manualState: "Referred to the maintainer for a manual update.",
    counts: "Votes",
    saved: "Your vote was saved.",
    photo: "Photo attached to the report",
  },
};
export function CommunityReportPanel({
  id,
  lang,
  account,
  catalog,
}: {
  id: string;
  lang: Lang;
  account: AccountUser | null;
  catalog: Catalog;
}) {
  const t = copy[lang];
  const [data, setData] = useState<PublicCommunity | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    fetch("/api/community?report=" + encodeURIComponent(id), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw Error();
        const result = await response.json();
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(t.missing);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, account?.id, retry, t.missing]);
  async function vote(choice: VoteChoice | null) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: id, choice }),
      });
      if (!response.ok) throw Error();
      setData(await response.json());
      setMessage(t.saved);
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <p role="status" className="rounded-2xl border border-border bg-card p-6">
        {t.loading}
      </p>
    );
  if (!data)
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p role="status">{error || t.missing}</p>
        <button
          className="mt-4 min-h-11 font-semibold text-primary underline"
          onClick={() => setRetry(retry + 1)}
        >
          {t.retry}
        </button>
      </div>
    );
  const city = catalog.cities.find((city) => city.id === data.report.cityId),
    station = catalog.stations.find(
      (station) => station.id === data.report.stationId,
    );
  const count = (value: number) =>
    new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(value);
  const closed = data.decision;
  return (
    <article
      className="overflow-hidden rounded-2xl border border-border bg-card"
      data-testid="community-report"
    >
      <div className="space-y-4 p-5 sm:p-7">
        <p className="text-sm text-muted-foreground">
          {city?.names[lang] ?? data.report.cityId}
        </p>
        <h2 className="text-xl font-bold">
          {station?.names[lang] ?? data.report.title}
        </h2>
        <p className="whitespace-pre-wrap break-words text-sm leading-8">
          {data.report.details}
        </p>
        {data.report.source && (
          <p className="whitespace-pre-wrap break-words border-s-2 border-border ps-4 text-sm leading-7 text-muted-foreground">
            {t.source}: {data.report.source}
          </p>
        )}
        {data.report.photoUrl && (
          <a
            href={data.report.photoUrl}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline"
          >
            {t.photo}
            <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
        <a
          href={data.report.issueUrl}
          className="flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4"
        >
          {t.issue}
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </div>
      <div className="border-t border-border bg-muted/35 p-5 sm:p-7">
        <h3 className="flex items-center gap-2 font-bold">
          <MessageCircle className="size-5 text-primary" aria-hidden />
          {t.question}
        </h3>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          {t.intro}
        </p>
        <p aria-label={t.counts} className="mt-4 text-sm font-semibold">
          {t.confirm}: {count(data.confirm)} · {t.deny}: {count(data.deny)}
        </p>
        {!closed &&
          (account?.emailVerified ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {(["confirm", "deny"] as const).map((choice) => {
                const Icon = choice === "confirm" ? Check : X;
                return (
                  <button
                    key={choice}
                    type="button"
                    disabled={busy}
                    aria-pressed={data.myVote === choice}
                    onClick={() => void vote(choice)}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${data.myVote === choice ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary"}`}
                  >
                    <Icon className="size-4" aria-hidden />
                    {t[choice]}
                  </button>
                );
              })}
              {data.myVote && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void vote(null)}
                  className="min-h-11 px-2 text-sm text-primary underline"
                >
                  {t.withdraw}
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <a
                className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
                href={
                  "/account?" +
                  new URLSearchParams({
                    lang,
                    returnTo:
                      "/reports?" + new URLSearchParams({ report: id, lang }),
                  })
                }
              >
                {t.login}
              </a>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {t.anonymous}
              </p>
            </div>
          ))}
        <p
          role="status"
          aria-live="polite"
          className="mt-3 text-sm text-primary"
        >
          {message}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-5 space-y-2 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">
          {closed ? (
            <p className="font-semibold text-foreground">
              {closed === "approved"
                ? t.approved
                : closed === "applied"
                  ? t.applied
                  : closed === "rejected"
                    ? t.rejected
                    : t.manualState}
            </p>
          ) : (
            <>
              <p>
                {count(data.threshold)} {t.threshold}
              </p>
              {data.queued && (
                <p className="font-semibold text-foreground">
                  {data.notified ? t.notified : t.queued}
                </p>
              )}
            </>
          )}
          {data.automatic > 0 && !closed && <p>{t.automatic}</p>}
          {data.manual && <p>{t.manual}</p>}
        </div>
      </div>
    </article>
  );
}
