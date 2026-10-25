/** A login may resume a contribution, never redirect to an arbitrary URL. */
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
      url.pathname !== "/contribute"
    )
      return null;
    const result = new URL("/contribute", url.origin);
    for (const key of ["city", "station", "kind", "lang", "resume"]) {
      const part = url.searchParams.get(key);
      if (part && part.length <= 350) result.searchParams.set(key, part);
    }
    return result.pathname + result.search;
  } catch {
    return null;
  }
}
