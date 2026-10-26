import { REPOSITORY, UUID } from "./intake.ts";
import { verifyCredit } from "./credit.ts";
import type { Names } from "./catalog.js";
import community from "../../../data/reference/community-contributions.json" with { type: "json" };
export type PublicReport = {
  id: number | string;
  reportId?: string;
  title: string;
  names?: Names;
  url: string;
  state: "open" | "closed";
  createdAt: string;
  verified: boolean;
  contributorName?: string;
};
/** Real, reviewed historical corrections; no invented users, votes or scores. */
export const reviewedReports: PublicReport[] = community.entries.map(
  (entry) => ({
    id: entry.id,
    title: entry.names.fa,
    names: entry.names,
    url: entry.source,
    state: "closed",
    createdAt: entry.verifiedOn,
    verified: true,
    contributorName: entry.author.name,
  }),
);
export async function recentReports(): Promise<{
  reports: PublicReport[];
  unavailable: boolean;
}> {
  try {
    const result = await fetch(
      "https://api.github.com/repos/" +
        REPOSITORY +
        "/issues?state=all&per_page=50",
      {
        headers: {
          Accept: "application/vnd.github+json",
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: "Bearer " + process.env.GITHUB_TOKEN }
            : {}),
        },
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(8000),
      } as RequestInit & { next: { revalidate: number } },
    );
    if (!result.ok) throw Error("unavailable");
    const rows = (await result.json()) as {
      id: number;
      title: string;
      html_url: string;
      state: "open" | "closed";
      created_at: string;
      body?: string;
      labels?: { name: string }[];
      pull_request?: unknown;
    }[];
    const secret =
      process.env.DATA_PORTAL_CREDIT_SECRET ||
      process.env.DATA_PORTAL_QUOTA_SECRET ||
      "";
    const reports: PublicReport[] = [];
    for (const row of rows) {
      if (row.pull_request || !row.body?.includes("<!-- metto-data-report:"))
        continue;
      const reference =
        /Submission reference: ([a-f0-9-]+)/i.exec(row.body)?.[1] ?? "";
      if (
        !UUID.test(reference) ||
        !/^https:\/\/github\.com\/aliinreallife\/metto-data\/issues\/\d+$/.test(
          row.html_url,
        )
      )
        continue;
      let contributorName: string | undefined;
      try {
        const metadata = [
          ...row.body.matchAll(/<!-- metto-data-report:([A-Za-z0-9+/=]+) -->/g),
        ].at(-1);
        const data = metadata
          ? JSON.parse(Buffer.from(metadata[1], "base64").toString("utf8"))
          : null;
        if (
          data?.id === reference &&
          verifyCredit(reference, data.credit, secret)
        )
          contributorName = data.credit.name;
      } catch {}
      reports.push({
        id: row.id,
        reportId: reference,
        title: row.title,
        url: row.html_url,
        state: row.state,
        createdAt: row.created_at,
        verified:
          row.labels?.some((label) => label.name === "data:accepted") ?? false,
        ...(contributorName ? { contributorName } : {}),
      });
    }
    return {
      reports: [...reviewedReports, ...reports.slice(0, 11)],
      unavailable: false,
    };
  } catch {
    return { reports: reviewedReports, unavailable: true };
  }
}
