"use client";
import { useState } from "react";
import { Plus, Minus, RotateCcw } from "lucide-react";
import type { CatalogCity, Lang } from "../lib/catalog";
import { constructionMap } from "../lib/construction-map";
import { STRINGS } from "../lib/i18n";
export function NetworkMap({ city, lang }: { city: CatalogCity; lang: Lang }) {
  const [zoom, setZoom] = useState(1);
  const labels =
    lang === "fa"
      ? { in: "بزرگ‌نمایی", out: "کوچک‌نمایی", reset: "اندازهٔ اولیه" }
      : { in: "Zoom in", out: "Zoom out", reset: "Reset zoom" };
  const construction =
    city.id === constructionMap.cityId ? constructionMap.segments : [];
  const t = STRINGS[lang],
    lat0 =
      city.stations.reduce((sum, station) => sum + station.location.lat, 0) /
      city.stations.length;
  const points = city.stations.map((station) => ({
    id: station.id,
    x: station.location.lng * Math.cos((lat0 * Math.PI) / 180),
    y: -station.location.lat,
  }));
  const constructionPoints = construction.flatMap((segment) =>
    segment.coordinates.map(([lat, lng]) => ({
      x: lng * Math.cos((lat0 * Math.PI) / 180),
      y: -lat,
    })),
  );
  const bounds = [...points, ...constructionPoints];
  const minX = Math.min(...bounds.map((p) => p.x)),
    maxX = Math.max(...bounds.map((p) => p.x)),
    minY = Math.min(...bounds.map((p) => p.y)),
    maxY = Math.max(...bounds.map((p) => p.y));
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-xs">
          {city.lines.map((line) => (
            <span key={line.id} className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="h-1 w-5 rounded-full"
                style={{ background: line.color }}
              />
              {line.names[lang]}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {[
            [
              labels.in,
              Plus,
              () => setZoom(Math.min(3, zoom + 0.5)),
              zoom === 3,
            ],
            [
              labels.out,
              Minus,
              () => setZoom(Math.max(1, zoom - 0.5)),
              zoom === 1,
            ],
            [labels.reset, RotateCcw, () => setZoom(1), zoom === 1],
          ].map(([label, Icon, action, disabled]) => {
            const Control = Icon as typeof Plus;
            return (
              <button
                key={String(label)}
                type="button"
                aria-label={String(label)}
                onClick={action as () => void}
                disabled={disabled as boolean}
                className="grid size-11 place-items-center rounded-lg border border-border hover:bg-muted"
              >
                <Control className="size-4" aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
      <div
        className="overflow-auto rounded-xl border border-border bg-background"
        tabIndex={0}
        role="region"
        aria-label={`${t.mapLabel} ${city.names[lang]}`}
      >
        <svg
          viewBox="0 0 900 600"
          role="group"
          aria-label={`${t.mapLabel} ${city.names[lang]}`}
          className="block max-w-none"
          style={{ direction: "ltr", width: `${zoom * 100}%` }}
        >
          {construction.map((segment) => (
            <polyline
              key={segment.id}
              data-testid="construction-section"
              points={segment.coordinates
                .map(
                  ([lat, lng]) =>
                    `${450 + (lng * Math.cos((lat0 * Math.PI) / 180) - (minX + maxX) / 2) * scale},${300 + (-lat - (minY + maxY) / 2) * scale}`,
                )
                .join(" ")}
              fill="none"
              stroke={segment.displayColor}
              strokeWidth="3"
              strokeDasharray="5 6"
              strokeLinecap="round"
              aria-hidden="true"
            />
          ))}
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
          {city.id === constructionMap.cityId &&
            constructionMap.futureStops.map((stop) => (
              <circle
                key={stop.id}
                data-testid="future-stop"
                cx={
                  450 +
                  (stop.location.lng * Math.cos((lat0 * Math.PI) / 180) -
                    (minX + maxX) / 2) *
                    scale
                }
                cy={300 + (-stop.location.lat - (minY + maxY) / 2) * scale}
                r="4"
                fill="var(--card)"
                stroke={
                  construction.find(
                    (section) => section.lineId === stop.lineIds[0],
                  )?.displayColor ?? "#777"
                }
                strokeWidth="1.5"
                strokeDasharray="2 2"
              >
                <title>{`${stop.names[lang]} · ${t.planned}`}</title>
              </circle>
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
      </div>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        {t.mapHint}
      </p>
      <a
        href={`/stations?city=${city.id}&lang=${lang}`}
        className="mt-2 inline-block py-2 text-sm font-semibold text-primary underline underline-offset-4"
      >
        {t.directoryLink}
      </a>
      {construction.length > 0 && (
        <div
          className="mt-4 border-t border-border pt-4 text-xs leading-6"
          data-testid="construction-legend"
        >
          <p className="font-semibold">{t.constructionSections}</p>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
            {[
              ...new Map(
                construction.map((segment) => [segment.lineId, segment]),
              ).values(),
            ].map((segment) => (
              <span
                key={segment.lineId}
                className="inline-flex items-center gap-2"
              >
                <span
                  aria-hidden
                  className="w-6 border-t-2 border-dashed"
                  style={{ borderColor: segment.displayColor }}
                />
                {segment.names[lang]}
              </span>
            ))}
          </div>
          <p className="mt-2 text-muted-foreground">
            {t.constructionNote}{" "}
            <a
              className="text-primary underline underline-offset-4"
              href={constructionMap.attributionUrl}
            >
              © OpenStreetMap
            </a>{" "}
            ·{" "}
            {new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en", {
              dateStyle: "medium",
              timeZone: "Asia/Tehran",
            }).format(new Date(constructionMap.retrievedAt))}
          </p>
        </div>
      )}
    </figure>
  );
}
