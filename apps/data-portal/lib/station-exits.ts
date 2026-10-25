import type { Names } from "./catalog.js";
export type ExitTarget = {
  id: string;
  names: Names;
  icon: "escalator" | "exit" | "transfer";
};
export type ExitReference = {
  defaults: ExitTarget[];
  stations: Record<
    string,
    { exits?: ExitTarget[]; directions?: Record<string, ExitTarget[]> }
  >;
};
/** Reporting targets, not an assertion that a particular station has an escalator. */
export const exitReference: ExitReference = {
  defaults: [
    {
      id: "up-escalator",
      names: { fa: "پله‌برقی رو به بالا", en: "Up escalator" },
      icon: "escalator",
    },
  ],
  stations: {},
};
export function stationExits(
  stationId: string,
  directionId = "",
  reference = exitReference,
): ExitTarget[] {
  const station = reference.stations[stationId];
  return (
    station?.directions?.[directionId] ?? station?.exits ?? reference.defaults
  );
}
export function wagonContextKey(
  stationId: string,
  directionId: string,
  exitId: string,
  profileId: string,
) {
  return JSON.stringify([stationId, directionId, exitId, profileId]);
}
