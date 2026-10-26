import type { IntakeConfig, StoredReport } from "./intake.ts";
import { REPOSITORY, UUID } from "./intake.ts";
import {
  automaticPlan,
  communityPath,
  type CommunityState,
} from "./community.ts";
export async function prepareCommunityReview(
  config: IntakeConfig,
  issueNumber: number,
  actor: string,
  action: "prepare" | "applied" | "manual" | "rejected",
  commit?: string,
) {
  if (actor !== "aliinreallife") throw Error("owner_required");
  const response = await (config.fetch ?? fetch)(
    "https://api.github.com/repos/" + REPOSITORY + "/issues/" + issueNumber,
    {
      headers: {
        Authorization: "Bearer " + config.githubToken,
        Accept: "application/vnd.github+json",
      },
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!response.ok) throw Error("issue_unavailable");
  const issue = (await response.json()) as {
    body?: string;
    labels?: { name: string }[];
    pull_request?: unknown;
    html_url?: string;
  };
  if (
    issue.pull_request ||
    (action === "rejected"
      ? !issue.labels?.some((l) => l.name === "data:rejected") ||
        issue.labels.some((l) => l.name === "data:accepted")
      : !issue.labels?.some((l) => l.name === "data:accepted") ||
        issue.labels.some((l) => l.name === "data:rejected"))
  )
    throw Error("owner_approval_required");
  const matches = [
      ...(issue.body ?? "").matchAll(
        /<!-- metto-data-report:([A-Za-z0-9+/=]+) -->/g,
      ),
    ],
    last = matches.at(-1);
  const metadata = last
    ? JSON.parse(Buffer.from(last[1], "base64").toString("utf8"))
    : null;
  const id = metadata?.id;
  if (typeof id !== "string" || !UUID.test(id)) throw Error("invalid_report");
  const saved = await config.store.read<StoredReport>(
    "submissions/" + id + ".json",
  );
  const expected =
    "https://github.com/" + REPOSITORY + "/issues/" + issueNumber;
  if (
    !saved ||
    saved.value.state !== "published" ||
    saved.value.issueUrl !== expected ||
    issue.html_url !== expected
  )
    throw Error("report_mismatch");
  const plan = automaticPlan(saved.value.report);
  let approvedAt = "";
  for (let i = 0; i < 8; i++) {
    const old = await config.store.read<CommunityState>(communityPath(id)),
      current = old?.value ?? { votes: {} };
    approvedAt = current.approvedAt ?? new Date().toISOString();
    const decision =
      current.decision === "applied"
        ? "applied"
        : action === "rejected"
          ? "rejected"
          : action === "manual" || !plan.operations.length
            ? "manual"
            : action === "applied"
              ? "applied"
              : "approved";
    if (action === "applied" && (!commit || !/^[a-f0-9]{40}$/.test(commit)))
      throw Error("commit_required");
    if (
      await config.store.write(
        communityPath(id),
        {
          ...current,
          decision,
          approvedAt,
          ...(action === "applied" ? { commit } : {}),
        },
        old?.etag ?? null,
      )
    )
      break;
    if (i === 7) throw Error("busy");
  }
  const report = saved.value.report;
  const document =
    action !== "rejected" && plan.operations.length
      ? {
          id,
          city: report.cityId,
          entityType: "station",
          entityId: report.stationId,
          changeType: "update",
          operations: plan.operations.map((operation) => ({
            ...operation,
            evidence: expected,
            note: "تأیید مدیر پس از بررسی گزارش مسافر",
          })),
          submittedBy: report.credit
            ? "metto:" + report.credit.id
            : "anonymous",
          submittedAt: saved.value.createdAt,
          status: "approved",
          review: {
            decidedBy: actor,
            decidedAt: approvedAt,
            reason: "تأیید مدیر در " + expected,
          },
        }
      : null;
  return {
    id,
    issueNumber,
    document,
    manual: plan.manual,
    manualReason: plan.manualReason,
    automatic: plan.operations.length,
  };
}
