"use client";

import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, type Category, type Statement, type VoteResult, type VoteType } from "@/lib/types";
import { getSessionUser } from "@/lib/auth-client";
import ShareButton from "./ShareButton";

type Phase = "voting" | "result";

export default function VoteCard({ deviceId }: { deviceId: string }) {
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("voting");
  const [myVote, setMyVote] = useState<VoteType | null>(null);
  const [result, setResult] = useState<VoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | "all">("all");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getSessionUser().then((u) => setUserId(u?.id ?? null));
  }, []);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPhase("voting");
    setMyVote(null);
    setResult(null);
    try {
      const res = await fetch(`/api/statements/next?deviceId=${deviceId}&category=${category}`);
      const json = await res.json();
      setStatement(json.statement ?? null);
    } catch {
      setError("Impossible de charger les cartes.");
    } finally {
      setLoading(false);
    }
  }, [deviceId, category]);

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  async function vote(v: VoteType) {
    if (!statement || phase !== "voting") return;
    setMyVote(v);
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, statementId: statement.id, vote: v, userId }),
      });
      if (res.status === 409) {
        setError("Vous avez déjà voté pour cette carte.");
        setTimeout(loadNext, 1500);
        return;
      }
      const json: VoteResult = await res.json();
      setResult(json);
      setPhase("result");
      // Passage automatique après 3.5s
      setTimeout(() => loadNext(), 3500);
    } catch {
      setError("Erreur lors du vote.");
      setMyVote(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center rounded-3xl bg-neutral-100 dark:bg-neutral-900">
        <p className="animate-pulse text-neutral-500">Chargement…</p>
      </div>
    );
  }

  if (!statement) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 rounded-3xl bg-neutral-100 p-8 text-center dark:bg-neutral-900">
        <p className="text-lg font-semibold">Vous avez voté sur toutes les cartes ! 🎉</p>
        <button
          onClick={loadNext}
          className="rounded-full bg-black px-6 py-2 text-white dark:bg-white dark:text-black"
        >
          Rafraîchir
        </button>
      </div>
    );
  }

  const total = statement.votes_agree + statement.votes_disagree;
  const agreePct = total > 0 ? Math.round((statement.votes_agree / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Filtres catégories */}
      <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
        {[{ value: "all" as const, label: "Tout" }, ...CATEGORIES].map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 font-medium transition ${
              category === c.value
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div
        className="relative flex h-[65vh] flex-col overflow-hidden rounded-3xl bg-cover bg-center shadow-xl"
      style={
        statement.image_url
          ? { backgroundImage: `url(${statement.image_url})` }
          : { background: "linear-gradient(135deg,#1e1b4b,#7c3aed 50%,#db2777)" }
      }
    >
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 p-6 text-white">
        {statement.category && statement.category !== "autre" && (
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs backdrop-blur">
            {CATEGORIES.find((c) => c.value === statement.category)?.label}
          </span>
        )}
        <p className="max-w-md text-center text-2xl font-bold leading-snug drop-shadow md:text-3xl">
          « {statement.text} »
        </p>

        {phase === "voting" ? (
          <div className="flex w-full max-w-sm gap-4">
            <button
              onClick={() => vote("agree")}
              className={`flex-1 rounded-2xl py-4 text-lg font-semibold transition ${
                myVote === "agree" ? "scale-95 bg-emerald-500" : "bg-emerald-600 hover:bg-emerald-500"
              }`}
            >
              👍 D'accord
            </button>
            <button
              onClick={() => vote("disagree")}
              className={`flex-1 rounded-2xl py-4 text-lg font-semibold transition ${
                myVote === "disagree" ? "scale-95 bg-rose-500" : "bg-rose-600 hover:bg-rose-500"
              }`}
            >
              👎 Pas d'accord
            </button>
          </div>
        ) : (
          result && (
            <div className="w-full max-w-sm rounded-2xl bg-black/60 p-5 text-center backdrop-blur">
              <div className="mb-3 flex h-3 overflow-hidden rounded-full">
                <div className="bg-emerald-500" style={{ width: `${result.agree_pct}%` }} />
                <div className="bg-rose-500" style={{ width: `${result.disagree_pct}%` }} />
              </div>
              <p className="text-lg font-bold">
                {result.agree_pct}% d'accord · {result.disagree_pct}% pas d'accord
              </p>
              <p className="mt-2 text-sm opacity-90">
                {result.in_majority
                  ? `✅ Tu fais partie de la majorité (${Math.max(result.agree_pct, result.disagree_pct)}% des gens pensent comme toi)`
                  : `🎯 Tu fais partie des ${Math.min(result.agree_pct, result.disagree_pct)}% qui ont un avis minoritaire`}
              </p>
              <p className="mt-2 text-xs opacity-60">Carte suivante…</p>
            </div>
          )
        )}

        {error && <p className="text-sm text-red-300">{error}</p>}

        <div className="mt-auto flex w-full max-w-sm items-center justify-between text-xs opacity-75">
          <span>{total} votes</span>
          <ShareButton text={statement.text} imageUrl={statement.image_url} />
        </div>
        </div>
      </div>
    </div>
  );
}
