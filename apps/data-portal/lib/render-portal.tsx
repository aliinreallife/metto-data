import { notFound, redirect } from "next/navigation";
import { savedProfilePhoto } from "./profile-photo";
import { profilePhotoUrl } from "./avatar";
import { contributorId } from "./credit";
import { portalUser } from "./auth/server";
import { contributorHref, normalizeUsername } from "./usernames";
import { resolveHistoricalId } from "./historical-credit";
import { Portal, type PortalProps } from "../components/portal";
import { catalog } from "./catalog-data";
import { intakeConfig } from "./config";
import { UUID } from "./intake";
import { recentReports } from "./reports";
import { portalAuth } from "./auth/server";
import { leaderboard } from "./leaderboard";
import { headers } from "next/headers";
import { safeReportReturn } from "./auth/return-to";
import {
  profilePath,
  publicMemberProfile,
  type MemberProfile,
} from "./profile";
export type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function renderPortal(
  view: PortalProps["view"],
  props: PageProps,
  profileId = "",
) {
  const params = await props.searchParams;
  const one = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const requestedCity = one("city"),
    initialCity =
      catalog.cities.some((city) => city.id === requestedCity) ||
      (view === "contribute" && requestedCity === "other")
        ? requestedCity
        : "";
  const initialStation = catalog.stations.some(
    (station) =>
      station.id === one("station") &&
      station.cityId === (initialCity || "mashhad"),
  )
    ? one("station")
    : "";
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const config = intakeConfig(host ? `https://${host}` : undefined);
  const intakeEnabled = !!config && host === new URL(config.publicOrigin).host;
  const activity =
    view === "home" || (view === "reports" && !UUID.test(one("report")))
      ? await recentReports(config?.store)
      : { reports: [], unavailable: false };
  const ranking =
    view === "leaderboard" || view === "profile"
      ? await leaderboard(config?.store)
      : { leaders: [], unavailable: false, partial: false };
  let savedProfile: MemberProfile | null = null;
  const requestedProfileId = profileId;
  if (view === "profile") {
    if (profileId === "me") {
      const user = await portalUser();
      if (!user || !config?.creditSecret)
        redirect("/account?lang=" + (one("lang") === "en" ? "en" : "fa"));
      profileId = contributorId(user.id, config.creditSecret);
    } else if (profileId.startsWith("github-")) {
      const id = await resolveHistoricalId(config?.store, profileId);
      if (!id) notFound();
      profileId = id;
    } else if (!/^[a-f0-9]{64}$/.test(profileId)) {
      const username = normalizeUsername(profileId);
      if (!username || !config?.store.findProfileByUsername) notFound();
      const record =
        await config.store.findProfileByUsername<MemberProfile>(username);
      if (!record) notFound();
      profileId = record.id;
      savedProfile = record.value;
    }
    if (!savedProfile && config && /^[a-f0-9]{64}$/.test(profileId))
      savedProfile = await config.store
        .read<MemberProfile>(profilePath(profileId))
        .then((row) => row?.value ?? null)
        .catch(() => null);
    const canonical = savedProfile?.username || profileId;
    if (requestedProfileId !== canonical)
      redirect(
        contributorHref(
          profileId,
          savedProfile?.username,
          one("lang") === "en" ? "en" : "fa",
        ),
      );
  }
  const publicProfile = publicMemberProfile(savedProfile);
  const avatar =
    view === "profile"
      ? await savedProfilePhoto(config?.store, profileId).catch(() => null)
      : null;
  return (
    <Portal
      catalog={catalog}
      view={view}
      initialLang={one("lang") === "en" ? "en" : "fa"}
      initialCity={initialCity}
      initialStation={initialStation}
      initialKind={one("kind")}
      initialReportId={UUID.test(one("report")) ? one("report") : ""}
      intakeEnabled={intakeEnabled}
      previewMode={process.env.VERCEL_ENV === "preview"}
      authConfigured={!!portalAuth()}
      githubEnabled={process.env.DATA_PORTAL_GITHUB_LOGIN === "1"}
      authReturnTo={safeReportReturn(one("returnTo")) ?? ""}
      ranking={ranking}
      profileId={profileId}
      profileUsername={savedProfile?.username ?? ""}
      profilePhotoUrl={
        avatar ? profilePhotoUrl(profileId, avatar.value.version) : null
      }
      publicProfile={publicProfile}
      reports={activity.reports}
      reportsUnavailable={activity.unavailable}
    />
  );
}
