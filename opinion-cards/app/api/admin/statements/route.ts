import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";

/** Liste les cartes récentes (tous statuts) — réservé aux admins. */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token || !(await getAdminUser(token))) {
    return NextResponse.json({ error: "Accès réservé aux administrateurs." }, { status: 403 });
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("statements")
    .select("id,text,status,category,votes_agree,votes_disagree,created_at,image_url")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ statements: data });
}

/** Modère une carte rétroactivement (rejected/approved). */
export async function PATCH(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token || !(await getAdminUser(token))) {
    return NextResponse.json({ error: "Accès réservé aux administrateurs." }, { status: 403 });
  }
  const { id, status } = await req.json();
  if (!id || !["approved", "rejected", "pending"].includes(status)) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }
  const sb = getSupabase();
  const { error } = await sb.from("statements").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
