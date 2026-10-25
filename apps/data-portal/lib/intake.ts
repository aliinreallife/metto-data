import { createHash, createHmac, randomUUID } from "node:crypto";
import { makeCredit, validPublicName, type PublicCredit } from "./credit.ts";
import { sanitizePhoto } from "./photo-server.ts";
export const REPOSITORY = "aliinreallife/metto-data";
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const kinds = [
  "timetable",
  "facility",
  "status",
  "location",
  "wagon",
  "other",
  "city_request",
] as const;
const cityLabels: Record<string, string> = {
  tehran: "Tehran / تهران",
  mashhad: "Mashhad / مشهد",
  other: "Another city / شهر دیگر",
};
const kindLabels: Record<(typeof kinds)[number], string> = {
  timetable: "Train times / زمان حرکت",
  facility: "Station amenities / امکانات ایستگاه",
  status: "Station status / وضعیت ایستگاه",
  location: "Station location / مکان ایستگاه",
  wagon: "Escalator car / واگن نزدیک پله‌برقی",
  other: "Information / اطلاعات",
  city_request: "City or line request / درخواست شهر یا خط",
};
export type Report = {
  id: string;
  cityId: string;
  stationId: string;
  kind: (typeof kinds)[number];
  subject: string;
  details: string;
  source: string;
  name: string;
  contact: string;
  photo?: string;
  credit?: PublicCredit;
};
export type StoredReport = {
  report: Report;
  inputHash: string;
  createdAt: string;
  state: "pending" | "publishing" | "published";
  issueUrl?: string;
};
export interface PrivateStore {
  read<T>(path: string): Promise<{ value: T; etag: string } | null>;
  write(
    path: string,
    value: unknown,
    expected: string | null,
  ): Promise<boolean>;
  remove(path: string, expected: string): Promise<boolean>;
  paths(
    prefix: string,
    cursor?: string,
  ): Promise<{ paths: string[]; cursor?: string }>;
  cleanup?(): Promise<number>;
  canStorePhoto?(bytes: number): Promise<boolean>;
}
export type IntakeConfig = {
  store: PrivateStore;
  githubToken: string;
  quotaSecret?: string;
  creditSecret?: string;
  publicOrigin: string;
  cityStations: Record<string, string[]>;
  fetch?: typeof fetch;
  now?: () => Date;
  resolveContributor?: () => Promise<{ id: string; name: string } | null>;
  contributor?: { id: string; name: string };
};
const reportPath = (id: string) => `submissions/${id}.json`;
function parse(raw: unknown, config: IntakeConfig): Report | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  if (data.publicCredit !== undefined && typeof data.publicCredit !== "boolean")
    return null;
  if (
    data.publicCredit === true &&
    (!config.contributor || !validPublicName(data.publicName))
  )
    return null;
  const text = (key: string, max: number) =>
    data[key] === undefined
      ? ""
      : typeof data[key] === "string" && data[key].length <= max
        ? data[key].trim()
        : null;
  const id = text("id", 36),
    cityId = text("cityId", 20),
    stationId = text("stationId", 160),
    kind = text("kind", 20),
    subject = text("subject", 160),
    details = text("details", 4000),
    source = text("source", 500),
    name = text("name", 80),
    contact = text("contact", 200);
  if (
    !id ||
    !UUID.test(id) ||
    !cityId ||
    !Object.hasOwn(config.cityStations, cityId) ||
    stationId === null ||
    (stationId && !config.cityStations[cityId].includes(stationId)) ||
    !kinds.includes(kind as Report["kind"]) ||
    subject === null ||
    details === null ||
    source === null ||
    name === null ||
    contact === null
  )
    return null;
  if (source) {
    try {
      const url = new URL(source);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        return null;
    } catch {
      return null;
    }
  }
  let photo: string | undefined;
  if (data.photo !== undefined) {
    if (
      typeof data.photo !== "string" ||
      data.photo.length > 699052 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(data.photo)
    )
      return null;
    const bytes = Buffer.from(data.photo, "base64");
    if (
      bytes.length > 524288 ||
      bytes.length < 4 ||
      bytes[0] !== 255 ||
      bytes[1] !== 216 ||
      bytes.at(-2) !== 255 ||
      bytes.at(-1) !== 217
    )
      return null;
    photo = data.photo;
  }
  return details || photo
    ? {
        id,
        cityId,
        stationId,
        kind: kind as Report["kind"],
        subject,
        details,
        source,
        name,
        contact,
        ...(photo ? { photo } : {}),
        ...(data.publicCredit === true &&
        config.contributor &&
        (config.creditSecret || config.quotaSecret)
          ? {
              credit: makeCredit(
                id,
                {
                  id: config.contributor.id,
                  name: String(data.publicName).trim(),
                },
                (config.creditSecret || config.quotaSecret)!,
              ),
            }
          : {}),
      }
    : null;
}
function literal(text: string) {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => `    ${line}`)
    .join("\n");
}
export function publicBody(report: Report, origin: string) {
  const metadata = Buffer.from(
    JSON.stringify({
      id: report.id,
      cityId: report.cityId,
      stationId: report.stationId,
      kind: report.kind,
      ...(report.credit ? { credit: report.credit } : {}),
    }),
  ).toString("base64");
  return [
    "Rider source report (unverified)",
    "",
    `City: ${report.cityId}`,
    `Type: ${report.kind}`,
    "",
    "Station ID:",
    literal(report.stationId || "Not specified"),
    "",
    "Line / direction / subject:",
    literal(report.subject || "Not specified"),
    "",
    "Information:",
    literal(report.details || "See the photo."),
    "",
    "Source:",
    literal(report.source || "Not specified"),
    "",
    ...(report.photo
      ? [`![Station evidence](${origin}/api/evidence/${report.id})`, ""]
      : []),
    ...(report.credit
      ? [
          "Contributor (public credit by choice):",
          literal(report.credit.name),
          "",
        ]
      : []),
    "Maintainer review is required before changing canonical data.",
    `Submission reference: ${report.id}`,
    `<!-- metto-data-report:${metadata} -->`,
  ].join("\n");
}
async function jsonBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("invalid");
  let length = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 740000) {
      await reader.cancel();
      throw Error("large");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
type Limits = {
  total: number;
  clients: Record<string, { total: number; hour: string; hourHits: number }>;
};
export async function reserveQuota(
  config: IntakeConfig,
  ip: string,
): Promise<boolean> {
  const now = (config.now?.() ?? new Date()).toISOString(),
    day = now.slice(0, 10),
    hour = now.slice(0, 13);
  const key = createHmac("sha256", config.quotaSecret ?? config.githubToken)
      .update(ip)
      .digest("hex"),
    path = `limits/${day}.json`;
  for (let attempt = 0; attempt < 12; attempt++) {
    const previous = await config.store.read<Limits>(path);
    const value = previous?.value ?? { total: 0, clients: {} };
    const client = value.clients[key] ?? { total: 0, hour, hourHits: 0 };
    if (
      value.total >= 100 ||
      client.total >= 10 ||
      (client.hour === hour && client.hourHits >= 4)
    )
      return false;
    const next: Limits = {
      total: value.total + 1,
      clients: {
        ...value.clients,
        [key]: {
          total: client.total + 1,
          hour,
          hourHits: client.hour === hour ? client.hourHits + 1 : 1,
        },
      },
    };
    if (await config.store.write(path, next, previous?.etag ?? null))
      return true;
  }
  throw Error("busy");
}
export async function publish(
  config: IntakeConfig,
  id: string,
): Promise<StoredReport | null> {
  const path = reportPath(id),
    saved = await config.store.read<StoredReport>(path);
  if (!saved) return null;
  if (saved.value.state !== "pending") return saved.value;
  const publishing: StoredReport = { ...saved.value, state: "publishing" };
  if (!(await config.store.write(path, publishing, saved.etag)))
    return (await config.store.read<StoredReport>(path))?.value ?? saved.value;
  const claimed = await config.store.read<StoredReport>(path);
  if (!claimed) return publishing;
  let response: Response;
  try {
    response = await (config.fetch ?? fetch)(
      `https://api.github.com/repos/${REPOSITORY}/issues`,
      {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${config.githubToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "metto-data-portal",
        },
        body: JSON.stringify({
          title: `${kindLabels[publishing.report.kind]} · ${cityLabels[publishing.report.cityId] ?? publishing.report.cityId}${publishing.report.subject ? ` · ${publishing.report.subject.replace(/[\r\n@]/g, " ")}` : ""}`,
          body: publicBody(publishing.report, config.publicOrigin),
        }),
      },
    );
  } catch {
    return publishing;
  } // An ambiguous result must never create a duplicate issue.
  if (!response.ok) {
    // 5xx can be a lost successful write. Only explicit client errors are retryable.
    if (response.status >= 400 && response.status < 500) {
      const pending: StoredReport = { ...publishing, state: "pending" };
      await config.store.write(path, pending, claimed.etag);
      return pending;
    }
    return publishing;
  }
  const result = (await response.json()) as { html_url?: string };
  if (
    !result.html_url ||
    !new RegExp(`^https://github\\.com/${REPOSITORY}/issues/\\d+$`).test(
      result.html_url,
    )
  )
    return publishing;
  const published: StoredReport = {
    ...publishing,
    state: "published",
    issueUrl: result.html_url,
  };
  if (await config.store.write(path, published, claimed.etag)) {
    const marker = await config.store.read(`outbox/${id}.json`);
    if (marker) await config.store.remove(`outbox/${id}.json`, marker.etag);
  }
  return published;
}
export function createIntakeHandler(config: IntakeConfig) {
  return async (request: Request): Promise<Response> => {
    const reply = (status: number, value: unknown) =>
      Response.json(value, {
        status,
        headers: { "Cache-Control": "no-store" },
      });
    if (request.method !== "POST") return reply(405, { error: "method" });
    if (request.headers.get("origin") !== config.publicOrigin)
      return reply(403, { error: "origin" });
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return reply(415, { error: "content_type" });
    let raw: unknown;
    try {
      raw = await jsonBody(request);
    } catch (error) {
      return reply(
        error instanceof Error && error.message === "large" ? 413 : 400,
        { error: "invalid" },
      );
    }
    if (raw && typeof raw === "object" && "website" in raw && raw.website)
      return reply(201, { id: randomUUID() });
    if (
      raw &&
      typeof raw === "object" &&
      (raw as Record<string, unknown>).publicCredit === true
    ) {
      let contributor;
      try {
        contributor = await config.resolveContributor?.();
      } catch {
        return reply(503, { error: "busy" });
      }
      if (!contributor) return reply(401, { error: "login_required" });
      raw = { ...raw, publicCredit: true };
      const verifiedConfig = { ...config, contributor };
      return acceptReport(raw, verifiedConfig, request);
    }
    return acceptReport(raw, config, request);
  };
}
async function acceptReport(
  raw: unknown,
  config: IntakeConfig,
  request: Request,
): Promise<Response> {
  const reply = (status: number, value: unknown) =>
    Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
  const report = parse(raw, config);
  if (!report) return reply(400, { error: "invalid" });
  const inputHash = createHash("sha256")
    .update(JSON.stringify(report))
    .digest("hex");
  const path = reportPath(report.id);
  let durable = false;
  try {
    const previous = await config.store.read<StoredReport>(path);
    if (previous)
      return previous.value.inputHash === inputHash
        ? reply(200, {
            id: report.id,
            ...(report.credit ? { creditId: report.credit.id } : {}),
            issueUrl: previous.value.issueUrl,
          })
        : reply(409, { error: "changed" });
    if (report.photo) {
      if (
        config.store.canStorePhoto &&
        !(await config.store.canStorePhoto(report.photo.length))
      )
        return reply(503, { error: "photo_capacity" });
    }
    const ip = (
      request.headers.get("x-vercel-forwarded-for") ??
      request.headers.get("x-forwarded-for") ??
      "unknown"
    )
      .split(",")[0]
      .trim();
    if (!(await reserveQuota(config, ip)))
      return reply(429, { error: "rate_limit" });
    // Charge the shared quota before image decoding, including malformed
    // files, so repeated failed decodes cannot bypass the processing limit.
    if (report.photo) {
      try {
        report.photo = await sanitizePhoto(report.photo);
      } catch {
        return reply(400, { error: "invalid_photo" });
      }
    }
    const saved: StoredReport = {
      report,
      inputHash,
      createdAt: (config.now?.() ?? new Date()).toISOString(),
      state: "pending",
    };
    await config.store.write(
      `outbox/${report.id}.json`,
      {
        id: report.id,
        ...(report.credit ? { creditId: report.credit.id } : {}),
      },
      null,
    );
    if (!(await config.store.write(path, saved, null))) {
      const winner = await config.store.read<StoredReport>(path);
      return winner?.value.inputHash === inputHash
        ? reply(200, {
            id: report.id,
            ...(report.credit ? { creditId: report.credit.id } : {}),
            issueUrl: winner.value.issueUrl,
          })
        : reply(409, { error: "changed" });
    }
    durable = true;
    if (!config.githubToken)
      return reply(202, {
        id: report.id,
        ...(report.credit ? { creditId: report.credit.id } : {}),
      });
    const result = await publish(config, report.id);
    return reply(result?.state === "published" ? 201 : 202, {
      id: report.id,
      ...(report.credit ? { creditId: report.credit.id } : {}),
      issueUrl: result?.issueUrl,
    });
  } catch {
    if (durable)
      return reply(202, {
        id: report.id,
        ...(report.credit ? { creditId: report.credit.id } : {}),
      });
    // A lost storage response may follow a successful write. Confirm it first.
    try {
      const saved = await config.store.read<StoredReport>(path);
      if (saved?.value.inputHash === inputHash)
        return reply(202, {
          id: report.id,
          ...(report.credit ? { creditId: report.credit.id } : {}),
          issueUrl: saved.value.issueUrl,
        });
    } catch {
      /* Leave the visitor's form intact. */
    }
    return reply(503, { error: "unavailable" });
  }
}

export async function evidence(
  config: IntakeConfig,
  id: string,
): Promise<Response> {
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  const saved = await config.store.read<StoredReport>(reportPath(id));
  if (!saved?.value.report.photo || saved.value.state !== "published")
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  return new Response(Buffer.from(saved.value.report.photo, "base64"), {
    headers: {
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
