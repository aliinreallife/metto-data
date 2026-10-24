import { Portal, type PortalProps } from "../components/portal";
import { catalog } from "./catalog-data";
import { intakeConfig } from "./config";
import { recentReports } from "./reports";
import { headers } from "next/headers";
export type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function renderPortal(
  view: PortalProps["view"],
  props: PageProps,
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
  const activity =
    view === "home" || view === "reports"
      ? await recentReports()
      : { reports: [], unavailable: false };
  const config = intakeConfig(),
    requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const intakeEnabled = !!config && host === new URL(config.publicOrigin).host;
  return (
    <Portal
      catalog={catalog}
      view={view}
      initialLang={one("lang") === "en" ? "en" : "fa"}
      initialCity={initialCity}
      initialStation={initialStation}
      initialKind={one("kind")}
      intakeEnabled={intakeEnabled}
      reports={activity.reports}
      reportsUnavailable={activity.unavailable}
    />
  );
}
