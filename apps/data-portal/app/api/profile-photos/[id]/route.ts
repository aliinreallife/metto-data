import { intakeConfig } from "../../../../lib/config";
import { publicProfilePhoto } from "../../../../lib/profile-photo";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const config = intakeConfig(new URL(request.url).origin);
  if (!config) return new Response(null, { status: 404 });
  try {
    return await publicProfilePhoto(config.store, (await params).id, request);
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
