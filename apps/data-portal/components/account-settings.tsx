"use client";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Trash2,
  ExternalLink,
  Link2,
  LogOut,
  UserRound,
  ShieldCheck,
} from "lucide-react";
import { contributorHref, USERNAME_PATTERN } from "../lib/usernames";
import { authClient } from "../lib/auth/client";
import { STRINGS } from "../lib/i18n";
import {
  socialKinds,
  socialProfile,
  type SocialKind,
  type SocialLinks,
} from "../lib/social-links";
import type { MemberProfile } from "../lib/profile";
import type { Lang } from "../lib/catalog";
import type { AccountUser } from "./account";
import { ProfilePhotoEditor } from "./profile-photo-editor";
import { SelectField } from "./select-field";
const input =
  "min-h-12 w-full rounded-xl border border-input bg-card px-3 py-3 text-base";
const action =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50";
export function AccountSettings({
  lang,
  user,
  githubEnabled,
}: {
  lang: Lang;
  user: AccountUser;
  githubEnabled: boolean;
}) {
  const t = STRINGS[lang];
  const labels: Record<SocialKind, string> = {
    instagram: t.socialInstagram,
    telegram: t.socialTelegram,
    x: t.socialX,
    github: t.socialGithub,
    spotify: t.socialSpotify,
    website: t.socialWebsite,
  };
  const [tab, setTab] = useState<"profile" | "connections">("profile");
  const [profile, setProfile] = useState<MemberProfile>({
    name: user.name,
    username: "",
    age: null,
    gender: "",
    bio: "",
    publicName: "",
    socialLinks: {},
    publicProfile: false,
  });
  const [revision, setRevision] = useState<string | null>(null),
    [id, setId] = useState("");
  const [savedUsername, setSavedUsername] = useState("");
  const [historicalLinked, setHistoricalLinked] = useState(false);
  const [loaded, setLoaded] = useState(false),
    [pending, setPending] = useState(false),
    [savedPublic, setSavedPublic] = useState(false);
  const [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [invalidSocial, setInvalidSocial] = useState<SocialKind | null>(null);
  const [accounts, setAccounts] = useState<
      { id: string; providerId: string }[] | null
    >(null),
    [accountsError, setAccountsError] = useState(false);
  const notice = useRef<HTMLParagraphElement>(null);
  const providers = ["google", ...(githubEnabled ? ["github"] : [])] as (
    | "google"
    | "github"
  )[];
  async function loadProfile() {
    setMessage("");
    setError(false);
    setLoaded(false);
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (data.profile) setProfile(data.profile);
      setRevision(data.revision);
      setId(data.id);
      setSavedUsername(data.profile?.username ?? "");
      setHistoricalLinked(!!data.historicalLinked);
      setSavedPublic(!!data.profile?.publicProfile);
      setLoaded(true);
    } catch {
      setError(true);
      setMessage(t.profileLoadFailed);
    }
  }
  async function loadAccounts() {
    setAccountsError(false);
    try {
      const result = await authClient.listAccounts();
      if (result.error || !result.data) throw Error();
      setAccounts(
        result.data.map((account) => ({
          id: account.id,
          providerId: account.providerId,
        })),
      );
    } catch {
      setAccountsError(true);
    }
  }
  useEffect(() => {
    void loadProfile();
    void loadAccounts();
  }, [user.id]);
  useEffect(() => {
    if (new URL(window.location.href).searchParams.has("error")) {
      setError(true);
      setMessage(t.linkFailed);
    }
  }, [lang]);
  useEffect(() => {
    if (message) notice.current?.focus();
  }, [message]);
  function change<K extends keyof MemberProfile>(
    key: K,
    value: MemberProfile[K],
  ) {
    setProfile((previous) => ({ ...previous, [key]: value }));
    setMessage("");
    setInvalidSocial(null);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!loaded || pending) return;
    for (const [kind, value] of Object.entries(profile.socialLinks)) {
      try {
        socialProfile(kind as SocialKind, value);
      } catch {
        setError(true);
        setMessage(t.socialInvalid);
        setInvalidSocial(kind as SocialKind);
        document.getElementById(`social-${kind}`)?.focus();
        return;
      }
    }
    setPending(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, revision }),
      });
      if (!response.ok) {
        if (response.status === 409) {
          const conflict = await response.json();
          if (conflict.error === "username_taken")
            throw Error("username_taken");
          if (
            conflict.revision === null ||
            typeof conflict.revision === "string"
          )
            setRevision(conflict.revision);
        }
        throw Error(response.status === 409 ? "changed" : "failed");
      }
      const data = await response.json();
      setProfile(data.profile);
      setRevision(data.revision);
      setId(data.id);
      setSavedUsername(data.profile?.username ?? "");
      setHistoricalLinked(!!data.historicalLinked);
      setSavedPublic(data.profile.publicProfile);
      setMessage(t.profileSaved);
      window.dispatchEvent(new Event("metto:account"));
    } catch (caught) {
      setError(true);
      setMessage(
        caught instanceof Error && caught.message === "username_taken"
          ? t.usernameTaken
          : caught instanceof Error && caught.message === "changed"
            ? t.profileChanged
            : t.profileSaveFailed,
      );
    } finally {
      setPending(false);
    }
  }
  async function connect(provider: "google" | "github") {
    if (pending) return;
    setPending(true);
    setMessage("");
    setError(false);
    try {
      const result = await authClient.linkSocial({
        provider,
        callbackURL: `${location.origin}/auth/callback?lang=${lang}&mode=link`,
      });
      if (result.error) throw Error();
    } catch {
      setError(true);
      setMessage(t.linkFailed);
    } finally {
      setPending(false);
    }
  }
  async function disconnect(providerId: string) {
    if (
      pending ||
      !accounts ||
      new Set(
        accounts
          .filter((account) =>
            providers.includes(account.providerId as "google" | "github"),
          )
          .map((account) => account.providerId),
      ).size < 2
    )
      return;
    setPending(true);
    setMessage("");
    setError(false);
    try {
      const accountId = accounts.find(
        (account) => account.providerId === providerId,
      )?.id;
      if (!accountId) throw Error();
      const result = await authClient.unlinkAccount({ accountId });
      if (result.error) throw Error();
      await loadAccounts();
      setMessage(t.connectionRemoved);
    } catch {
      setError(true);
      setMessage(t.connectionFailed);
    } finally {
      setPending(false);
    }
  }
  const addable = socialKinds.filter(
    (kind) => !Object.hasOwn(profile.socialLinks, kind),
  );
  return (
    <section className="mx-auto max-w-2xl" aria-labelledby="account-title">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 id="account-title" className="text-3xl font-bold">
            {t.account}
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {t.accountSettingsIntro}
          </p>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <UserRound aria-hidden className="size-5" />
        </span>
      </div>
      <div
        className="mb-6 flex gap-1 rounded-xl bg-muted p-1"
        role="group"
        aria-label={t.accountSections}
      >
        {(["profile", "connections"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => {
              setTab(value);
              setMessage("");
            }}
            className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold ${tab === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            {value === "profile" ? t.editProfile : t.loginConnections}
          </button>
        ))}
      </div>
      {tab === "profile" ? (
        <form
          onSubmit={save}
          className="space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-7"
        >
          {loaded && id && <ProfilePhotoEditor id={id} lang={lang} />}
          {!loaded && (
            <p role="status" className="text-sm text-muted-foreground">
              {error ? t.profileLoadFailed : t.profileLoading}
            </p>
          )}
          <fieldset disabled={!loaded || pending} className="min-w-0 space-y-5">
            <legend className="mb-4 font-semibold">{t.privateDetails}</legend>
            <label className="flex flex-col gap-2 text-sm font-semibold">
              {t.profileName}
              <input
                className={input}
                required
                minLength={2}
                maxLength={80}
                value={profile.name}
                autoComplete="name"
                onChange={(event) => change("name", event.target.value)}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-semibold">
                {t.ageOptional}
                <input
                  className={input}
                  type="number"
                  min={0}
                  max={120}
                  step={1}
                  inputMode="numeric"
                  value={profile.age ?? ""}
                  onChange={(event) =>
                    change(
                      "age",
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                />
              </label>
              <SelectField
                label={t.genderOptional}
                value={profile.gender}
                onChange={(value) =>
                  change("gender", value as MemberProfile["gender"])
                }
                options={[
                  { value: "", label: t.notSet },
                  { value: "woman", label: t.genderWoman },
                  { value: "man", label: t.genderMan },
                  { value: "nonbinary", label: t.genderNonbinary },
                  { value: "prefer_not_say", label: t.genderPrivate },
                ]}
              />
            </div>
            <p className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">
              <ShieldCheck className="mt-1 size-4 shrink-0" aria-hidden />
              {t.privateDetailsNote}
            </p>
          </fieldset>
          <fieldset
            disabled={!loaded || pending}
            className="min-w-0 space-y-5 border-t border-border pt-5"
          >
            <legend className="px-2 font-semibold">{t.publicProfile}</legend>
            <div className="flex flex-col gap-2 text-sm font-semibold">
              <label htmlFor="profile-username">{t.username}</label>
              <input
                id="profile-username"
                className={input}
                value={profile.username ?? ""}
                minLength={3}
                maxLength={30}
                pattern={USERNAME_PATTERN}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                dir="ltr"
                aria-describedby="username-hint"
                onChange={(event) =>
                  change(
                    "username",
                    event.target.value.replace(/^@/, "").toLowerCase(),
                  )
                }
              />
              <span
                id="username-hint"
                className="text-xs font-normal leading-6 text-muted-foreground"
              >
                {t.usernameHint}
              </span>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-muted/50 p-4 text-sm leading-7">
              <input
                className="mt-1.5 size-4 shrink-0 accent-primary"
                type="checkbox"
                checked={profile.publicProfile}
                onChange={(event) =>
                  change("publicProfile", event.target.checked)
                }
              />
              <span>
                <strong className="block">{t.showPublicProfile}</strong>
                <span className="text-muted-foreground">
                  {t.publicProfileNote}
                </span>
              </span>
            </label>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="profile-public-name"
                className="text-sm font-semibold"
              >
                {t.publicAlias}
              </label>
              <input
                id="profile-public-name"
                className={input}
                value={profile.publicName}
                required={profile.publicProfile}
                minLength={2}
                maxLength={80}
                pattern="[^@\x00-\x1f\x7f]+"
                onChange={(event) => change("publicName", event.target.value)}
              />
              <span className="text-xs font-normal leading-6 text-muted-foreground">
                {t.publicNameHint}
              </span>
            </div>
            <label className="flex flex-col gap-2 text-sm font-semibold">
              {t.bioOptional}
              <textarea
                className={`${input} min-h-28 leading-7`}
                maxLength={300}
                value={profile.bio}
                onChange={(event) => change("bio", event.target.value)}
              />
              <span
                aria-hidden="true"
                className="text-xs font-normal text-muted-foreground"
              >
                {new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(
                  profile.bio.length,
                )}{" "}
                /{" "}
                {new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(
                  300,
                )}
              </span>
            </label>
            <div className="space-y-4">
              <h2 className="text-sm font-semibold">{t.socialLinks}</h2>
              <p className="text-xs leading-6 text-muted-foreground">
                {t.socialLinksHint}
              </p>
              {(
                Object.entries(profile.socialLinks) as [SocialKind, string][]
              ).map(([kind, value]) => (
                <div key={kind} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor={`social-${kind}`}
                      className="text-sm font-semibold"
                    >
                      {labels[kind]}
                    </label>
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-1.5 px-2 text-xs text-muted-foreground"
                      aria-label={`${t.removeSocial}: ${labels[kind]}`}
                      onClick={() => {
                        const next: SocialLinks = { ...profile.socialLinks };
                        delete next[kind];
                        change("socialLinks", next);
                      }}
                    >
                      <Trash2 aria-hidden className="size-3.5" />
                      {t.removeSocial}
                    </button>
                  </div>
                  <input
                    id={`social-${kind}`}
                    className={input}
                    dir="ltr"
                    type="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    maxLength={300}
                    placeholder={
                      kind === "website" ? "https://example.com" : "@username"
                    }
                    aria-invalid={invalidSocial === kind || undefined}
                    value={value}
                    onChange={(event) =>
                      change("socialLinks", {
                        ...profile.socialLinks,
                        [kind]: event.target.value,
                      })
                    }
                  />
                </div>
              ))}
              {!!addable.length && (
                <SelectField
                  label={t.addSocial}
                  value=""
                  onChange={(value) => {
                    if (value)
                      change("socialLinks", {
                        ...profile.socialLinks,
                        [value]: "",
                      });
                  }}
                  options={[
                    { value: "", label: t.chooseOption },
                    ...addable.map((kind) => ({
                      value: kind,
                      label: labels[kind],
                    })),
                  ]}
                />
              )}
            </div>
          </fieldset>
          {historicalLinked && (
            <p className="rounded-xl bg-muted/50 p-4 text-sm leading-7">
              {t.historicalCreditLinked}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={!loaded || pending}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              <Check className="size-4" aria-hidden />
              {pending ? t.savingProfile : t.saveProfile}
            </button>
            {id && (savedPublic || savedUsername) && (
              <a
                href={contributorHref(id, savedUsername, lang)}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4"
              >
                {t.viewPublicProfile}
                <ExternalLink aria-hidden className="size-4" />
              </a>
            )}
          </div>
        </form>
      ) : (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7">
          <h2 className="font-semibold">{t.loginConnections}</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            {t.loginConnectionsHint}
          </p>
          {accountsError ? (
            <div>
              <p role="status" className="text-sm">
                {t.connectionLoadFailed}
              </p>
              <button
                type="button"
                className={`${action} mt-3`}
                onClick={loadAccounts}
              >
                {t.retry}
              </button>
            </div>
          ) : accounts === null ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t.profileLoading}
            </p>
          ) : (
            providers.map((provider) => {
              const connected = accounts.some(
                  (account) => account.providerId === provider,
                ),
                last =
                  new Set(
                    accounts
                      .filter((item) =>
                        providers.includes(
                          item.providerId as "google" | "github",
                        ),
                      )
                      .map((item) => item.providerId),
                  ).size < 2;
              return (
                <div
                  key={provider}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4"
                >
                  <div>
                    <h3 dir="ltr" className="font-semibold">
                      {provider === "google" ? "Google" : "GitHub"}
                    </h3>
                    <p
                      className={`mt-1 flex items-center gap-1 text-xs ${connected ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {connected && <Check className="size-3.5" aria-hidden />}
                      {connected ? t.connected : t.notConnected}
                    </p>
                  </div>
                  {connected ? (
                    <button
                      type="button"
                      disabled={pending || last}
                      className={action}
                      onClick={() => disconnect(provider)}
                    >
                      {t.disconnect}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      className={action}
                      onClick={() => connect(provider)}
                    >
                      <Link2 aria-hidden className="size-4" />
                      {t.connect}
                    </button>
                  )}
                </div>
              );
            })
          )}
          <p className="text-xs leading-6 text-muted-foreground">
            {t.keepLoginMethod}
          </p>
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
      {!loaded && error && tab === "profile" && (
        <button
          type="button"
          className={`${action} mt-3`}
          onClick={loadProfile}
        >
          {t.retry}
        </button>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <a
          href={`/contribute?lang=${lang}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4"
        >
          {t.sendReport}
        </a>
        <button
          type="button"
          className={action}
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setMessage("");
            try {
              const result = await authClient.signOut();
              if (result.error) throw Error();
              window.dispatchEvent(new Event("metto:account"));
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
    </section>
  );
}
