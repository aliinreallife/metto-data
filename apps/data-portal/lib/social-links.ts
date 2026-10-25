export const socialKinds = [
  "instagram",
  "telegram",
  "x",
  "github",
  "spotify",
  "website",
] as const;
export type SocialKind = (typeof socialKinds)[number];
export type SocialLinks = Partial<Record<SocialKind, string>>;
const hosts: Record<Exclude<SocialKind, "website">, string[]> = {
  instagram: ["instagram.com", "www.instagram.com"],
  telegram: ["t.me", "www.t.me", "telegram.me", "www.telegram.me"],
  x: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
  github: ["github.com", "www.github.com"],
  spotify: ["open.spotify.com"],
};
const reserved: Record<Exclude<SocialKind, "website">, Set<string>> = {
  instagram: new Set(
    "p reel reels stories explore direct accounts settings about legal developer developers web api directory challenge oauth emails nametag".split(
      " ",
    ),
  ),
  telegram: new Set(
    "share joinchat addstickers addemoji iv proxy login auth passport confirmphone setlanguage boost".split(
      " ",
    ),
  ),
  x: new Set(
    "home search explore notifications messages settings login logout signup intent share compose tos privacy account oauth hashtag i".split(
      " ",
    ),
  ),
  github: new Set(
    "settings login logout signup orgs organizations features marketplace explore notifications new search about security enterprise pricing readme sponsors".split(
      " ",
    ),
  ),
  spotify: new Set(),
};
/** Match Jishoo's handle-or-profile-link behaviour, without fetching user links. */
export function socialProfile(kind: SocialKind, input: unknown): string {
  if (typeof input !== "string") throw Error("social");
  const value = input.trim();
  if (!value) return "";
  if (value.length > 300 || /[\\\s\u0000-\u001f\u007f]/.test(value))
    throw Error("social");
  let handle = value.replace(/^@/, ""),
    spotifyType = "user";
  const uri =
    kind === "spotify" && /^spotify:(user|artist):([a-z\d._-]+)$/i.exec(value);
  if (uri)
    return socialProfile(kind, `https://open.spotify.com/${uri[1]}/${uri[2]}`);
  if (
    kind === "website" ||
    /[:/]/.test(value) ||
    hosts[kind].includes(value.toLowerCase())
  ) {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`,
    );
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    )
      throw Error("social");
    url.protocol = "https:";
    if (kind === "website") {
      const host = url.hostname.toLowerCase();
      if (
        !host.includes(".") ||
        /^[\d.]+$/.test(host) ||
        /[:\[\]]/.test(host) ||
        /\.(?:local|localhost|internal|lan|test|invalid)$/.test(host) ||
        host.endsWith(".")
      )
        throw Error("social");
      return url.href;
    }
    if (!hosts[kind].includes(url.hostname.toLowerCase()))
      throw Error("social");
    const segments = url.pathname.split("/").filter(Boolean);
    if (kind === "spotify") {
      if (/^intl-[a-z-]+$/i.test(segments[0] ?? "")) segments.shift();
      if (segments.length !== 2 || !["user", "artist"].includes(segments[0]))
        throw Error("social");
      spotifyType = segments.shift()!;
    } else if (segments.length !== 1) throw Error("social");
    handle = decodeURIComponent(segments[0]);
  }
  const patterns = {
    instagram: /^[a-z\d_](?:[a-z\d_.]{0,28}[a-z\d_])?$/i,
    telegram: /^[a-z][a-z\d_]{3,31}$/i,
    x: /^[a-z\d_]{1,15}$/i,
    github: /^[a-z\d]+(?:-[a-z\d]+)*$/i,
    spotify: /^[a-z\d._-]{1,100}$/i,
  };
  if (
    !patterns[kind].test(handle) ||
    handle.includes("..") ||
    reserved[kind].has(handle.toLowerCase()) ||
    (kind === "spotify" && [".", ".."].includes(handle)) ||
    (kind === "github" && handle.length > 39) ||
    (kind === "spotify" &&
      spotifyType === "artist" &&
      !/^[a-z\d]{22}$/i.test(handle))
  )
    throw Error("social");
  const origin = {
    instagram: "https://www.instagram.com/",
    telegram: "https://t.me/",
    x: "https://x.com/",
    github: "https://github.com/",
    spotify: `https://open.spotify.com/${spotifyType}/`,
  };
  return origin[kind] + handle;
}
export function cleanSocialLinks(input: unknown): SocialLinks {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("social");
  const result: SocialLinks = {};
  for (const [kind, value] of Object.entries(input)) {
    if (!socialKinds.includes(kind as SocialKind)) throw Error("social");
    const url = socialProfile(kind as SocialKind, value);
    if (url) result[kind as SocialKind] = url;
  }
  return result;
}
