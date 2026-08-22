// Module serveur uniquement : utilise la cle service role.
import { detectTextLanguage } from "./i18n";
import { findImage, guessKeyword } from "./images";
import { moderateText } from "./moderation";
import { isSupabaseConfigured, supabaseAdmin } from "./supabase";
import { translateAll } from "./translate";
import type { Lang, StatementStatus } from "./types";

export const MAX_LENGTH = 200;
export const MIN_LENGTH = 3;

export type CreateOutcome =
  | { ok: true; id: string; status: StatementStatus }
  | { ok: false; reason: "invalid" | "rejected" | "unavailable"; message: string };

/**
 * Statut d'une carte qui vient d'etre creee.
 *
 * NEW_STATEMENT_STATUS pilote le mode nominal ('approved' = publication
 * directe, 'pending' = relecture humaine). Si la moderation automatique n'a
 * pas pu tourner, on force 'pending' quoi qu'il arrive : mieux vaut une
 * carte en attente qu'une carte publiee sans aucun controle.
 */
function resolveStatus(moderationSkipped: boolean): StatementStatus {
  if (moderationSkipped) return "pending";
  return process.env.NEW_STATEMENT_STATUS === "pending" ? "pending" : "approved";
}

export async function createStatement(input: {
  text: string;
  keyword?: string;
  viewerLang?: Lang;
}): Promise<CreateOutcome> {
  const text = input.text.trim().replace(/\s+/g, " ");

  if (text.length < MIN_LENGTH || text.length > MAX_LENGTH) {
    return {
      ok: false,
      reason: "invalid",
      message: `Le texte doit faire entre ${MIN_LENGTH} et ${MAX_LENGTH} caractères.`,
    };
  }

  if (!isSupabaseConfigured) {
    return {
      ok: false,
      reason: "unavailable",
      message: "La création est indisponible : base de données non configurée.",
    };
  }

  // 1. Moderation avant tout : inutile de consommer les autres quotas si le
  //    texte est rejete.
  const moderation = await moderateText(text);
  if (moderation.flagged) {
    await supabaseAdmin()
      .from("statements")
      .insert({
        text,
        text_language: detectTextLanguage(text, input.viewerLang),
        status: "rejected",
        moderation_result: moderation.raw,
      });

    return {
      ok: false,
      reason: "rejected",
      message:
        "Ce texte a été refusé par la modération automatique. Reformule sans propos haineux, violents ou sexuels.",
    };
  }

  const language = detectTextLanguage(text, input.viewerLang);
  const keyword = (input.keyword?.trim() || guessKeyword(text)).slice(0, 60);

  // 2. Image et traductions en parallele : aucune des deux n'est bloquante,
  //    une carte reste valable sans image et sans traduction.
  const [imageUrl, translations] = await Promise.all([
    findImage(keyword),
    translateAll(text, language),
  ]);

  const status = resolveStatus(moderation.skipped);

  const { data, error } = await supabaseAdmin()
    .from("statements")
    .insert({
      text,
      text_language: language,
      translations,
      image_url: imageUrl,
      image_keyword: keyword,
      status,
      moderation_result: moderation.raw,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[create]", error);
    return {
      ok: false,
      reason: "unavailable",
      message: "Impossible d'enregistrer la carte pour le moment.",
    };
  }

  return { ok: true, id: data.id as string, status };
}
