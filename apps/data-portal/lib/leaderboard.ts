import { verifyCredit } from "./credit.ts";
import { REPOSITORY, UUID } from "./intake.ts";
export type CreditedReport = {
  id: string;
  title: string;
  url: string;
  accepted: boolean;
  createdAt: string;
};
export type Leader = {
  id: string;
  name: string;
  accepted: number;
  reports: CreditedReport[];
};
type Issue = {
  body?: string;
  title?: string;
  html_url?: string;
  created_at?: string;
  labels?: { name: string }[];
};
/** Only a maintainer-applied label counts as acceptance; closing does not. */
export function rankCredits(issues: Issue[], secret: string): Leader[] {
  const people = new Map<string, Leader>(),
    seen = new Map<string, CreditedReport>();
  for (const issue of issues) {
    const match = /<!-- metto-data-report:([A-Za-z0-9+/=]+) -->/.exec(
      issue.body ?? "",
    );
    if (!match) continue;
    try {
      const data = JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
      if (!UUID.test(data.id) || !verifyCredit(data.id, data.credit, secret))
        continue;
      const accepted =
        issue.labels?.some((label) => label.name === "data:accepted") ?? false;
      if (seen.has(data.id)) {
        const old = seen.get(data.id)!;
        old.accepted ||= accepted;
        continue;
      }
      const url = issue.html_url ?? "";
      if (
        !/^https:\/\/github\.com\/aliinreallife\/metto-data\/issues\/\d+$/.test(
          url,
        )
      )
        continue;
      const report = {
        id: data.id,
        title: issue.title ?? "",
        url,
        accepted,
        createdAt: issue.created_at ?? "",
      };
      seen.set(data.id, report);
      const person: Leader = people.get(data.credit.id) ?? {
        id: data.credit.id,
        name: data.credit.name,
        accepted: 0,
        reports: [],
      };
      person.name = data.credit.name;
      person.reports.push(report);
      people.set(person.id, person);
    } catch {
      /* Public text is untrusted; forged or malformed identity is ignored. */
    }
  }
  for (const person of people.values())
    person.accepted = person.reports.filter((report) => report.accepted).length;
  return [...people.values()].sort(
    (a, b) => b.accepted - a.accepted || a.id.localeCompare(b.id),
  );
}
export async function leaderboard(): Promise<{
  leaders: Leader[];
  unavailable: boolean;
  partial: boolean;
}> {
  const secret =
    process.env.DATA_PORTAL_CREDIT_SECRET ||
    process.env.DATA_PORTAL_QUOTA_SECRET;
  if (!secret) return { leaders: [], unavailable: false, partial: false };
  try {
    const issues: Issue[] = [];
    let partial = false;
    for (let page = 1; page <= 10; page++) {
      const options: RequestInit & { next: { revalidate: number } } = {
        headers: {
          Accept: "application/vnd.github+json",
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(8000),
      };
      const response = await fetch(
        `https://api.github.com/repos/${REPOSITORY}/issues?state=all&sort=created&direction=asc&per_page=100&page=${page}`,
        options,
      );
      if (!response.ok) throw Error("unavailable");
      const rows = (await response.json()) as (Issue & {
        pull_request?: unknown;
      })[];
      issues.push(...rows.filter((row) => !row.pull_request));
      if (!response.headers.get("link")?.includes('rel="next"')) break;
      if (page === 10) partial = true;
    }
    return {
      leaders: rankCredits(issues, secret),
      unavailable: false,
      partial,
    };
  } catch {
    return { leaders: [], unavailable: true, partial: false };
  }
}
