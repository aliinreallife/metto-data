"use client";
import { useEffect, useRef, useState } from "react";
import { LogIn, UserRound, LogOut, Mail, ArrowLeft, Check } from "lucide-react";
import { authClient } from "../lib/auth/client";
import { STRINGS } from "../lib/i18n";
import type { Lang } from "../lib/catalog";
export type AccountUser = { id: string; name: string; emailVerified: boolean };
export function usePortalAccount(configured: boolean) {
  const [user, setUser] = useState<AccountUser | null>(null);
  useEffect(() => {
    if (!configured) return;
    let live = true;
    const refresh = async () => {
      try {
        const { data } = await authClient.getSession({
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
const field =
  "min-h-12 w-full rounded-xl border border-input bg-card px-3 py-3 text-base focus-visible:ring-2 focus-visible:ring-ring";
const button =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50";
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
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [codeSent, setCodeSent] = useState(false),
    [cooldown, setCooldown] = useState(0),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null),
    notice = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (codeSent) codeInput.current?.focus();
  }, [codeSent]);
  useEffect(() => {
    if (error) notice.current?.focus();
  }, [error]);
  const callbackURL = () => `${location.origin}/account?lang=${lang}`;
  async function social(provider: "google" | "github") {
    if (pending) return;
    setPending(true);
    setMessage("");
    setError(false);
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: callbackURL(),
      });
      if (result.error) throw Error(result.error.code);
    } catch {
      setError(true);
      setMessage(t.socialUnavailable);
    } finally {
      setPending(false);
    }
  }
  async function sendCode() {
    if (pending || cooldown) return;
    setPending(true);
    setMessage("");
    setError(false);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: "sign-in",
      });
      if (result.error) throw Error();
      setCodeSent(true);
      setCooldown(60);
      setMessage(t.codeSent);
    } catch {
      setError(true);
      setMessage(t.codeSendFailed);
    } finally {
      setPending(false);
    }
  }
  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!codeSent) {
      await sendCode();
      return;
    }
    if (pending) return;
    setPending(true);
    setMessage("");
    setError(false);
    try {
      const result = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp: code.trim(),
      });
      if (result.error) throw Error();
      window.dispatchEvent(new Event("metto:account"));
      setMessage(t.loginDone);
    } catch {
      setError(true);
      setMessage(t.codeInvalid);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-3xl font-bold">{t.account}</h1>
      <p className="mb-7 mt-3 text-sm leading-7 text-muted-foreground">
        {t.accountIntro}
      </p>
      {!configured ? (
        <p
          role="status"
          className="rounded-2xl border border-border bg-card p-5"
        >
          {t.accountUnavailable}
        </p>
      ) : user ? (
        <div className="rounded-2xl border border-border bg-card p-6">
          <UserRound className="mb-3 size-8 text-primary" aria-hidden />
          <h2 className="break-words text-xl font-bold">{user.name}</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {t.signedInPrivacy}
          </p>
          <button
            className={`${button} mt-6`}
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                const result = await authClient.signOut();
                if (result.error) throw Error();
                window.dispatchEvent(new Event("metto:account"));
                setMessage("");
                setCodeSent(false);
                setEmail("");
                setCode("");
              } catch {
                setError(true);
                setMessage(t.accountFailed);
              } finally {
                setPending(false);
              }
            }}
          >
            <LogOut className="size-4" aria-hidden />
            {t.logout}
          </button>
        </div>
      ) : (
        <div className="space-y-6 rounded-2xl border border-border bg-card p-6">
          <button
            type="button"
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-input bg-card px-4 py-3 font-semibold hover:bg-muted disabled:opacity-50"
            disabled={pending}
            onClick={() => social("google")}
          >
            <span aria-hidden className="text-lg font-bold">
              G
            </span>
            {t.continueGoogle}
          </button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t.orEmailCode}
            <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={verify} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm font-semibold">
              {t.email}
              <input
                className={field}
                name="email"
                type="email"
                autoComplete="email"
                dir="ltr"
                required
                maxLength={254}
                value={email}
                readOnly={codeSent}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {codeSent && (
              <>
                <label className="flex flex-col gap-2 text-sm font-semibold">
                  {t.emailCode}
                  <input
                    ref={codeInput}
                    className={`${field} tracking-[.4em]`}
                    name="otp"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    dir="ltr"
                    required
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(event) =>
                      setCode(
                        event.target.value
                          .replace(/[۰-۹]/g, (d) =>
                            String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
                          )
                          .replace(/[٠-٩]/g, (d) =>
                            String("٠١٢٣٤٥٦٧٨٩".indexOf(d)),
                          )
                          .replace(/[^0-9]/g, ""),
                      )
                    }
                  />
                </label>
                <div className="flex flex-wrap justify-between gap-3 text-sm">
                  <button
                    type="button"
                    className="min-h-11 text-primary underline underline-offset-4 disabled:text-muted-foreground"
                    disabled={pending || cooldown > 0}
                    onClick={sendCode}
                  >
                    {t.resendCode}
                    {cooldown > 0
                      ? ` (${new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(cooldown)})`
                      : ""}
                  </button>
                  <button
                    type="button"
                    className="min-h-11 text-muted-foreground underline underline-offset-4"
                    disabled={pending}
                    onClick={() => {
                      setCodeSent(false);
                      setCode("");
                      setMessage("");
                      setError(false);
                      setCooldown(0);
                    }}
                  >
                    {t.changeEmail}
                  </button>
                </div>
              </>
            )}
            <button className={button} disabled={pending}>
              {codeSent ? (
                <Check aria-hidden className="size-4" />
              ) : (
                <Mail aria-hidden className="size-4" />
              )}
              {pending
                ? t.pleaseWait
                : codeSent
                  ? t.verifyAndLogin
                  : t.sendCode}
            </button>
          </form>
          {githubEnabled && (
            <details className="border-t border-border pt-3">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
                {t.moreLoginOptions}
              </summary>
              <button
                type="button"
                className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-input px-4 py-3 text-sm font-semibold hover:bg-muted"
                disabled={pending}
                onClick={() => social("github")}
              >
                <LogIn aria-hidden className="size-4" />
                {t.continueGithub}
              </button>
            </details>
          )}
        </div>
      )}
      {message && (
        <p
          ref={notice}
          tabIndex={-1}
          role={error ? "alert" : "status"}
          className={`mt-5 rounded-xl border border-border p-4 text-sm leading-7 ${error ? "text-destructive" : ""}`}
        >
          {message}
        </p>
      )}
      <a
        href={`/contribute?lang=${lang}`}
        className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
        {t.continueAnonymous}
      </a>
    </section>
  );
}
