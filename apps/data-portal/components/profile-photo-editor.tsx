"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { ProfileAvatar } from "./profile-avatar";
import { prepareProfilePhoto } from "../lib/profile-photo-client";
import { STRINGS } from "../lib/i18n";
import type { Lang } from "../lib/catalog";
const action =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50";
export function ProfilePhotoEditor({ id, lang }: { id: string; lang: Lang }) {
  const t = STRINGS[lang];
  const [url, setUrl] = useState<string | null>(null),
    [revision, setRevision] = useState<string | null>(null);
  const [staged, setStaged] = useState<string | null>(null),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function load() {
    const response = await fetch("/api/profile-photo", { cache: "no-store" });
    if (!response.ok) throw Error();
    const state = await response.json();
    setUrl(state.url);
    setRevision(state.revision);
    setLoaded(true);
  }
  useEffect(() => {
    void load().catch(() => {
      setError(true);
      setMessage(t.avatarLoadFailed);
    });
  }, [id]);
  async function choose(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      setStaged(await prepareProfilePhoto(file));
    } catch {
      setError(true);
      setMessage(t.photoError);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function save(photo: string | null) {
    if (busy || !loaded) return;
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch("/api/profile-photo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo, revision }),
      });
      if (response.status === 409) {
        await load();
        throw Error("changed");
      }
      if (!response.ok) throw Error(String(response.status));
      const state = await response.json();
      setUrl(state.url);
      setRevision(state.revision);
      setStaged(null);
      setMessage(photo === null ? t.avatarRemoved : t.avatarSaved);
    } catch (caught) {
      setError(true);
      const reason = caught instanceof Error ? caught.message : "";
      setMessage(
        reason === "changed"
          ? t.avatarChanged
          : reason === "429"
            ? t.avatarLimited
            : reason === "507"
              ? t.avatarStorageFull
              : reason === "400" || reason === "413"
                ? t.photoError
                : t.avatarFailed,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-labelledby="profile-photo-heading"
      className="border-b border-border pb-6"
    >
      <h2 id="profile-photo-heading" className="font-semibold">
        {t.avatarTitle}
      </h2>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <ProfileAvatar
          id={id}
          src={staged ? "data:image/jpeg;base64," + staged : url}
          size={96}
          alt={t.avatarPreview}
          className="border border-border"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-6 text-muted-foreground">
            {t.avatarPublicNote}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              ref={input}
              id="profile-photo-file"
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label={t.avatarChoose}
              disabled={!loaded || busy}
              onChange={(event) => void choose(event.target.files?.[0])}
            />
            <button
              type="button"
              className={action}
              disabled={!loaded || busy}
              onClick={() => input.current?.click()}
            >
              <Camera className="size-4" aria-hidden />
              {url ? t.avatarReplace : t.avatarChoose}
            </button>
            {url && !staged && (
              <button
                type="button"
                className={action}
                disabled={!loaded || busy}
                onClick={() => void save(null)}
              >
                <Trash2 className="size-4" aria-hidden />
                {t.avatarRemove}
              </button>
            )}
            {staged && (
              <>
                <button
                  type="button"
                  className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void save(staged)}
                >
                  {t.avatarSave}
                </button>
                <button
                  type="button"
                  className={action}
                  disabled={busy}
                  onClick={() => {
                    setStaged(null);
                    setMessage("");
                  }}
                >
                  {t.avatarCancel}
                </button>
              </>
            )}
            {!loaded && error && (
              <button
                type="button"
                className={action}
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void load()
                    .then(() => setMessage(""))
                    .catch(() => setMessage(t.avatarLoadFailed))
                    .finally(() => setBusy(false));
                }}
              >
                {t.retry}
              </button>
            )}
          </div>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            {staged ? t.avatarCropNote : t.avatarHint}
          </p>
        </div>
      </div>
      {busy && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {t.avatarWorking}
        </p>
      )}
      {message && (
        <p
          role={error ? "alert" : "status"}
          className={`mt-3 text-sm leading-6 ${error ? "text-destructive" : "text-muted-foreground"}`}
        >
          {message}
        </p>
      )}
    </section>
  );
}
