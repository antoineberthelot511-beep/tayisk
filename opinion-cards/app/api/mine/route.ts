import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/profile";

/** Les identifiants de cartes viennent du client : on borne et on valide. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 200;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const deviceId = params.get("device") ?? "";

  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => UUID.test(id))
    .slice(0, MAX_IDS);

  const profile = await getProfile(deviceId, ids);

  return NextResponse.json(profile, {
    headers: { "cache-control": "no-store" },
  });
}
