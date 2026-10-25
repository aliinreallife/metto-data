export const DRAFT_KEY = "metto:contribution-draft:v1";
export const DRAFT_TTL = 24 * 60 * 60 * 1000;
export const reportKinds = [
  "timetable",
  "facility",
  "status",
  "location",
  "wagon",
  "other",
  "city_request",
] as const;
export type ReportKind = (typeof reportKinds)[number];
export const amenityKeys = [
  "elevator",
  "wc",
  "atm",
  "coffeeShop",
  "fastFood",
  "groceryStore",
  "freeWifi",
  "prayerRoom",
  "parking",
  "police",
] as const;
export type AmenityRow = { id: number; amenity: string; value: string };
export type ReportFormState = {
  cityId: string;
  stationId: string;
  kind: ReportKind;
  step: 1 | 2 | 3;
  trainProfileId: string;
  directionId: string;
  exitId: string;
  car: number | null;
  amenities: AmenityRow[];
  status: string;
  statusLineId: string;
  subject: string;
  details: string;
  source: string;
  photo: string;
  photoName: string;
  contactMode: "anonymous" | "contact" | "credit";
  name: string;
  contact: string;
  publicName: string;
};
export type SavedReportDraft = {
  version: 1;
  savedAt: number;
  form: ReportFormState;
  retry?: { fingerprint: string; id: string };
};
export function newReportForm(
  cityId: string,
  stationId: string,
  kind: string,
): ReportFormState {
  return {
    cityId: cityId || "mashhad",
    stationId,
    kind: reportKinds.includes(kind as ReportKind)
      ? (kind as ReportKind)
      : "other",
    step: 1,
    trainProfileId: "",
    directionId: "",
    exitId: "up-escalator",
    car: null,
    amenities: [{ id: 0, amenity: "", value: "" }],
    status: "",
    statusLineId: "",
    subject: "",
    details: "",
    source: "",
    photo: "",
    photoName: "",
    contactMode: "anonymous",
    name: "",
    contact: "",
    publicName: "",
  };
}
export function parseReportDraft(
  value: string | null,
  now = Date.now(),
): SavedReportDraft | null {
  if (!value || value.length > 760000) return null;
  try {
    const saved = JSON.parse(value);
    if (
      saved.version !== 1 ||
      !Number.isFinite(saved.savedAt) ||
      saved.savedAt > now + 60000 ||
      now - saved.savedAt > DRAFT_TTL
    )
      return null;
    const f = saved.form;
    if (
      !f ||
      !reportKinds.includes(f.kind) ||
      ![1, 2, 3].includes(f.step) ||
      !["anonymous", "contact", "credit"].includes(f.contactMode)
    )
      return null;
    const limits: Record<string, number> = {
      cityId: 80,
      stationId: 160,
      trainProfileId: 120,
      directionId: 350,
      exitId: 100,
      status: 40,
      statusLineId: 100,
      subject: 160,
      details: 3600,
      source: 500,
      photo: 699052,
      photoName: 180,
      name: 80,
      contact: 200,
      publicName: 80,
    };
    for (const [key, max] of Object.entries(limits))
      if (typeof f[key] !== "string" || f[key].length > max) return null;
    if (f.photo && !/^[A-Za-z0-9+/]+={0,2}$/.test(f.photo)) return null;
    if (f.car !== null && (!Number.isInteger(f.car) || f.car < 1 || f.car > 14))
      return null;
    if (
      !Array.isArray(f.amenities) ||
      f.amenities.length < 1 ||
      f.amenities.length > 10 ||
      new Set(f.amenities.map((r: AmenityRow) => r.id)).size !==
        f.amenities.length
    )
      return null;
    for (const row of f.amenities)
      if (
        !Number.isSafeInteger(row.id) ||
        row.id < 0 ||
        (row.amenity !== "" && !amenityKeys.includes(row.amenity)) ||
        !["", "true", "false", "null"].includes(row.value)
      )
        return null;
    const retry =
      saved.retry &&
      /^[a-f0-9]{64}$/.test(saved.retry.fingerprint) &&
      /^[a-f0-9-]{36}$/.test(saved.retry.id)
        ? saved.retry
        : undefined;
    return {
      version: 1,
      savedAt: saved.savedAt,
      form: f,
      ...(retry ? { retry } : {}),
    };
  } catch {
    return null;
  }
}
export function saveReportDraft(
  storage: Pick<Storage, "setItem">,
  form: ReportFormState,
  retry?: SavedReportDraft["retry"],
): boolean {
  try {
    storage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        form,
        ...(retry ? { retry } : {}),
      }),
    );
    return true;
  } catch {
    return false;
  }
}
