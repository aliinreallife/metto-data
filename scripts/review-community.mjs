// Owner-approved workflow only. Log neither credentials nor private reports.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
const owner = "aliinreallife",
  repository = "aliinreallife/metto-data",
  token = process.env.GITHUB_TOKEN,
  origin = process.env.DATA_PORTAL_ORIGIN;
if (
  process.env.GITHUB_REPOSITORY !== repository ||
  process.env.GITHUB_ACTOR !== owner ||
  event.sender?.login !== owner ||
  !["data:accepted", "data:rejected"].includes(event.label?.name) ||
  !Number.isSafeInteger(event.issue?.number) ||
  !token ||
  origin !== "https://data.metto.ir"
)
  throw Error("Explicit owner approval is required");
const issueNumber = event.issue.number,
  headers = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
async function identity() {
  const url = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
  url.searchParams.set("audience", origin);
  const response = await fetch(url, {
    headers: {
      Authorization: "Bearer " + process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
    },
  });
  if (!response.ok) throw Error("Workflow identity unavailable");
  return (await response.json()).value;
}
async function api(action, commit) {
  const response = await fetch(origin + "/api/maintenance/community-review", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + (await identity()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ issueNumber, githubToken: token, action, commit }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw Error("Owner review could not be verified");
  return response.json();
}
async function github(path, method = "GET", body) {
  const response = await fetch(
    "https://api.github.com/repos/" + repository + path,
    { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) },
  );
  if (!response.ok) throw Error("GitHub review update failed");
  return response.status === 204 ? null : response.json();
}
async function resultNote(text, manual) {
  const issue = await github("/issues/" + issueNumber);
  const marker = "<!-- metto-community-result -->",
    end = "<!-- /metto-community-result -->";
  const body = issue.body ?? "";
  const startAt = body.lastIndexOf(marker),
    endAt = body.lastIndexOf(end);
  const metadataAt = body.lastIndexOf("<!-- metto-data-report:");
  const prior = (
    startAt > metadataAt && endAt > startAt
      ? body.slice(0, startAt) + body.slice(endAt + end.length)
      : body
  ).trimEnd();
  await github("/issues/" + issueNumber, "PATCH", {
    body: prior + "\n\n" + marker + "\n" + text + "\n" + end,
  });
  if (manual)
    await github("/issues/" + issueNumber + "/labels", "POST", {
      labels: ["data:manual-needed"],
    });
}
const run = (command, args) =>
  execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
try {
  if (event.label.name === "data:rejected") {
    await api("rejected");
    console.log(JSON.stringify({ rejected: true }));
    process.exit(0);
  }
  const proposal = await api("prepare");
  if (!proposal.document) {
    await resultNote(
      "این گزارش تأیید شده، ولی تغییرش قابل اعمال خودکار نیست و باید دستی ثبت شود.",
      true,
    );
    console.log(JSON.stringify({ automatic: 0, manual: true }));
    process.exit(0);
  }
  const path = join(process.env.RUNNER_TEMP, "metto-approved-review.json");
  writeFileSync(path, JSON.stringify(proposal));
  const outcome = JSON.parse(
    run("pnpm", [
      "exec",
      "tsx",
      "scripts/apply-community-review.ts",
      "--input",
      path,
    ]),
  );
  if (!outcome.applied) {
    await api("manual");
    await resultNote(
      "این تغییر با یک اصلاح تأییدشدهٔ قبلی تداخل دارد؛ داده‌ای تغییر نکرد. لطفاً آن را دستی بررسی و ثبت کن.",
      true,
    );
    console.log(JSON.stringify({ automatic: 0, manual: true }));
    process.exit(0);
  }
  let commit;
  if (!outcome.unchanged) {
    run("pnpm", ["contributions:validate"]);
    run("pnpm", ["build"]);
    run("pnpm", ["validate"]);
    run("pnpm", ["test"]);
    const issue = await github("/issues/" + issueNumber);
    if (
      !issue.labels.some((l) => l.name === "data:accepted") ||
      issue.labels.some((l) => l.name === "data:rejected")
    )
      throw Error("Owner approval changed");
    run("git", ["config", "user.name", "github-actions[bot]"]);
    run("git", [
      "config",
      "user.email",
      "41898282+github-actions[bot]@users.noreply.github.com",
    ]);
    run("git", [
      "add",
      "contributions/approved/" + proposal.id + ".json",
      "data/cities",
    ]);
    if (run("git", ["diff", "--cached", "--name-only"])) {
      run("git", [
        "commit",
        "-m",
        "data: apply owner-approved community correction #" + issueNumber,
      ]);
      run("pnpm", ["generated:check"]);
      run("git", ["push", "origin", "HEAD:main"]);
    }
  }
  commit = run("git", ["rev-parse", "HEAD"]);
  await api("applied", commit);
  await resultNote(
    "اصلاحات قابل ثبت پس از تأیید مدیر اعمال شدند: https://github.com/" +
      repository +
      "/commit/" +
      commit +
      (proposal.manual
        ? "\n\nبخشی از این گزارش هنوز به ثبت یا بررسی دستی نیاز دارد."
        : ""),
    proposal.manual,
  );
  console.log(
    JSON.stringify({ automatic: proposal.automatic, manual: proposal.manual }),
  );
} catch {
  try {
    await api("manual");
    await resultNote(
      "تأیید مدیر ثبت شده، اما اعمال خودکار کامل نشد. لطفاً وضعیت ساخت یا تغییر هم‌زمان داده‌ها را بررسی و اصلاح را دستی ثبت کن.",
      true,
    );
  } catch {}
  throw Error(
    "Automatic review application needs maintainer attention; no unvalidated dataset was pushed",
  );
}
