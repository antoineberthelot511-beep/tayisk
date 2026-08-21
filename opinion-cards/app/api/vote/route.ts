import { NextRequest, NextResponse } from "next/server";
import { castVote } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { deviceId, statementId, vote, userId } = await req.json();
    if (!deviceId || !statementId || !["agree", "disagree"].includes(vote)) {
      return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
    }
    const result = await castVote(deviceId, statementId, vote, userId ?? null);
    return NextResponse.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "ALREADY_VOTED") {
      return NextResponse.json({ error: "Vous avez déjà voté pour cette carte." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
