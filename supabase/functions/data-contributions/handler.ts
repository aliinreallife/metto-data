type Photo = { mimeType: "image/jpeg"; data: string };
type Submission = {
  id: string;
  city: string;
  kind: string;
  station: string;
  details: string;
  name: string;
  contact: string;
  photo?: Photo;
};
type Stored = {
  id: string;
  input_hash: string;
  status: string;
  issue_url: string | null;
};
export type IntakeConfig = {
  supabaseUrl: string;
  serviceKey: string;
  githubToken: string;
  githubRepository: string;
  allowedOrigins: string[];
};
type Dependencies = { fetch?: typeof fetch; randomId?: () => string };
const MAX_BODY = 740_000;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cities: Record<string, string> = {
  mashhad: "Mashhad / مشهد",
  tehran: "Tehran / تهران",
  other: "Other city / شهر دیگر",
};
const kinds: Record<string, string> = {
  timetable: "Train times",
  amenities: "Station amenities",
  station: "Station information",
  other: "Information",
};
function parse(value: unknown): Submission | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const x = value as Record<string, unknown>;
  const text = (key: string, max: number) =>
    x[key] === undefined
      ? ""
      : typeof x[key] === "string" && x[key].length <= max
        ? x[key].trim()
        : null;
  const id = text("id", 36),
    city = text("city", 16),
    kind = text("kind", 16),
    station = text("station", 160),
    details = text("details", 4000),
    name = text("name", 80),
    contact = text("contact", 200);
  if (
    !id ||
    !UUID.test(id) ||
    !city ||
    !Object.hasOwn(cities, city) ||
    !kind ||
    !Object.hasOwn(kinds, kind) ||
    station === null ||
    details === null ||
    name === null ||
    contact === null
  )
    return null;
  let photo: Photo | undefined;
  if (x.photo !== undefined) {
    if (!x.photo || typeof x.photo !== "object" || Array.isArray(x.photo))
      return null;
    const p = x.photo as Record<string, unknown>;
    if (
      p.mimeType !== "image/jpeg" ||
      typeof p.data !== "string" ||
      p.data.length > 699052 ||
      !p.data.length ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(p.data)
    )
      return null;
    try {
      const data = atob(p.data);
      if (
        data.length > 524288 ||
        data.length < 4 ||
        data.charCodeAt(0) !== 255 ||
        data.charCodeAt(1) !== 216 ||
        data.charCodeAt(data.length - 2) !== 255 ||
        data.charCodeAt(data.length - 1) !== 217
      )
        return null;
    } catch {
      return null;
    }
    photo = { mimeType: "image/jpeg", data: p.data };
  }
  return details || photo
    ? {
        id,
        city,
        kind,
        station,
        details,
        name,
        contact,
        ...(photo ? { photo } : {}),
      }
    : null;
}
function code(text: string) {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => `    ${line}`)
    .join("\n");
}
export function publicIssueBody(
  s: Pick<Submission, "id" | "city" | "kind" | "station" | "details">,
  photoUrl?: string,
) {
  return [
    `Community data report · ${cities[s.city]}`,
    "",
    `Type: ${kinds[s.kind]}`,
    "",
    "Line / station:",
    code(s.station || "Not specified"),
    "",
    "Information supplied by a rider (unverified):",
    code(s.details || "See the attached photo."),
    "",
    ...(photoUrl ? [`![Station evidence](${photoUrl})`, ""] : []),
    "This is source material for review, not an approved dataset edit.",
    `Submission reference: ${s.id}`,
  ].join("\n");
}
async function digest(text: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function boundedJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("invalid");
  let length = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY) {
      await reader.cancel();
      throw Error("large");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(all));
}
export function createIntakeHandler(
  config: IntakeConfig,
  deps: Dependencies = {},
) {
  const send = deps.fetch ?? fetch;
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin") ?? "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    const respond = (status: number, body: unknown) =>
      new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers,
      });
    if (!config.allowedOrigins.includes(origin))
      return respond(403, { error: "origin" });
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "content-type";
    if (request.method === "OPTIONS") return respond(204, null);
    if (request.method !== "POST") return respond(405, { error: "method" });
    if (
      !config.supabaseUrl ||
      !config.serviceKey ||
      !config.githubToken ||
      !/^[\w.-]+\/[\w.-]+$/.test(config.githubRepository)
    )
      return respond(503, { error: "unavailable" });
    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      return respond(415, { error: "content_type" });
    let raw: unknown;
    try {
      raw = await boundedJson(request);
    } catch (error) {
      return respond(
        error instanceof Error && error.message === "large" ? 413 : 400,
        { error: "invalid" },
      );
    }
    if (raw && typeof raw === "object" && "website" in raw && raw.website)
      return respond(201, {
        id: deps.randomId ? deps.randomId() : crypto.randomUUID(),
      });
    const submission = parse(raw);
    if (!submission) return respond(400, { error: "invalid" });
    const { id, photo, ...fields } = submission;
    const inputHash = await digest(JSON.stringify(submission));
    const apiHeaders = {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      "Content-Type": "application/json",
    };
    const base = config.supabaseUrl.replace(/\/$/, "");
    const rest = async (path: string, init: RequestInit = {}) => {
      const response = await send(`${base}/rest/v1/${path}`, {
        ...init,
        signal: AbortSignal.timeout(10000),
        headers: { ...apiHeaders, ...init.headers },
      });
      if (!response.ok) throw Error("store");
      return response;
    };
    let stored = false;
    let uploadedPath: string | null = null;
    const cleanupPhoto = async () => {
      if (uploadedPath) {
        try {
          await send(`${base}/storage/v1/object/contribution-evidence`, {
            method: "DELETE",
            headers: apiHeaders,
            body: JSON.stringify({ prefixes: [uploadedPath] }),
          });
        } catch {
          /* Reconcile unreferenced objects during maintenance. */
        }
      }
    };
    try {
      const existing = (await (
        await rest(
          `data_submissions?id=eq.${id}&select=id,input_hash,status,issue_url`,
        )
      ).json()) as Stored[];
      if (existing[0])
        return existing[0].input_hash === inputHash
          ? respond(200, { id, issueUrl: existing[0].issue_url })
          : respond(409, { error: "changed" });
      const ip = (
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        "unknown"
      )
        .split(",")[0]
        .trim();
      const hmac = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(config.serviceKey),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const ipKey = [
        ...new Uint8Array(
          await crypto.subtle.sign("HMAC", hmac, new TextEncoder().encode(ip)),
        ),
      ]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const allowed = await (
        await rest("rpc/reserve_data_intake", {
          method: "POST",
          body: JSON.stringify({ p_key: ipKey }),
        })
      ).json();
      if (allowed !== true) return respond(429, { error: "rate_limit" });
      const path = photo ? `${id}/${crypto.randomUUID()}.jpg` : null;
      if (photo) {
        const upload = await send(
          `${base}/storage/v1/object/contribution-evidence/${path}`,
          {
            method: "POST",
            headers: {
              apikey: config.serviceKey,
              Authorization: `Bearer ${config.serviceKey}`,
              "Content-Type": "image/jpeg",
              "x-upsert": "false",
            },
            body: Uint8Array.from(atob(photo.data), (c) => c.charCodeAt(0)),
          },
        );
        if (!upload.ok) throw Error("photo_store");
        uploadedPath = path;
      }
      const inserted = await rest("data_submissions?on_conflict=id", {
        method: "POST",
        headers: {
          Prefer: "resolution=ignore-duplicates,return=representation",
        },
        body: JSON.stringify({
          id,
          input_hash: inputHash,
          city: fields.city,
          kind: fields.kind,
          station: fields.station,
          details: fields.details,
          contact_name: fields.name,
          contact_details: fields.contact,
          photo_path: path,
        }),
      });
      const rows = (await inserted.json()) as { id: string }[];
      if (!rows.length) {
        await cleanupPhoto();
        const winner = (await (
          await rest(
            `data_submissions?id=eq.${id}&select=id,input_hash,status,issue_url`,
          )
        ).json()) as Stored[];
        return winner[0]?.input_hash === inputHash
          ? respond(200, { id, issueUrl: winner[0].issue_url })
          : respond(409, { error: "changed" });
      }
      stored = true;
      const claimed = (await (
        await rest(`data_submissions?id=eq.${id}&status=eq.pending`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ status: "publishing" }),
        })
      ).json()) as { id: string }[];
      if (!claimed.length) return respond(202, { id });
      const photoUrl = path
        ? `${base}/storage/v1/object/public/contribution-evidence/${path}`
        : undefined;
      let issue: Response;
      try {
        issue = await send(
          `https://api.github.com/repos/${config.githubRepository}/issues`,
          {
            method: "POST",
            signal: AbortSignal.timeout(10000),
            headers: {
              Authorization: `Bearer ${config.githubToken}`,
              Accept: "application/vnd.github+json",
              "Content-Type": "application/json",
              "X-GitHub-Api-Version": "2022-11-28",
              "User-Agent": "metto-data-contributions",
            },
            body: JSON.stringify({
              title: `[${fields.city}] ${kinds[fields.kind]}${fields.station ? ` · ${fields.station.replace(/[\r\n@]/g, " ")}` : ""}`,
              body: publicIssueBody(submission, photoUrl),
            }),
          },
        );
      } catch {
        return respond(202, { id });
      } // Ambiguous upstream result: do not retry into duplicate public issues.
      if (!issue.ok) {
        await rest(`data_submissions?id=eq.${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "pending" }),
        });
        return respond(202, { id });
      }
      const result = (await issue.json()) as { html_url?: string };
      if (
        !result.html_url?.startsWith(
          `https://github.com/${config.githubRepository}/issues/`,
        )
      )
        return respond(202, { id });
      await rest(`data_submissions?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "published",
          issue_url: result.html_url,
        }),
      });
      return respond(201, { id, issueUrl: result.html_url });
    } catch {
      if (stored) return respond(202, { id });
      // An insert response may have been lost after a successful commit. Check
      // before deleting evidence; never remove a potentially referenced photo.
      try {
        const existing = (await (
          await rest(
            `data_submissions?id=eq.${id}&select=id,input_hash,status,issue_url`,
          )
        ).json()) as Stored[];
        if (existing[0]?.input_hash === inputHash)
          return respond(200, { id, issueUrl: existing[0].issue_url });
        await cleanupPhoto();
      } catch {
        /* Storage unavailable: retain evidence for reconciliation. */
      }
      return respond(503, { error: "unavailable" });
    }
  };
}
