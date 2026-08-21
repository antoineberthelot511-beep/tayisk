import { getSupabase, supabaseEnabled } from "./db";
import type { Statement } from "./types";

const STATEMENT_COLS =
  "id,text,text_language,translations,image_url,image_storage_path,image_keyword,category,controversy_score,votes_agree,votes_disagree,created_at";

/** Tri mixte : popularité log + bonus récence (<48h). */
function mixedOrder(items: Statement[]): Statement[] {
  const now = Date.now();
  return [...items]
    .map((s) => {
      const total = s.votes_agree + s.votes_disagree;
      const ageHours = s.created_at ? (now - new Date(s.created_at).getTime()) / 3_600_000 : 0;
      const score = Math.log10(1 + total) * 2 + Math.max(0, 2 - ageHours / 24);
      return { s, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}

/**
 * Batch de cartes non vues pour le feed infini.
 * Variable reward : intercale une carte à consensus extrême (>85% ou <15%)
 * toutes les ~8-12 cartes — l'utilisateur ne sait jamais quand ça arrive.
 */
export async function getFeedBatch(
  deviceId: string,
  category?: string,
  limit = 20
): Promise<Statement[]> {
  if (!supabaseEnabled) return [];
  try {
    const sb = getSupabase();
    const { data: votedRows, error: e1 } = await sb
      .from("votes")
      .select("statement_id")
      .eq("device_id", deviceId);
    if (e1) throw e1;
    const votedIds = (votedRows ?? []).map((r) => r.statement_id);

    let query = sb
      .from("statements")
      .select(STATEMENT_COLS)
      .eq("status", "approved")
      .limit(60);
    if (category && category !== "all") query = query.eq("category", category);
    if (votedIds.length > 0) query = query.not("id", "in", votedIds);
    const { data, error } = await query;
    if (error) throw error;

    const all = (data ?? []) as unknown as Statement[];

    // Cartes normales (mix nouveauté/popularité)
    const normal = mixedOrder(all.filter((s) => {
      const t = s.votes_agree + s.votes_disagree;
      const ratio = t > 0 ? s.votes_agree / t : 0.5;
      return t < 5 || (ratio <= 0.85 && ratio >= 0.15); // exclut les extrêmes du flux standard
    }));

    // Carte extrême (consensus fort) = récompense variable
    const extremes = all.filter((s) => {
      const t = s.votes_agree + s.votes_disagree;
      const ratio = t > 0 ? s.votes_agree / t : 0.5;
      return t >= 10 && (ratio > 0.85 || ratio < 0.15);
    });

    const batch = normal.slice(0, limit);
    if (extremes.length > 0 && batch.length > 4) {
      // Insère à une position pseudo-aléatoire entre 8 et 12
      const pos = Math.min(8 + Math.floor(Math.random() * 5), batch.length - 1);
      batch.splice(pos, 0, extremes[Math.floor(Math.random() * extremes.length)]);
    }
    return batch.slice(0, limit);
  } catch {
    return [];
  }
}

/** Est-ce que la carte est à un consensus extrême (effet confettis rare) ? */
export function isExtreme(s: Statement): boolean {
  const t = s.votes_agree + s.votes_disagree;
  if (t < 20) return false;
  const ratio = s.votes_agree / t;
  return ratio > 0.95 || ratio < 0.05;
}
