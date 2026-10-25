import { contributorId, validPublicName } from "./credit.ts";
import { cleanSocialLinks, type SocialLinks } from "./social-links.ts";
import type { PrivateStore } from "./intake.ts";
export const genders = [
  "",
  "woman",
  "man",
  "nonbinary",
  "prefer_not_say",
] as const;
export type MemberProfile = {
  name: string;
  age: number | null;
  gender: (typeof genders)[number];
  bio: string;
  publicName: string;
  socialLinks: SocialLinks;
  publicProfile: boolean;
};
export type PublicMemberProfile = Pick<
  MemberProfile,
  "publicName" | "bio" | "socialLinks"
>;
export function parseProfile(raw: unknown): MemberProfile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  const text = (value: unknown, max: number) =>
    typeof value === "string" &&
    value.length <= max &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
      ? value.trim()
      : null;
  const name = text(p.name, 80),
    bio = text(p.bio, 300),
    publicName = text(p.publicName, 80);
  if (
    !name ||
    name.length < 2 ||
    /[\u0000-\u001f\u007f]/.test(name) ||
    bio === null ||
    publicName === null ||
    !genders.includes(p.gender as MemberProfile["gender"]) ||
    typeof p.publicProfile !== "boolean" ||
    !(
      p.age === null ||
      (typeof p.age === "number" &&
        Number.isInteger(p.age) &&
        p.age >= 0 &&
        p.age <= 120)
    ) ||
    (p.publicProfile && !validPublicName(publicName))
  )
    return null;
  try {
    return {
      name,
      bio,
      publicName,
      age: p.age as number | null,
      gender: p.gender as MemberProfile["gender"],
      publicProfile: p.publicProfile,
      socialLinks: cleanSocialLinks(p.socialLinks),
    };
  } catch {
    return null;
  }
}
export function publicMemberProfile(
  profile: MemberProfile | null,
): PublicMemberProfile | null {
  return profile?.publicProfile
    ? {
        publicName: profile.publicName,
        bio: profile.bio,
        socialLinks: profile.socialLinks,
      }
    : null;
}
export const profilePath = (id: string) => `profiles/${id}.json`;
export function createProfileHandler(config: {
  store: PrivateStore;
  secret: string;
  user: () => Promise<{ id: string; name: string } | null>;
  updateName: (name: string) => Promise<boolean>;
}) {
  return async (request: Request) => {
    const reply = (status: number, value: unknown) =>
      Response.json(value, {
        status,
        headers: { "Cache-Control": "no-store" },
      });
    if (
      request.method !== "GET" &&
      (request.method !== "PUT" ||
        request.headers.get("origin") !== new URL(request.url).origin)
    )
      return reply(403, { error: "origin" });
    try {
      const user = await config.user();
      if (!user) return reply(401, { error: "login" });
      const id = contributorId(user.id, config.secret),
        path = profilePath(id);
      const current = await config.store.read<MemberProfile>(path);
      if (request.method === "GET")
        return reply(200, {
          profile: current?.value ?? null,
          revision: current?.etag ?? null,
          id,
        });
      const body = await request.text();
      if (body.length > 7000) return reply(400, { error: "profile" });
      let raw: { profile?: unknown; revision?: unknown };
      try {
        raw = JSON.parse(body);
      } catch {
        return reply(400, { error: "profile" });
      }
      if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return reply(400, { error: "profile" });
      const profile = parseProfile(raw.profile);
      if (
        !profile ||
        !(raw.revision === null || typeof raw.revision === "string")
      )
        return reply(400, { error: "profile" });
      if (raw.revision !== (current?.etag ?? null))
        return reply(409, {
          error: "changed",
          revision: current?.etag ?? null,
        });
      if (
        user.name !== profile.name &&
        !(await config.updateName(profile.name))
      )
        return reply(503, { error: "name" });
      if (!(await config.store.write(path, profile, current?.etag ?? null))) {
        const latest = await config.store.read<MemberProfile>(path);
        return reply(409, { error: "changed", revision: latest?.etag ?? null });
      }
      const saved = await config.store.read<MemberProfile>(path);
      return reply(200, {
        profile: saved?.value ?? profile,
        revision: saved?.etag ?? null,
        id,
      });
    } catch {
      return reply(503, { error: "unavailable" });
    }
  };
}
