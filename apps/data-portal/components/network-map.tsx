import type { CatalogCity, Lang } from "../lib/catalog";
import { STRINGS } from "../lib/i18n";
export function NetworkMap({ city, lang }: { city: CatalogCity; lang: Lang }) {
  const t = STRINGS[lang],
    lat0 =
      city.stations.reduce((sum, station) => sum + station.location.lat, 0) /
      city.stations.length;
  const points = city.stations.map((station) => ({
    id: station.id,
    x: station.location.lng * Math.cos((lat0 * Math.PI) / 180),
    y: -station.location.lat,
  }));
  const minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x)),
    minY = Math.min(...points.map((p) => p.y)),
    maxY = Math.max(...points.map((p) => p.y));
  const scale = Math.min(
    820 / Math.max(0.001, maxX - minX),
    520 / Math.max(0.001, maxY - minY),
  );
  const xy = (id: string) => {
    const p = points.find((point) => point.id === id)!;
    return {
      x: 450 + (p.x - (minX + maxX) / 2) * scale,
      y: 300 + (p.y - (minY + maxY) / 2) * scale,
    };
  };
  return (
    <figure className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">{city.names[lang]}</h2>
        {city.candidate && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-950">
            {t.candidate}
          </span>
        )}
      </figcaption>
      <svg
        viewBox="0 0 900 600"
        role="group"
        aria-label={`${t.mapLabel} ${city.names[lang]}`}
        className="w-full"
        style={{ direction: "ltr" }}
      >
        {city.routes.map((route, index) => (
          <polyline
            key={`${route.lineId}-${index}`}
            points={route.stationIds
              .map((id) => {
                const p = xy(id);
                return `${p.x},${p.y}`;
              })
              .join(" ")}
            fill="none"
            stroke={
              city.lines.find((line) => line.id === route.lineId)?.color ??
              "#555"
            }
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
            aria-hidden="true"
          />
        ))}
        {city.stations.map((station) => {
          const p = xy(station.id);
          return (
            <a
              key={station.id}
              href={`/contribute?city=${city.id}&station=${encodeURIComponent(station.id)}&lang=${lang}`}
              aria-label={`${station.names[lang]} · ${city.names[lang]}`}
            >
              <title>{`${station.names[lang]} · ${city.names[lang]}`}</title>
              <circle
                cx={p.x}
                cy={p.y}
                r={station.lines.length > 1 ? 7 : 5}
                fill="var(--card)"
                stroke={
                  station.status === "operational"
                    ? "var(--foreground)"
                    : "#777"
                }
                strokeWidth="2"
              />
              <circle cx={p.x} cy={p.y} r="13" fill="transparent" />
            </a>
          );
        })}
      </svg>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        {t.mapHint}
      </p>
      <a
        href={`/stations?city=${city.id}&lang=${lang}`}
        className="mt-2 inline-block py-2 text-sm font-semibold text-primary underline underline-offset-4"
      >
        {t.directoryLink}
      </a>
    </figure>
  );
}
