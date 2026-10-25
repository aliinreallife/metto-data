import type { CatalogCity, Names } from "./catalog.js";
import type { TrainProfile } from "./train-layouts.js";

export type TrainDirection = {
  id: string;
  routeId: string;
  lineId: string;
  lineNames: Names;
  destinationId: string;
  destinationNames: Names;
  oppositeId: string;
  oppositeNames: Names;
};

/** Only expose the boarding routes belonging to this layout and station. */
export function trainDirections(
  city: CatalogCity | undefined,
  profile: TrainProfile | undefined,
  stationId = "",
): TrainDirection[] {
  if (!city || !profile || city.id !== profile.cityId) return [];
  return city.routes.flatMap((route) => {
    if (
      !profile.routeIds.includes(route.id) ||
      (stationId && !route.boardableStationIds.includes(stationId))
    )
      return [];
    const line = city.lines.find((line) => line.id === route.lineId);
    const first = city.stations.find(
      (station) => station.id === route.boardableStationIds[0],
    );
    const last = city.stations.find(
      (station) => station.id === route.boardableStationIds.at(-1),
    );
    if (!line || !first || !last || first.id === last.id) return [];
    return [
      [first, last],
      [last, first],
    ].map(([destination, opposite]) => ({
      id: `${route.id}|${destination.id}`,
      routeId: route.id,
      lineId: line.id,
      lineNames: line.names,
      destinationId: destination.id,
      destinationNames: destination.names,
      oppositeId: opposite.id,
      oppositeNames: opposite.names,
    }));
  });
}
