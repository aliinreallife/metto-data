import { REPOSITORY, UUID } from "./intake";
export type PublicReport = {
  id: number;
  title: string;
  url: string;
  state: "open" | "closed";
  createdAt: string;
};
export async function recentReports(): Promise<{
  reports: PublicReport[];
  unavailable: boolean;
}> {
  try {
    const result = await fetch(
      `https://api.github.com/repos/${REPOSITORY}/issues?state=all&per_page=50`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!result.ok) throw Error("unavailable");
    const rows = (await result.json()) as {
      id: number;
      title: string;
      html_url: string;
      state: "open" | "closed";
      created_at: string;
      body?: string;
      pull_request?: unknown;
    }[];
    const reports = rows
      .filter(
        (row) =>
          !row.pull_request &&
          row.body?.includes("<!-- metto-data-report:") &&
          UUID.test(
            /Submission reference: ([a-f0-9-]+)/i.exec(row.body)?.[1] ?? "",
          ),
      )
      .slice(0, 12)
      .map((row) => ({
        id: row.id,
        title: row.title,
        url: row.html_url,
        state: row.state,
        createdAt: row.created_at,
      }));
    return { reports, unavailable: false };
  } catch {
    return { reports: [], unavailable: true };
  }
}
