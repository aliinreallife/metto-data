export function canUnlinkAccount(
  accounts: { id: string; providerId: string }[],
  accountId: unknown,
): boolean {
  const supported = accounts.filter((account) =>
    ["google", "github"].includes(account.providerId),
  );
  return (
    typeof accountId === "string" &&
    supported.some((account) => account.id === accountId) &&
    new Set(supported.map((account) => account.providerId)).size > 1
  );
}
