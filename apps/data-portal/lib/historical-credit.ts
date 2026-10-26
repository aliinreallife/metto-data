import history from "../../../data/reference/community-contributions.json" with { type: "json" };
import type { PrivateStore } from "./intake.ts";
import type { Leader } from "./leaderboard.ts";
export const historicalEntries = history.entries;
export const historicalId = (githubId: string) => "github-" + githubId;
const bindingPath = (githubId: string) =>
  "historical-links/github/" + githubId + ".json";
/** This mapping can only be established from the session's server-verified provider accounts. */
export async function linkHistoricalCredit(
  store: PrivateStore,
  id: string,
  accounts: { providerId: string; accountId: string }[],
) {
  for (const entry of historicalEntries) {
    if (
      !accounts.some(
        (account) =>
          account.providerId === "github" &&
          account.accountId === entry.author.githubId,
      )
    )
      continue;
    const path = bindingPath(entry.author.githubId);
    for (let i = 0; i < 4; i++) {
      const old = await store.read<{ id: string }>(path);
      if (old?.value.id === id) return true;
      if (await store.write(path, { id }, old?.etag ?? null)) return true;
    }
  }
  return false;
}
export async function resolveHistoricalId(
  store: PrivateStore | undefined,
  id: string,
) {
  const entry = historicalEntries.find(
    (entry) => historicalId(entry.author.githubId) === id,
  );
  if (!entry) return null;
  const binding = store
    ? await store
        .read<{ id: string }>(bindingPath(entry.author.githubId))
        .catch(() => null)
    : null;
  return binding && /^[a-f0-9]{64}$/.test(binding.value.id)
    ? binding.value.id
    : id;
}
/** Real, sourced corrections count once, with their historical provenance preserved. */
export async function includeHistoricalCredits(
  leaders: Leader[],
  store?: PrivateStore,
): Promise<Leader[]> {
  const people = new Map(
    leaders.map((person) => [person.id, structuredClone(person)]),
  );
  for (const entry of historicalEntries) {
    const id = (await resolveHistoricalId(
      store,
      historicalId(entry.author.githubId),
    ))!;
    const person = people.get(id) ?? {
      id,
      name: entry.author.name,
      accepted: 0,
      reports: [],
    };
    if (!person.reports.some((report) => report.id === entry.id))
      person.reports.push({
        id: entry.id,
        title: entry.names.fa,
        names: entry.names,
        url: entry.source,
        createdAt: entry.verifiedOn,
        accepted: true,
        kind: "historical",
      });
    people.set(id, person);
  }
  for (const person of people.values())
    person.accepted = person.reports.filter((report) => report.accepted).length;
  return [...people.values()].sort(
    (a, b) => b.accepted - a.accepted || a.id.localeCompare(b.id),
  );
}
