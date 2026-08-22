// Module serveur uniquement : utilise la cle service role.
import { isSupabaseConfigured, supabaseAdmin } from "./supabase";
import type { Lang, Statement, StatementStatus, VoteChoice } from "./types";

/** Plafond de lecture, pour qu'un profil tres actif reste une requete bornee. */
const MAX_ROWS = 500;

export type MyCard = {
  id: string;
  text: string;
  text_language: Lang;
  translations: Partial<Record<Lang, string>>;
  image_url: string | null;
  status: StatementStatus;
  votes_agree: number;
  votes_disagree: number;
  created_at: string;
};

export type VoteStats = {
  total: number;
  majority: number;
  majorityPct: number;
};

export type ProfileData = { created: MyCard[]; stats: VoteStats };

const EMPTY: ProfileData = {
  created: [],
  stats: { total: 0, majority: 0, majorityPct: 0 },
};

function toMyCard(row: Statement): MyCard {
  return {
    id: row.id,
    text: row.text,
    text_language: row.text_language,
    translations: row.translations ?? {},
    image_url: row.image_url,
    status: row.status,
    votes_agree: row.votes_agree,
    votes_disagree: row.votes_disagree,
    created_at: row.created_at,
  };
}

/** Cartes creees depuis cet appareil, tous statuts confondus. */
async function loadCreated(ids: string[]): Promise<MyCard[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabaseAdmin()
    .from("statements")
    .select("*")
    .in("id", ids.slice(0, MAX_ROWS))
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[profile] created:", error.message);
    return [];
  }
  return ((data ?? []) as Statement[]).map(toMyCard);
}

/**
 * Statistiques de vote du device : combien de votes, et combien de fois
 * l'utilisateur s'est retrouve du cote majoritaire.
 */
async function loadStats(deviceId: string): Promise<VoteStats> {
  if (!deviceId) return EMPTY.stats;

  const db = supabaseAdmin();

  const { data: votes, error } = await db
    .from("votes")
    .select("statement_id, vote")
    .eq("device_id", deviceId)
    .limit(MAX_ROWS);

  if (error) {
    console.error("[profile] votes:", error.message);
    return EMPTY.stats;
  }
  if (!votes || votes.length === 0) return EMPTY.stats;

  const { data: statements } = await db
    .from("statements")
    .select("id, votes_agree, votes_disagree")
    .in(
      "id",
      votes.map((v) => v.statement_id as string),
    );

  const counts = new Map(
    (statements ?? []).map((s) => [
      s.id as string,
      { agree: s.votes_agree as number, disagree: s.votes_disagree as number },
    ]),
  );

  let majority = 0;
  for (const v of votes) {
    const tally = counts.get(v.statement_id as string);
    if (!tally) continue;
    const total = tally.agree + tally.disagree;
    if (total === 0) continue;

    const sideShare =
      ((v.vote as VoteChoice) === "agree" ? tally.agree : tally.disagree) / total;
    if (sideShare >= 0.5) majority += 1;
  }

  return {
    total: votes.length,
    majority,
    majorityPct: Math.round((majority / votes.length) * 100),
  };
}

export async function getProfile(
  deviceId: string,
  createdIds: string[],
): Promise<ProfileData> {
  if (!isSupabaseConfigured) return EMPTY;

  try {
    const [created, stats] = await Promise.all([
      loadCreated(createdIds),
      loadStats(deviceId),
    ]);
    return { created, stats };
  } catch (error) {
    console.error("[profile]", error);
    return EMPTY;
  }
}
