import { NextResponse } from "next/server";
import { castVote } from "@/lib/feed";
import type { VoteChoice } from "@/lib/types";

export async function POST(request: Request) {
  let body: { statement_id?: string; device_id?: string; vote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const { statement_id: statementId, device_id: deviceId, vote } = body;

  if (!statementId || !deviceId) {
    return NextResponse.json(
      { error: "statement_id et device_id requis" },
      { status: 400 },
    );
  }
  if (vote !== "agree" && vote !== "disagree") {
    return NextResponse.json(
      { error: "vote doit valoir 'agree' ou 'disagree'" },
      { status: 400 },
    );
  }

  try {
    const result = await castVote(statementId, deviceId, vote as VoteChoice);
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("[vote]", error);
    return NextResponse.json(
      { error: "Vote impossible pour le moment" },
      { status: 500 },
    );
  }
}
