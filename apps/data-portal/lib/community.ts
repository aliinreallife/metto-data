import { profilePath, type MemberProfile } from "./profile.ts";
import { contributorId } from "./credit.ts";
import {
  REPOSITORY,
  UUID,
  type IntakeConfig,
  type StoredReport,
} from "./intake.ts";
import policy from "../../../data/reference/community-policy.json" with { type: "json" };
export type VoteChoice = "confirm" | "deny";
export type CommunityState = {
  votes: Record<string, VoteChoice>;
  queuedAt?: string;
  notifiedAt?: string;
  decision?: "approved" | "rejected" | "applied" | "manual";
  approvedAt?: string;
  commit?: string;
};
export type PublicCommunity = {
  id: string;
  confirm: number;
  deny: number;
  myVote: VoteChoice | null;
  threshold: number;
  queued: boolean;
  notified: boolean;
  decision: CommunityState["decision"] | null;
  report: {
    title: string;
    details: string;
    source: string;
    cityId: string;
    stationId: string;
    issueUrl: string;
    photoUrl?: string;
    contributor?: { id: string; name: string; username?: string };
  };
  automatic: number;
  manual: boolean;
};
export const communityPath = (id: string) => "community/votes/" + id + ".json";
export function automaticPlan(report: StoredReport["report"]) {
  const amenities =
    report.kind === "facility" &&
    policy.automaticFields.includes("station.amenities")
      ? (report.amenities ?? [])
      : [];
  const operations = amenities
    .filter((row) => typeof row.value === "boolean")
    .map((row) => ({
      op: "set" as const,
      path: "/amenities/" + row.key,
      value: row.value,
    }));
  return {
    operations,
    manual:
      report.kind !== "facility" ||
      !operations.length ||
      amenities.some((row) => row.value === null),
    manualReason:
      report.kind !== "facility"
        ? "unsupported-report-type"
        : !operations.length
          ? "no-structured-changes"
          : amenities.some((row) => row.value === null)
            ? "unknown-amenity-values"
            : null,
  };
}
function issueNumber(row: StoredReport) {
  return new RegExp(
    "^https://github\\.com/" + REPOSITORY + "/issues/(\\d+)$",
  ).exec(row.issueUrl ?? "")?.[1];
}
export async function publicCommunity(
  config: IntakeConfig,
  id: string,
  userId?: string,
): Promise<PublicCommunity | null> {
  if (!UUID.test(id)) return null;
  const row = await config.store.read<StoredReport>(
    "submissions/" + id + ".json",
  );
  if (!row || row.value.state !== "published" || !issueNumber(row.value))
    return null;
  const current = (await config.store.read<CommunityState>(communityPath(id)))
    ?.value ?? { votes: {} };
  const values = Object.values(current.votes),
    plan = automaticPlan(row.value.report),
    number = (choice: VoteChoice) => values.filter((v) => v === choice).length;
  const secret = config.creditSecret || config.quotaSecret || "",
    hash = userId && secret ? contributorId(userId, secret) : "";
  const names = config.stationNames?.[row.value.report.stationId];
  const credit = row.value.report.credit;
  const authorProfile = credit
    ? await config.store
        .read<MemberProfile>(profilePath(credit.id))
        .catch(() => null)
    : null;
  return {
    id,
    confirm: number("confirm"),
    deny: number("deny"),
    myVote: current.votes[hash] ?? null,
    threshold: policy.matchingVoteThreshold,
    queued: !!current.queuedAt,
    notified: !!current.notifiedAt,
    decision: current.decision ?? null,
    report: {
      title: names?.fa ?? row.value.report.subject,
      ...(credit
        ? {
            contributor: {
              id: credit.id,
              name: credit.name,
              ...(authorProfile?.value.username
                ? { username: authorProfile.value.username }
                : {}),
            },
          }
        : {}),
      details: row.value.report.details,
      source: row.value.report.source,
      cityId: row.value.report.cityId,
      stationId: row.value.report.stationId,
      issueUrl: row.value.issueUrl!,
      ...(row.value.report.photo
        ? { photoUrl: config.publicOrigin + "/api/evidence/" + id }
        : {}),
    },
    automatic: plan.operations.length,
    manual: plan.manual || current.decision === "manual",
  };
}
async function reserveVote(config: IntakeConfig, userKey: string) {
  const day = new Date().toISOString().slice(0, 10),
    path = "limits/" + day + "/votes-" + userKey + ".json";
  for (let i = 0; i < 8; i++) {
    const old = await config.store.read<{ count: number }>(path),
      count = old?.value.count ?? 0;
    if (count >= policy.dailyVotesPerAccount) return false;
    if (await config.store.write(path, { count: count + 1 }, old?.etag ?? null))
      return true;
  }
  return false;
}
export function createCommunityHandler(
  config: IntakeConfig,
  user: () => Promise<{ id: string; name: string } | null>,
) {
  return async (request: Request) => {
    const reply = (status: number, data: unknown) =>
      Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
    if (request.method !== "GET" && request.method !== "POST")
      return reply(405, { error: "method" });
    if (
      request.method === "POST" &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      return reply(403, { error: "origin" });
    try {
      const actor = await user();
      if (request.method === "GET") {
        const id = new URL(request.url).searchParams.get("report") ?? "";
        const data = await publicCommunity(config, id, actor?.id);
        return data ? reply(200, data) : reply(404, { error: "report" });
      }
      if (!actor) return reply(401, { error: "login" });
      const raw = await request.text();
      if (raw.length > 2048) return reply(400, { error: "vote" });
      let body: { reportId?: string; choice?: unknown };
      try {
        body = JSON.parse(raw);
      } catch {
        return reply(400, { error: "vote" });
      }
      if (
        !body ||
        !UUID.test(body.reportId ?? "") ||
        !["confirm", "deny", null].includes(body.choice as string | null)
      )
        return reply(400, { error: "vote" });
      const id = body.reportId!,
        secret = config.creditSecret || config.quotaSecret;
      if (!secret) return reply(503, { error: "unavailable" });
      const target = await publicCommunity(config, id, actor.id);
      if (!target) return reply(404, { error: "report" });
      if (target.myVote === body.choice) return reply(200, target);
      const hash = contributorId(actor.id, secret);
      if (!(await reserveVote(config, hash)))
        return reply(429, { error: "limited" });
      for (let attempt = 0; attempt < 8; attempt++) {
        const old = await config.store.read<CommunityState>(communityPath(id)),
          current = old?.value ?? { votes: {} };
        if (current.decision) return reply(409, { error: "reviewed" });
        if (
          !current.votes[hash] &&
          Object.keys(current.votes).length >= policy.maxVotersPerReport
        )
          return reply(429, { error: "limited" });
        const votes = { ...current.votes };
        if (body.choice === null) delete votes[hash];
        else votes[hash] = body.choice as VoteChoice;
        const counts = Object.values(votes),
          threshold = ["confirm", "deny"].some(
            (choice) =>
              counts.filter((v) => v === choice).length >=
              policy.matchingVoteThreshold,
          );
        const next: CommunityState = {
          ...current,
          votes,
          ...(threshold && !current.queuedAt
            ? { queuedAt: new Date().toISOString() }
            : {}),
        };
        if (!threshold && !current.notifiedAt) delete next.queuedAt;
        if (
          await config.store.write(communityPath(id), next, old?.etag ?? null)
        )
          return reply(200, await publicCommunity(config, id, actor.id));
      }
      return reply(409, { error: "busy" });
    } catch {
      return reply(503, { error: "unavailable" });
    }
  };
}
export async function notifyCommunityReviews(
  config: IntakeConfig,
  cursor?: string,
) {
  const page = await config.store.paths("community/votes/", cursor);
  let notified = 0;
  for (const path of page.paths) {
    const id = /\/([a-f0-9-]+)\.json$/.exec(path)?.[1];
    if (!id || !UUID.test(id)) continue;
    const row = await config.store.read<CommunityState>(path);
    if (
      !row ||
      !row.value.queuedAt ||
      row.value.notifiedAt ||
      row.value.decision
    )
      continue;
    const values = Object.values(row.value.votes);
    if (
      !["confirm", "deny"].some(
        (choice) =>
          values.filter((v) => v === choice).length >=
          policy.matchingVoteThreshold,
      )
    )
      continue;
    const report = await config.store.read<StoredReport>(
      "submissions/" + id + ".json",
    );
    if (!report || report.value.state !== "published") continue;
    const number = issueNumber(report.value);
    if (!number) continue;
    const headers = {
      Authorization: "Bearer " + config.githubToken,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    };
    const response = await (config.fetch ?? fetch)(
      "https://api.github.com/repos/" +
        REPOSITORY +
        "/issues/" +
        number +
        "/assignees",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ assignees: [policy.maintainer] }),
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!response.ok) continue;
    // Assignment is idempotent, so an ambiguous response cannot duplicate comments.
    if (
      await config.store.write(
        path,
        { ...row.value, notifiedAt: new Date().toISOString() },
        row.etag,
      )
    )
      notified++;
  }
  return { notified, cursor: page.cursor };
}
