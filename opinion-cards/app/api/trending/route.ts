import { NextResponse } from "next/server";
import { getTrending } from "@/lib/db";

export async function GET() {
  try {
    const trending = await getTrending();
    return NextResponse.json(trending);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
