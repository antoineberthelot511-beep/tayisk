import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { demoApplyVote, demoNextStatement, demoStatements } from "./demo-data";
import { publicImageUrl } from "./storage";
import type { Category, Statement, VoteType } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseEnabled = Boolean(url && serviceKey);

let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  }
  return client;
}

const STATEMENT_COLS =
  "id,text,text_language,translations,image_url,image_storage_path,image_keyword,category,controversy_score,votes_agree,votes_disagree,created_at";

/** Privilégie l'image stockée localement (Storage) plutôt que l'URL externe. */
function withLocalImage(s: unknown): Statement {
  const st = s as unknown as Statement;
  if (st.image_storage_path) {
    const local = publicImageUrl(st.image_storage_path);
    if (local) st.image_url = local;
  }
  return st;
}

/** Tri mixte : mélange nouveauté et popularité (score = votes pondérés + bonus récence). */
function mixedOrder(items: Statement[]): Statement[] {
  const now = Date.now();
  return [...items]
    .map((s) => {
      const total = s.votes_agree + s.votes_disagree;
      const ageHours = s.created_at ? (now - new Date(s.created_at).getTime()) / 3_600_000 : 0;
      // Popularité log + fort bonus pour les cartes < 48h
      const score = Math.log10(1 + total) * 2 + Math.max(0, 2 - ageHours / 24);
      return { s, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}

/** Prochaine carte non votée pour ce device (feed mélangé nouveauté/popularité). */
export async function getNextStatement(deviceId: string, category?: string): Promise<Statement | null> {
  if (!supabaseEnabled) return demoNextStatement(deviceId);
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
      .limit(40);
    if (category && category !== "all") query = query.eq("category", category);
    if (votedIds.length > 0) query = query.not("id", "in", votedIds);
    const { data, error } = await query;
    if (error) throw error;
    const ordered = mixedOrder((data ?? []) as unknown as Statement[]);
    return ordered[0] ? withLocalImage(ordered[0]) : null;
  } catch {
    // Fallback mode démo si DB indisponible
    return demoNextStatement(deviceId);
  }
}

/** Carte individuelle par id (pour la page partageable). */
export async function getStatementById(id: string): Promise<Statement | null> {
  if (!supabaseEnabled) return demoStatements.find((s) => s.id === id) ?? null;
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from("statements").select(STATEMENT_COLS).eq("id", id).eq("status", "approved").maybeSingle();
    if (error) throw error;
    return data ? withLocalImage(data) : null;
  } catch {
    return demoStatements.find((s) => s.id === id) ?? null;
  }
}

/** Tendances : cartes les plus controversées et les plus votées des dernières 24h. */
export async function getTrending(): Promise<{ controversial: Statement[]; mostVoted: Statement[] }> {
  if (!supabaseEnabled) {
    const sorted = [...demoStatements];
    return {
      controversial: sorted.sort((a, b) => (b.controversy_score ?? 0) - (a.controversy_score ?? 0)).slice(0, 10),
      mostVoted: [...demoStatements].sort((a, b) => b.votes_agree + b.votes_disagree - (a.votes_agree + a.votes_disagree)).slice(0, 10),
    };
  }
  const sb = getSupabase();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const base = () =>
    sb.from("statements").select(STATEMENT_COLS).eq("status", "approved").gte("created_at", since);
  const [{ data: controversial }, { data: mostVoted }] = await Promise.all([
    base().order("controversy_score", { ascending: false }).limit(10),
    base().order("votes_agree", { ascending: false }).order("votes_disagree", { ascending: false }).limit(10),
  ]);
  return {
    controversial: ((controversial ?? []) as unknown as Statement[]).map(withLocalImage),
    mostVoted: ((mostVoted ?? []) as unknown as Statement[]).map(withLocalImage),
  };
}

/** Enregistre un vote et renvoie les stats mises à jour. */
export async function castVote(deviceId: string, statementId: string, vote: VoteType, userId?: string | null) {
  if (!supabaseEnabled) {
    const s = demoApplyVote(deviceId, statementId, vote);
    return computeStats(s.votes_agree, s.votes_disagree, vote);
  }
  try {
    const sb = getSupabase();
    const { error } = await sb.from("votes").insert({
      statement_id: statementId,
      device_id: deviceId,
      user_id: userId ?? null,
      vote,
    });
    if (error) {
      if (error.code === "23505") throw new Error("ALREADY_VOTED");
      throw error;
    }
    // Streak (si connecté)
    if (userId) await sb.rpc("update_streak", { p_user_id: userId }).then(() => {}, () => {});
    const { data, error: e2 } = await sb
      .from("statements")
      .select("votes_agree,votes_disagree")
      .eq("id", statementId)
      .single();
    if (e2 || !data) throw e2 ?? new Error("not_found");
    return computeStats(data.votes_agree, data.votes_disagree, vote);
  } catch (e) {
    if ((e as Error).message === "ALREADY_VOTED") throw e;
    const s = demoStatements.find((d) => d.id === statementId);
    if (s) {
      const updated = demoApplyVote(deviceId, statementId, vote);
      return computeStats(updated.votes_agree, updated.votes_disagree, vote);
    }
    throw new Error("DB indisponible.");
  }
}

function computeStats(agree: number, disagree: number, vote: VoteType) {
  const total = agree + disagree;
  const agreePct = total > 0 ? Math.round((agree / total) * 100) : 0;
  return {
    agree_pct: agreePct,
    disagree_pct: 100 - agreePct,
    total_votes: total,
    in_majority: (vote === "agree" ? agreePct : 100 - agreePct) >= 50,
  };
}


