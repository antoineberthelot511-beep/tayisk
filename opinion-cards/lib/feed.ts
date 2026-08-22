// Module serveur uniquement : utilise la cle service role.
import { DEMO_STATEMENTS } from "./demo-data";
import { isSupabaseConfigured, supabaseAdmin } from "./supabase";
import type { FeedStatement, Statement, VoteChoice, VoteResult } from "./types";

const FEED_LIMIT = 10;
/** Fenetre lue avant melange quand on passe par PostgREST plutot que le RPC. */
const SAMPLE_WINDOW = 60;
/** Code PostgREST : la fonction RPC n'existe pas dans ce projet. */
const FN_MISSING = "PGRST202";

/**
 * Les RPC (schema.sql) sont le chemin rapide et atomique. Tant qu'elles ne
 * sont pas installees, on retombe sur des requetes PostgREST equivalentes,
 * pour que l'app tourne sur une base ou la migration n'a pas ete jouee.
 */
let rpcAvailable: boolean | null = null;

function toFeedStatement(row: Statement): FeedStatement {
  return {
    id: row.id,
    text: row.text,
    text_language: row.text_language,
    translations: row.translations ?? {},
    image_url: row.image_url,
    votes_agree: row.votes_agree,
    votes_disagree: row.votes_disagree,
  };
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildResult(
  agree: number,
  disagree: number,
  vote: VoteChoice,
  already: boolean,
): VoteResult {
  const total = agree + disagree;
  const agreePct = total === 0 ? 50 : Math.round((agree / total) * 100);
  const userSidePct = vote === "agree" ? agreePct : 100 - agreePct;
  return {
    votes_agree: agree,
    votes_disagree: disagree,
    agree_pct: agreePct,
    is_majority: userSidePct >= 50,
    already_voted: already,
  };
}

// --------------------------------------------------------------- mode demo
// Votes gardes en memoire du process : les pourcentages bougent pendant la
// session mais rien n'est persiste. Actif seulement sans Supabase.

const demoVotes = new Map<string, Map<string, VoteChoice>>();
const demoTallies = new Map(
  DEMO_STATEMENTS.map((s) => [
    s.id,
    { agree: s.votes_agree, disagree: s.votes_disagree },
  ]),
);

function demoFeed(deviceId: string, limit: number): FeedStatement[] {
  const voted = demoVotes.get(deviceId);
  const available = DEMO_STATEMENTS.filter((s) => !voted?.has(s.id)).map((s) => {
    const tally = demoTallies.get(s.id)!;
    return { ...s, votes_agree: tally.agree, votes_disagree: tally.disagree };
  });
  return shuffle(available).slice(0, limit);
}

function demoVote(
  statementId: string,
  deviceId: string,
  vote: VoteChoice,
): VoteResult {
  const tally = demoTallies.get(statementId);
  if (!tally) throw new Error("Carte inconnue");

  const forDevice = demoVotes.get(deviceId) ?? new Map<string, VoteChoice>();
  const already = forDevice.has(statementId);

  if (!already) {
    forDevice.set(statementId, vote);
    demoVotes.set(deviceId, forDevice);
    if (vote === "agree") tally.agree += 1;
    else tally.disagree += 1;
  }
  return buildResult(tally.agree, tally.disagree, vote, already);
}

// ------------------------------------------------------------ feed

async function feedViaRest(
  deviceId: string,
  limit: number,
): Promise<FeedStatement[]> {
  const db = supabaseAdmin();

  let votedIds: string[] = [];
  if (deviceId) {
    const { data } = await db
      .from("votes")
      .select("statement_id")
      .eq("device_id", deviceId);
    votedIds = (data ?? []).map((v) => v.statement_id as string);
  }

  let query = db
    .from("statements")
    .select("*")
    .eq("status", "approved")
    .limit(SAMPLE_WINDOW);

  if (votedIds.length > 0) {
    query = query.not("id", "in", `(${votedIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return shuffle((data ?? []) as Statement[])
    .slice(0, limit)
    .map(toFeedStatement);
}

/** Cartes approuvees sur lesquelles ce device n'a pas encore vote. */
export async function getFeed(
  deviceId: string,
  limit = FEED_LIMIT,
): Promise<FeedStatement[]> {
  if (!isSupabaseConfigured) return demoFeed(deviceId, limit);

  try {
    if (rpcAvailable !== false) {
      const { data, error } = await supabaseAdmin().rpc("feed_statements", {
        p_device_id: deviceId,
        p_limit: limit,
      });

      if (!error) {
        rpcAvailable = true;
        return ((data ?? []) as Statement[]).map(toFeedStatement);
      }
      if (error.code !== FN_MISSING) throw new Error(error.message);
      rpcAvailable = false;
    }
    return await feedViaRest(deviceId, limit);
  } catch (error) {
    console.error("[feed]", error);
    return demoFeed(deviceId, limit);
  }
}

// ------------------------------------------------------------ vote

async function voteViaRest(
  statementId: string,
  deviceId: string,
  vote: VoteChoice,
): Promise<VoteResult> {
  const db = supabaseAdmin();

  const { error: insertError } = await db
    .from("votes")
    .insert({ statement_id: statementId, device_id: deviceId, vote });

  // 23505 = violation d'unicite : ce device avait deja vote sur cette carte.
  const already = insertError?.code === "23505";
  if (insertError && !already) throw new Error(insertError.message);

  // Les compteurs sont maintenus par le trigger `votes_sync_counters`
  // (voir schema.sql) : l'app ne fait qu'inserer, puis relire le total a jour.
  const { data: row, error } = await db
    .from("statements")
    .select("votes_agree, votes_disagree")
    .eq("id", statementId)
    .single();

  if (error || !row) throw new Error(error?.message ?? "Carte introuvable");

  // En cas de revote, le camp affiche doit etre celui du vote deja enregistre.
  let effective = vote;
  if (already) {
    const { data: existing } = await db
      .from("votes")
      .select("vote")
      .eq("statement_id", statementId)
      .eq("device_id", deviceId)
      .single();
    if (existing?.vote) effective = existing.vote as VoteChoice;
  }

  return buildResult(row.votes_agree, row.votes_disagree, effective, already);
}

/** Enregistre un vote (un seul par carte et par device) et renvoie les totaux. */
export async function castVote(
  statementId: string,
  deviceId: string,
  vote: VoteChoice,
): Promise<VoteResult> {
  if (!isSupabaseConfigured) return demoVote(statementId, deviceId, vote);

  if (rpcAvailable !== false) {
    const { data, error } = await supabaseAdmin().rpc("cast_vote", {
      p_statement_id: statementId,
      p_device_id: deviceId,
      p_vote: vote,
    });

    if (!error) {
      rpcAvailable = true;
      const row = (
        data as {
          out_agree: number;
          out_disagree: number;
          out_already: boolean;
          out_vote: VoteChoice | null;
        }[]
      )?.[0];
      if (!row) throw new Error("Carte introuvable");
      return buildResult(
        row.out_agree,
        row.out_disagree,
        row.out_vote ?? vote,
        row.out_already,
      );
    }
    if (error.code !== FN_MISSING) throw new Error(error.message);
    rpcAvailable = false;
  }

  return voteViaRest(statementId, deviceId, vote);
}
