export function validPublicName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= 2 &&
    value.trim().length <= 80 &&
    !/[@\u0000-\u001f\u007f]/.test(value)
  );
}
export function accountContributionName(
  user: { name: string } | null | undefined,
): string | null {
  return user && validPublicName(user.name) ? user.name.trim() : null;
}
