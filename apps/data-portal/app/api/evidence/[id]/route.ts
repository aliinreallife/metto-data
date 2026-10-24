import { intakeConfig } from "../../../../lib/config";
import { evidence } from "../../../../lib/intake";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const config = intakeConfig();
  if (!config) return new Response(null, { status: 404 });
  try {
    return await evidence(config, (await params).id);
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
