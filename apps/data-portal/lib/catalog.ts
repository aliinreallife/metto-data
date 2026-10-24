export type Lang = "fa" | "en";
export type Names = { fa: string; en: string };
type SourceStation = {
  id: string;
  cityId: string;
  names: Names;
  location: { lat: number; lng: number };
  amenities: Record<string, boolean | null>;
  amenitiesVerified?: boolean;
  status?: string;
};
type SourceLine = { id: string; names: Names; color: string };
type SourceGraph = {
  routes: { lineId: string; stops: { stationId: string }[] }[];
};
export type CatalogStation = SourceStation & {
  lines: SourceLine[];
  candidate: boolean;
};
export type CatalogCity = {
  id: string;
  names: Names;
  candidate: boolean;
  stations: CatalogStation[];
  lines: SourceLine[];
  routes: { lineId: string; stationIds: string[] }[];
};
export type Catalog = {
  cities: CatalogCity[];
  stations: CatalogStation[];
  stationCount: number;
  lineCount: number;
};
export function buildCatalog(
  inputs: {
    id: string;
    names: Names;
    candidate: boolean;
    stations: SourceStation[];
    lines: SourceLine[];
    graph: SourceGraph;
    allowedLineIds?: string[];
  }[],
): Catalog {
  const cities = inputs.map((input) => {
    const lines = input.lines.filter(
      (line) => !input.allowedLineIds || input.allowedLineIds.includes(line.id),
    );
    const routes = input.graph.routes.filter((route) =>
      lines.some((line) => line.id === route.lineId),
    );
    const served = new Set(
      routes.flatMap((route) => route.stops.map((stop) => stop.stationId)),
    );
    const stations = input.stations
      .filter((station) => served.has(station.id))
      .map((station) => ({
        ...station,
        candidate: input.candidate,
        lines: lines.filter((line) =>
          routes.some(
            (route) =>
              route.lineId === line.id &&
              route.stops.some((stop) => stop.stationId === station.id),
          ),
        ),
      }));
    return {
      id: input.id,
      names: input.names,
      candidate: input.candidate,
      stations,
      lines,
      routes: routes.map((route) => ({
        lineId: route.lineId,
        stationIds: route.stops.map((stop) => stop.stationId),
      })),
    };
  });
  const stations = cities.flatMap((city) => city.stations);
  return {
    cities,
    stations,
    stationCount: stations.length,
    lineCount: cities.reduce((count, city) => count + city.lines.length, 0),
  };
}
export function searchStations(
  catalog: Catalog,
  cityId: string,
  query: string,
) {
  const normalize = (value: string) =>
    value
      .normalize("NFKC")
      .replace(/ي/g, "ی")
      .replace(/ك/g, "ک")
      .replace(/[\s\u200c-]+/g, " ")
      .trim()
      .toLocaleLowerCase();
  const needle = normalize(query);
  return catalog.stations.filter(
    (station) =>
      (!cityId || station.cityId === cityId) &&
      normalize(
        `${station.names.fa} ${station.names.en} ${catalog.cities.find((city) => city.id === station.cityId)?.names.fa} ${station.cityId}`,
      ).includes(needle),
  );
}
