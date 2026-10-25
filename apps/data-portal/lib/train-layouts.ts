import reference from "../../../data/reference/train-layouts.json" with { type: "json" };
export type TrainProfile = (typeof reference.profiles)[number];
export const trainProfiles = reference.profiles;
export const trainSources = reference.sources;
export function resolveTrainProfile(
  city: string,
  lines: string[] = [],
  selected = "",
  stationId = "",
) {
  const profiles = availableTrainProfiles(city, lines, stationId);
  const override = (reference.stationOverrides as Record<string, string>)[
    stationId
  ];
  return (
    profiles.find((profile) => profile.id === selected) ??
    profiles.find((profile) => profile.id === override) ??
    profiles.find(
      (profile) =>
        profile.id === (reference.defaults as Record<string, string>)[city],
    ) ??
    profiles[0]
  );
}
export function availableTrainProfiles(
  city: string,
  lines: string[] = [],
  stationId = "",
) {
  const override = (reference.stationOverrides as Record<string, string>)[
    stationId
  ];
  return trainProfiles.filter(
    (profile) =>
      profile.cityId === city &&
      (!override || profile.id === override) &&
      (!lines.length || profile.lineIds.some((line) => lines.includes(line))),
  );
}
export function womenZone(
  profile: TrainProfile | undefined,
  count: number,
  car: number,
): "full" | "head-half" | "rear-half" | null {
  if (!profile?.women || count !== profile.cars) return null;
  if (profile.women.full.includes(car)) return "full";
  if (profile.women.headHalf.includes(car)) return "head-half";
  if (profile.women.rearHalf.includes(car)) return "rear-half";
  return null;
}
