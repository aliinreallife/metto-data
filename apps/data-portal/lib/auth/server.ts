import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import { createNeonAuth } from "@neondatabase/auth/next/server";
let instance: ReturnType<typeof createNeonAuth> | null = null;
export function portalAuth() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const quota = process.env.DATA_PORTAL_QUOTA_SECRET;
  const secret =
    process.env.NEON_AUTH_COOKIE_SECRET ||
    (quota
      ? createHmac("sha256", quota)
          .update("metto-neon-auth-cookie-v1")
          .digest("hex")
      : "");
  if (!baseUrl || secret.length < 32) return null;
  return (instance ??= createNeonAuth({
    baseUrl,
    cookies: { secret },
    logLevel: "silent",
  }));
}
export async function portalUser() {
  const auth = portalAuth();
  if (!auth || (await cookies()).getAll().length === 0) return null;
  const { data } = await auth.getSession();
  return data?.user?.emailVerified
    ? { id: data.user.id, name: data.user.name }
    : null;
}
