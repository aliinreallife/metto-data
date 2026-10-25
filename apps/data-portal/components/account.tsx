"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ShieldCheck,
  LoaderCircle,
  TrainFront,
  AlertCircle,
} from "lucide-react";
import { AccountSettings } from "./account-settings";
import { authClient } from "../lib/auth/client";
import { STRINGS } from "../lib/i18n";
import type { Lang } from "../lib/catalog";
export type AccountUser = { id: string; name: string; emailVerified: boolean };
export function usePortalAccount(configured: boolean) {
  const [user, setUser] = useState<AccountUser | null>(null);
  useEffect(() => {
    if (!configured) return;
    let live = true;
    const refresh = async (event?: Event) => {
      try {
        const { data } = await authClient.getSession({
          query: { disableCookieCache: event?.type === "metto:account" },
          fetchOptions: { cache: "no-store" },
        });
        if (live)
          setUser(
            data?.user
              ? {
                  id: data.user.id,
                  name: data.user.name,
                  emailVerified: !!data.user.emailVerified,
                }
              : null,
          );
      } catch {
        if (live) setUser(null);
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("metto:account", refresh);
    return () => {
      live = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("metto:account", refresh);
    };
  }, [configured]);
  return user;
}
function ProviderLogo({ provider }: { provider: "google" | "github" }) {
  return provider === "google" ? (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.61 4.61 0 0 1-2 3.03v2.52h3.24c1.9-1.75 2.98-4.32 2.98-7.38Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.39l-3.24-2.52c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.93a6 6 0 0 1 0-3.86v-2.6H3.07a10 10 0 0 0 0 9.06l3.34-2.6Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.79.5 3.82 1.49l2.86-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.47l3.34 2.6C7.2 7.71 9.4 5.95 12 5.95Z"
      />
    </svg>
  ) : (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className="size-5"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38l-.01-1.49c-2.23.48-2.7-1.08-2.7-1.08-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.22.82 1.22.82.71 1.22 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.71c.68 0 1.36.09 2 .27 1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.08-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
export function Account({
  lang,
  configured,
  user,
  githubEnabled,
}: {
  lang: Lang;
  configured: boolean;
  user: AccountUser | null;
  githubEnabled: boolean;
}) {
  const t = STRINGS[lang];
  const [pending, setPending] = useState<"google" | "github" | null>(null);
  const [message, setMessage] = useState("");
  const notice = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (new URL(window.location.href).searchParams.has("error"))
      setMessage(STRINGS[lang].socialUnavailable);
  }, [lang]);
  useEffect(() => {
    if (message) notice.current?.focus();
  }, [message]);
  async function social(provider: "google" | "github") {
    if (pending) return;
    setPending(provider);
    setMessage("");
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: `${location.origin}/auth/callback?lang=${lang}`,
        errorCallbackURL: `${location.origin}/account?lang=${lang}&error=oauth`,
      });
      if (result.error) throw Error();
    } catch {
      setMessage(t.socialUnavailable);
    } finally {
      setPending(null);
    }
  }
  const reportLink = `/contribute?lang=${lang}`;
  if (user)
    return (
      <AccountSettings lang={lang} user={user} githubEnabled={githubEnabled} />
    );
  return (
    <section
      className="mx-auto w-full max-w-md py-3 sm:py-10"
      aria-labelledby="account-title"
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="px-6 pb-6 pt-8 text-center sm:px-8 sm:pt-10">
          <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <TrainFront className="size-7" aria-hidden />
          </div>
          <h1
            id="account-title"
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          >
            {t.loginWelcome}
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-7 text-muted-foreground">
            {t.loginIntro}
          </p>
        </div>
        <div className="space-y-3 px-6 pb-7 sm:px-8 sm:pb-8">
          {!configured ? (
            <p
              role="status"
              className="rounded-xl bg-muted p-4 text-sm leading-7"
            >
              {t.accountUnavailable}
            </p>
          ) : (
            <>
              {(
                ["google", ...(githubEnabled ? ["github"] : [])] as (
                  | "google"
                  | "github"
                )[]
              ).map((provider) => (
                <button
                  key={provider}
                  type="button"
                  disabled={!!pending}
                  aria-busy={pending === provider}
                  onClick={() => social(provider)}
                  className="grid min-h-14 w-full grid-cols-[24px_1fr_24px] items-center gap-3 rounded-xl border border-input bg-card px-4 py-3 text-sm font-semibold transition-colors hover:border-foreground/40 hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                >
                  <span className="grid place-items-center">
                    <ProviderLogo provider={provider} />
                  </span>
                  <span>
                    {provider === "google"
                      ? t.continueGoogle
                      : t.continueGithub}
                  </span>
                  <span aria-hidden className="grid place-items-center">
                    {pending === provider ? (
                      <LoaderCircle className="size-4 motion-safe:animate-spin" />
                    ) : (
                      <ArrowLeft className="size-4 text-muted-foreground ltr:rotate-180" />
                    )}
                  </span>
                </button>
              ))}
              <p
                className="pt-3 text-center text-xs leading-6 text-muted-foreground"
                role="status"
              >
                {pending ? t.connectingLogin : t.loginProviderNote}
              </p>
            </>
          )}
          {message && (
            <p
              ref={notice}
              tabIndex={-1}
              role="alert"
              className="flex gap-2 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm leading-7 text-destructive"
            >
              <AlertCircle className="mt-1 size-4 shrink-0" aria-hidden />
              <span>
                {message}
                <span className="mt-2 block">{t.loginLinkHelp}</span>
              </span>
            </p>
          )}
        </div>
        <p className="flex items-start justify-center gap-2 border-t border-border bg-muted/40 px-6 py-4 text-center text-xs leading-6 text-muted-foreground">
          <ShieldCheck className="mt-1 size-4 shrink-0" aria-hidden />
          {t.loginPrivacy}
        </p>
      </div>
      <div className="mt-6 text-center">
        <p className="text-xs leading-6 text-muted-foreground">
          {t.loginOptional}
        </p>
        <a
          href={reportLink}
          className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 px-2 text-sm font-semibold text-primary underline underline-offset-4"
        >
          {t.continueAnonymous}
          <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
        </a>
      </div>
    </section>
  );
}
