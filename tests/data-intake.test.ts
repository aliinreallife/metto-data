import { describe, expect, it } from "vitest";
import {
  createIntakeHandler,
  publicIssueBody,
  type IntakeConfig,
} from "../supabase/functions/data-contributions/handler.ts";
const ID = "12345678-1234-4123-8123-123456789abc";
const config: IntakeConfig = {
  supabaseUrl: "https://example.supabase.co",
  serviceKey: "private-service-key",
  githubToken: "private-issue-token",
  githubRepository: "aliinreallife/metto-data",
  allowedOrigins: ["https://aliinreallife.github.io"],
};
const payload = {
  id: ID,
  city: "mashhad",
  kind: "timetable",
  station: "Line 1",
  details: "Weekday times, source photograph checked today",
  name: "",
  contact: "",
  website: "",
};
function request(body: unknown = payload, origin = config.allowedOrigins[0]) {
  return new Request(
    "https://example.supabase.co/functions/v1/data-contributions",
    {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
      body: JSON.stringify(body),
    },
  );
}
function fixture(
  options: {
    existing?: unknown[];
    rate?: boolean;
    githubStatus?: number;
    networkFailure?: boolean;
    storeFailure?: boolean;
    insertConflict?: boolean;
  } = {},
) {
  const calls: { url: string; init: RequestInit; body: any }[] = [];
  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = String(input);
    const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ url, init, body });
    if (url.includes("select=id,input_hash"))
      return Response.json(options.existing ?? []);
    if (url.endsWith("rpc/reserve_data_intake"))
      return Response.json(options.rate ?? true);
    if (url.includes("storage/v1/object/"))
      return Response.json({ Key: "photo" });
    if (url.includes("data_submissions?on_conflict"))
      return options.storeFailure
        ? new Response("", { status: 503 })
        : Response.json(options.insertConflict ? [] : [{ id: ID }]);
    if (url.includes("status=eq.pending")) return Response.json([{ id: ID }]);
    if (url.startsWith("https://api.github.com/")) {
      if (options.networkFailure) throw Error("network");
      return options.githubStatus
        ? new Response("", { status: options.githubStatus })
        : Response.json({
            html_url: `https://github.com/aliinreallife/metto-data/issues/99`,
          });
    }
    return new Response(null, { status: 204 });
  };
  return { calls, handle: createIntakeHandler(config, { fetch: fetcher }) };
}
describe("anonymous source intake", () => {
  it("allows optional fields to be omitted altogether", async () => {
    const f = fixture();
    expect(
      (
        await f.handle(
          request({
            id: ID,
            city: "mashhad",
            kind: "timetable",
            details: "Weekday source",
          }),
        )
      ).status,
    ).toBe(201);
  });
  it("does not make side effects for the spam trap", async () => {
    const f = fixture();
    expect(
      (await f.handle(request({ ...payload, website: "spam" }))).status,
    ).toBe(201);
    expect(f.calls).toHaveLength(0);
  });
  it("acknowledges a repeated request without creating another issue or spending quota", async () => {
    const first = fixture();
    await first.handle(request());
    const inserted = first.calls.find((c) =>
      c.url.includes("on_conflict"),
    )!.body;
    const f = fixture({
      existing: [
        {
          ...inserted,
          status: "published",
          issue_url: "https://github.com/aliinreallife/metto-data/issues/99",
        },
      ],
    });
    const r = await f.handle(request());
    expect(r.status).toBe(200);
    expect(f.calls).toHaveLength(1);
    expect(await r.text()).toContain("issues/99");
  });
  it("rejects a changed payload reusing another submission ID", async () => {
    const f = fixture({
      existing: [
        {
          id: ID,
          input_hash: "different",
          status: "published",
          issue_url: null,
        },
      ],
    });
    expect((await f.handle(request())).status).toBe(409);
    expect(f.calls).toHaveLength(1);
  });
  it("removes its own photo when a database insert definitively failed", async () => {
    const f = fixture({ storeFailure: true });
    const r = await f.handle(
      request({
        ...payload,
        photo: { mimeType: "image/jpeg", data: "/9j/2Q==" },
      }),
    );
    expect(r.status).toBe(503);
    const deletion = f.calls.find((c) => c.init.method === "DELETE")!;
    expect(deletion.body.prefixes[0]).toMatch(new RegExp(`^${ID}/.+\\.jpg$`));
    expect(
      f.calls.some((c) => c.url.startsWith("https://api.github.com/")),
    ).toBe(false);
  });
  it("accepts a rider with no name, contact, login or Authorization header", async () => {
    const f = fixture();
    const r = await f.handle(request());
    expect(r.status).toBe(201);
    expect(((await r.json()) as { id: string }).id).toBe(ID);
    expect(r.headers.get("access-control-allow-origin")).toBe(
      config.allowedOrigins[0],
    );
    const issue = f.calls.find((c) =>
      c.url.startsWith("https://api.github.com/"),
    )!;
    expect(issue.body.body).toContain(payload.details);
    expect(issue.body.title).toContain("mashhad");
    expect(issue.init.headers).toMatchObject({
      Authorization: "Bearer private-issue-token",
    });
  });
  it("keeps optional contact details in private storage and excludes them from GitHub and responses", async () => {
    const f = fixture();
    const r = await f.handle(
      request({
        ...payload,
        name: "Private rider",
        contact: "private@example.org",
      }),
    );
    expect(r.status).toBe(201);
    const stored = f.calls.find((c) => c.url.includes("on_conflict"))!;
    expect(stored.body.contact_name).toBe("Private rider");
    expect(stored.body.contact_details).toBe("private@example.org");
    const issue = f.calls.find((c) =>
      c.url.startsWith("https://api.github.com/"),
    )!;
    expect(JSON.stringify(issue.body)).not.toMatch(
      /Private rider|private@example|private-service-key|private-issue-token/,
    );
    expect(await r.text()).not.toContain("private@example");
  });
  it("keeps contributed markup literal so user text cannot mention GitHub users", () => {
    const body = publicIssueBody({
      ...payload,
      details: "@someone\n```\n<script>hello</script>",
    });
    expect(body).toContain("    @someone\n    ```\n    <script>hello</script>");
  });
  it("accepts a JPEG-only report without text", async () => {
    const f = fixture();
    const r = await f.handle(
      request({
        ...payload,
        details: "",
        photo: { mimeType: "image/jpeg", data: "/9j/2Q==" },
      }),
    );
    expect(r.status).toBe(201);
    expect(
      f.calls.some((c) =>
        c.url.includes("storage/v1/object/contribution-evidence"),
      ),
    ).toBe(true);
    const issue = f.calls.find((c) =>
      c.url.startsWith("https://api.github.com/"),
    )!;
    expect(issue.body.body).toContain(
      "storage/v1/object/public/contribution-evidence",
    );
  });
  it("rejects empty reports, invalid cities, invalid files and oversized payloads before side effects", async () => {
    for (const bad of [
      { ...payload, details: "" },
      { ...payload, city: "__proto__" },
      { ...payload, photo: { mimeType: "image/svg+xml", data: "<svg/>" } },
      { ...payload, photo: { mimeType: "image/jpeg", data: "YWJjZA==" } },
      { ...payload, details: "x".repeat(800000) },
    ]) {
      const f = fixture();
      expect([400, 413]).toContain((await f.handle(request(bad))).status);
      expect(f.calls).toHaveLength(0);
    }
  });
  it("handles allowed-origin preflight without authentication and rejects other origins", async () => {
    const f = fixture();
    const r = await f.handle(
      new Request("https://example.supabase.co", {
        method: "OPTIONS",
        headers: { Origin: config.allowedOrigins[0] },
      }),
    );
    expect(r.status).toBe(204);
    expect(
      (await f.handle(request(payload, "https://unknown.example"))).status,
    ).toBe(403);
    expect(f.calls).toHaveLength(0);
  });
  it("does not send an issue when rate limiting denies the request", async () => {
    const f = fixture({ rate: false });
    expect((await f.handle(request())).status).toBe(429);
    expect(
      f.calls.some((c) => c.url.startsWith("https://api.github.com/")),
    ).toBe(false);
  });
  it("stores only a keyed IP digest in rate limiting", async () => {
    const f = fixture();
    await f.handle(request());
    const call = f.calls.find((c) =>
      c.url.endsWith("rpc/reserve_data_intake"),
    )!;
    expect(call.body.p_key).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(f.calls.map((c) => c.body))).not.toContain(
      "203.0.113.10",
    );
  });
  it("retains a saved report when GitHub is temporarily unavailable", async () => {
    const f = fixture({ githubStatus: 503 });
    const r = await f.handle(request());
    expect(r.status).toBe(202);
    expect(((await r.json()) as { id: string }).id).toBe(ID);
    expect(f.calls.at(-1)?.body).toEqual({ status: "pending" });
  });
  it("does not automatically retry a public issue after an ambiguous network result", async () => {
    const f = fixture({ networkFailure: true });
    expect((await f.handle(request())).status).toBe(202);
    expect(
      f.calls.filter((c) => c.url.startsWith("https://api.github.com/")),
    ).toHaveLength(1);
    expect(f.calls.some((c) => c.body?.status === "pending")).toBe(false);
  });
  it("does not claim success when durable storage fails", async () => {
    const f = fixture({ storeFailure: true });
    expect((await f.handle(request())).status).toBe(503);
    expect(
      f.calls.some((c) => c.url.startsWith("https://api.github.com/")),
    ).toBe(false);
  });
  it("refuses to operate without server credentials", async () => {
    const f = fixture();
    const handle = createIntakeHandler({ ...config, githubToken: "" });
    expect((await handle(request())).status).toBe(503);
    expect(f.calls).toHaveLength(0);
  });
});
