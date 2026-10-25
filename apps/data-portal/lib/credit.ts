import { createHmac, timingSafeEqual } from "node:crypto";
export function validPublicName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= 2 &&
    value.trim().length <= 80 &&
    !/[@\u0000-\u001f\u007f]/.test(value)
  );
}
export type PublicCredit = { id: string; name: string; signature: string };
export function contributorId(userId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`metto-public-contributor:${userId}`)
    .digest("hex");
}
export function makeCredit(
  reportId: string,
  user: { id: string; name: string },
  secret: string,
): PublicCredit {
  const id = contributorId(user.id, secret);
  const name = user.name.trim().slice(0, 80);
  const signature = createHmac("sha256", secret)
    .update(JSON.stringify([reportId, id, name]))
    .digest("hex");
  return { id, name, signature };
}
export function verifyCredit(
  reportId: string,
  credit: unknown,
  secret: string,
): credit is PublicCredit {
  if (!credit || typeof credit !== "object" || !secret) return false;
  const c = credit as PublicCredit;
  if (
    !/^[a-f0-9]{64}$/.test(c.id ?? "") ||
    typeof c.name !== "string" ||
    !c.name.trim() ||
    c.name.length > 80 ||
    !/^[a-f0-9]{64}$/.test(c.signature ?? "")
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(JSON.stringify([reportId, c.id, c.name]))
    .digest();
  return timingSafeEqual(expected, Buffer.from(c.signature, "hex"));
}
