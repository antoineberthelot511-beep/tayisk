import { NextRequest, NextResponse } from "next/server";
import { getNextStatement } from "@/lib/db";

export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("deviceId");
  const category = req.nextUrl.searchParams.get("category") ?? undefined;
  if (!deviceId) return NextResponse.json({ error: "deviceId requis" }, { status: 400 });
  try {
    const statement = await getNextStatement(deviceId, category);
    return NextResponse.json({ statement });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
