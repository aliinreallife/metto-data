import {
  publish,
  REPOSITORY,
  UUID,
  type IntakeConfig,
  type StoredReport,
} from "./intake.ts";
export async function reconcile(config: IntakeConfig, cursor?: string) {
  const page = await config.store.paths("outbox/", cursor),
    summary = {
      processed: 0,
      published: 0,
      pending: 0,
      needsReview: 0,
      cursor: page.cursor,
    };
  for (const path of page.paths) {
    const id = /^outbox\/([a-f0-9-]+)\.json$/i.exec(path)?.[1];
    if (!id || !UUID.test(id)) continue;
    summary.processed++;
    const saved = await config.store.read<StoredReport>(
      `submissions/${id}.json`,
    );
    if (!saved) {
      summary.needsReview++;
      continue;
    }
    let report = saved.value;
    if (report.state === "pending")
      report = (await publish(config, id)) ?? report;
    if (report.state === "publishing") {
      // Search can reconcile a lost successful response. An empty search never
      // authorizes another POST because indexing can be delayed.
      const query = `repo:${REPOSITORY} in:body "Submission reference: ${id}"`;
      const response = await (config.fetch ?? fetch)(
        `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=10`,
        {
          headers: {
            Authorization: `Bearer ${config.githubToken}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "metto-data-reconcile",
          },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (response.ok) {
        const body = (await response.json()) as {
          items?: { html_url: string; body?: string }[];
        };
        const match = body.items?.find(
          (item) =>
            item.body?.includes(`Submission reference: ${id}`) &&
            new RegExp(`^https://github\\.com/${REPOSITORY}/issues/\\d+$`).test(
              item.html_url,
            ),
        );
        if (match) {
          const current = await config.store.read<StoredReport>(
            `submissions/${id}.json`,
          );
          if (
            current &&
            (await config.store.write(
              `submissions/${id}.json`,
              {
                ...current.value,
                state: "published",
                issueUrl: match.html_url,
              },
              current.etag,
            ))
          )
            report = {
              ...current.value,
              state: "published",
              issueUrl: match.html_url,
            };
        }
      }
    }
    if (report.state === "published") {
      const marker = await config.store.read(path);
      if (marker) await config.store.remove(path, marker.etag);
      summary.published++;
    } else if (report.state === "pending") summary.pending++;
    else summary.needsReview++;
  }
  return summary;
}
