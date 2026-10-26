/** A login may resume a contribution, or public report, never redirect to an arbitrary URL. */
export function safeReportReturn(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 1200 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\r\n\\]/.test(value)
  )
    return null;
  try {
    const url = new URL(value, "https://metto.invalid");
    if (
      url.origin !== "https://metto.invalid" ||
      !["/contribute", "/reports"].includes(url.pathname)
    )
      return null;
    const result = new URL(url.pathname, url.origin);
    for (const key of url.pathname === "/reports"
      ? ["report", "lang"]
      : ["city", "station", "kind", "lang", "resume"]) {
      const part = url.searchParams.get(key);
      if (part && part.length <= 350) result.searchParams.set(key, part);
    }
    return result.pathname + result.search;
  } catch {
    return null;
  }
}
