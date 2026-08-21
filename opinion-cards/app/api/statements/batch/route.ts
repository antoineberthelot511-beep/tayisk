import { NextRequest, NextResponse } from "next/server";
import { getFeedBatch } from "@/lib/feed";

/** Feed infini : batch de cartes non vues (pagination côté client). */
export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("deviceId");
  const category = req.nextUrl.searchParams.get("category") ?? undefined;
  if (!deviceId) return NextResponse.json({ error: "deviceId requis" }, { status: 400 });
  try {
    const statements = await getFeedBatch(deviceId, category);
    return NextResponse.json({ statements });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
