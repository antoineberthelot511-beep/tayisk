import { NextRequest, NextResponse } from "next/server";
import { getSupabase, supabaseEnabled } from "@/lib/db";
import { moderateText, translateText, fetchImage, extractKeyword } from "@/lib/services";
import { storeImage } from "@/lib/storage";
import type { Category } from "@/lib/types";

const MAX_LEN = 200;
const DAILY_LIMIT = 5;
const VALID_CATEGORIES: Category[] = ["societe", "politique", "culture", "quotidien", "travail", "relations", "autre"];

/** Anti-abus : max DAILY_LIMIT cartes/jour/device. */
async function checkDailyLimit(deviceId: string): Promise<boolean> {
  if (!supabaseEnabled) return true;
  const sb = getSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await sb
    .from("daily_limits")
    .select("statements_created_count")
    .eq("device_id", deviceId)
    .eq("day", today)
    .maybeSingle();
  const count = data?.statements_created_count ?? 0;
  if (count >= DAILY_LIMIT) return false;
  await sb.rpc("upsert_daily_limit", { p_device_id: deviceId }).then(undefined, async () => {
    // fallback si la RPC n'existe pas : upsert direct
    await sb.from("daily_limits").upsert(
      { device_id: deviceId, day: today, statements_created_count: count + 1 },
      { onConflict: "device_id,day" }
    );
  });
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const { text, language = "fr", category = "autre", deviceId, userId } = await req.json();
    const clean = String(text ?? "").trim().replace(/\s+/g, " ");
    if (!clean || clean.length > MAX_LEN) {
      return NextResponse.json({ error: `Le texte doit faire entre 1 et ${MAX_LEN} caractères.` }, { status: 400 });
    }
    const validCategory: Category = VALID_CATEGORIES.includes(category) ? category : "autre";

    // 0. Anti-abus
    if (deviceId && !(await checkDailyLimit(String(deviceId)))) {
      return NextResponse.json(
        { error: `Limite de ${DAILY_LIMIT} cartes par jour atteinte. Revenez demain !` },
        { status: 429 }
      );
    }

    // 1. Modération
    const { flagged, failed, result } = await moderateText(clean);
    if (flagged) {
      return NextResponse.json(
        { status: "rejected", message: "Ce contenu a été rejeté par la modération automatique." },
        { status: 422 }
      );
    }
    // Modération indisponible (rate limit, erreur réseau) → review manuelle
    const effectiveStatus = failed ? "pending" : ((process.env.NEW_STATEMENT_STATUS as "approved" | "pending") || "approved");

    // 2. Image via mot-clé
    const keyword = extractKeyword(clean);
    const imageUrl = await fetchImage(keyword);

    // 3. Traduction FR/EN/ES
    const translations = await translateText(clean, language);

    if (!supabaseEnabled) {
      return NextResponse.json({ status: "demo", message: "Mode démo : carte non persistée.", keyword, translations });
    }
    const sb = getSupabase();

    // 3bis. Insertion d'abord (pour avoir l'UUID), puis stockage de l'image dans Supabase Storage
    const { data, error } = await sb
      .from("statements")
      .insert({
        text: clean,
        text_language: language,
        translations,
        image_url: imageUrl,
        image_keyword: keyword,
        category: validCategory,
        created_by: userId ?? null,
        status: effectiveStatus,
        moderation_result: result as object,
      })
      .select("id,status")
      .single();

    if (error || !data) {
      return NextResponse.json({
        status: "demo",
        message: `Carte validée par la modération ✅ (mode démo). Image : ${imageUrl ?? "aucune"}`,
        keyword,
        imageUrl,
        translations,
      });
    }

    // 4. Téléchargement unique → Supabase Storage (plus aucun appel API externe ensuite)
    let storagePath: string | null = null;
    if (imageUrl) {
      storagePath = await storeImage(imageUrl, data.id);
      if (storagePath) {
        await sb.from("statements").update({ image_storage_path: storagePath }).eq("id", data.id);
      }
    }

    return NextResponse.json({
      status: data.status,
      id: data.id,
      storedImage: Boolean(storagePath),
      message:
        data.status === "approved"
          ? "Carte publiée ! Elle est maintenant dans le flux de vote."
          : data.status === "pending"
            ? "Carte soumise : elle sera visible après validation."
            : "Carte rejetée.",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
