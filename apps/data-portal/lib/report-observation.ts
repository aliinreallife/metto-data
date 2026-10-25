import { STRINGS, type StringKey } from "./i18n.ts";
import type { CatalogCity, Lang } from "./catalog.js";
import type { ReportFormState } from "./report-draft.js";
import type { TrainDirection } from "./train-directions.js";
import type { ExitTarget } from "./station-exits.js";
import type { TrainProfile } from "./train-layouts.js";
export type WagonObservation = {
  car: number;
  cars: number;
  profileId: string;
  lineId: string;
  routeId: string;
  destinationId: string;
  exitId: string;
};
export function reportObservation(
  form: ReportFormState,
  lang: Lang,
  city?: CatalogCity,
  direction?: TrainDirection,
  profile?: TrainProfile,
  exit?: ExitTarget,
) {
  const t = STRINGS[lang],
    number = (n: number) =>
      new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(n);
  if (form.kind === "facility")
    return form.amenities
      .filter((row) => row.amenity && row.value)
      .map((row) => {
        const label = t[row.amenity as StringKey],
          value =
            row.value === "true"
              ? t.available
              : row.value === "false"
                ? t.absent
                : t.unknown;
        return label + ": " + value;
      })
      .join("\n");
  if (form.kind === "status" && form.status) {
    const line = city?.lines.find((line) => line.id === form.statusLineId);
    return (line ? line.names[lang] + ": " : "") + t[form.status as StringKey];
  }
  if (form.kind === "wagon" && form.car && profile && direction && exit) {
    return lang === "fa"
      ? "واگن " +
          number(form.car) +
          " از " +
          number(profile.cars) +
          "، " +
          direction.lineNames.fa +
          " به سمت " +
          direction.destinationNames.fa +
          "؛ نزدیک " +
          exit.names.fa +
          "."
      : "Car " +
          number(form.car) +
          " of " +
          number(profile.cars) +
          ", " +
          direction.lineNames.en +
          " toward " +
          direction.destinationNames.en +
          "; closest to " +
          exit.names.en +
          ".";
  }
  return "";
}
