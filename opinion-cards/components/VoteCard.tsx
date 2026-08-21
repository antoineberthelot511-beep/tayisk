"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { CATEGORIES, type Category, type Statement, type VoteResult, type VoteType } from "@/lib/types";
import { getSessionUser } from "@/lib/auth-client";
import ShareButton from "./ShareButton";
import Confetti from "./Confetti";
import LiveVotes from "./LiveVotes";
import { useCountUp } from "./CountUp";

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 500;
const BUFFER_REFILL = 5;

type Phase = "voting" | "result";

export default function VoteCard({ deviceId }: { deviceId: string }) {
  const reduced = useReducedMotion() ?? false;
  const [buffer, setBuffer] = useState<Statement[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [phase, setPhase] = useState<Phase>("voting");
  const [myVote, setMyVote] = useState<VoteType | null>(null);
  const [result, setResult] = useState<VoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | "all">("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionVotes, setSessionVotes] = useState(0);
  const [showBadge, setShowBadge] = useState(false);
  const [revealOrder, setRevealOrder] = useState<"pct" | "text">("text");
  const votingRef = useRef(false);

  // --- Chargement du buffer (feed infini) ---
  const loadBatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/statements/batch?deviceId=${deviceId}&category=${category}`);
      const json = await res.json();
      if (Array.isArray(json.statements) && json.statements.length > 0) {
        setBuffer((prev) => {
          const seen = new Set(prev.map((s) => s.id));
          return [...prev, ...json.statements.filter((s: Statement) => !seen.has(s.id))];
        });
      }
    } catch {
      setError("Impossible de charger les cartes.");
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [deviceId, category]);

  useEffect(() => {
    getSessionUser().then((u) => setUserId(u?.id ?? null));
  }, []);

  useEffect(() => {
    setLoading(true);
    setBuffer([]);
    setIndex(0);
    loadBatch();
  }, [loadBatch]);

  const current = buffer[index];
  const next = buffer[index + 1];

  // Recharge quand il reste ≤5 cartes dans le buffer (jamais de fin de liste)
  useEffect(() => {
    if (!loading && buffer.length - index <= BUFFER_REFILL) loadBatch();
  }, [buffer.length, index, loading, loadBatch]);

  // Préchargement des images n+1 / n+2 (zéro flash pendant le swipe)
  useEffect(() => {
    for (const s of [buffer[index + 1], buffer[index + 2]]) {
      if (s?.image_url) {
        const img = new Image();
        img.src = s.image_url;
      }
    }
  }, [buffer, index]);

  // --- Vote (optimistic UI + haptique + variable reward) ---
  const advance = useCallback(() => {
    setTimeout(() => {
      setPhase("voting");
      setMyVote(null);
      setResult(null);
      votingRef.current = false;
      setIndex((i) => i + 1);
    }, reduced ? 1800 : 3200);
  }, [reduced]);

  const vote = useCallback(
    (v: VoteType) => {
      if (!current || votingRef.current) return;
      votingRef.current = true;
      // Feedback instantané (<100ms) : état visuel avant la réponse serveur
      setMyVote(v);
      setSessionVotes((n) => n + 1);
      localStorage.setItem("oc_last_vote_at", String(Date.now()));

      // Variable reward : ordre de révélation aléatoire + badge rare (1/20)
      setRevealOrder(Math.random() < 0.35 ? "pct" : "text");
      if (!reduced && Math.random() < 0.05) setShowBadge(true);

      fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, statementId: current.id, vote: v, userId }),
      })
        .then(async (res) => {
          if (res.status === 409) {
            setError("Déjà voté");
            advance();
            return;
          }
          const json: VoteResult = await res.json();
          // Haptique courte (10ms) si minorité — surprise émotionnelle
          if (!json.in_majority && typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(10);
          }
          setResult(json);
          setPhase("result");
          advance();
        })
        .catch(() => {
          setError("Erreur réseau");
          votingRef.current = false;
          setMyVote(null);
        });
    },
    [current, deviceId, userId, advance, reduced]
  );

  // Swipe physique : distance OU vélocité (momentum Tinder)
  const onDragEnd = useCallback(
    (_e: unknown, info: PanInfo) => {
      if (phase !== "voting") return;
      if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) vote("agree");
      else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) vote("disagree");
    },
    [phase, vote]
  );

  // --- Rendus ---
  if (loading && firstLoad) {
    return (
      <div className="flex h-[65vh] items-center justify-center rounded-3xl bg-neutral-100 dark:bg-neutral-900">
        <p className="animate-pulse text-neutral-500">Chargement…</p>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex flex-col gap-3">
        <CategoryChips category={category} setCategory={setCategory} />
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 rounded-3xl bg-neutral-100 p-8 text-center dark:bg-neutral-900">
          <p className="text-lg font-semibold">{error ?? "Plus de cartes pour le moment 🎉"}</p>
          <button onClick={() => loadBatch()} className="rounded-full bg-black px-6 py-2 text-white dark:bg-white dark:text-black">
            Rafraîchir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-3" style={{ touchAction: "pan-y" }}>
      <CategoryChips category={category} setCategory={setCategory} />
      <SessionBarLite votes={sessionVotes} />

      {/* Pile : la carte suivante visible derrière pendant le swipe */}
      <div className="relative h-[58vh]">
        {next && !reduced && (
          <div className="absolute inset-x-0 top-2 mx-auto h-full w-full scale-[0.95] opacity-50">
            <CardFace s={next} overlay />
          </div>
        )}

        <AnimatePresence initial={false}>
          <motion.div
            key={current.id}
            drag={phase === "voting" ? "x" : false}
            dragElastic={0.7}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={onDragEnd}
            exit={{
              x: myVote === "agree" ? 500 : myVote === "disagree" ? -500 : 0,
              rotate: myVote === "agree" ? 18 : -18,
              opacity: 0,
              transition: { duration: 0.25 },
            }}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            style={{ willChange: "transform" }}
          >
            <CardFace
              s={current}
              phase={phase}
              myVote={myVote}
              result={result}
              error={error}
              onVote={vote}
              revealOrder={revealOrder}
            />
            {phase === "result" && result && (result.agree_pct > 95 || result.disagree_pct > 95) && (
              <Confetti reduced={reduced} />
            )}
            {showBadge && phase === "result" && (
              <motion.div
                initial={{ scale: 0, y: 40 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                onAnimationComplete={() => setTimeout(() => setShowBadge(false), 2500)}
                className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1.5 text-sm font-extrabold text-white shadow-lg"
              >
                ⭐ Carte rare débloquée !
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex w-full max-w-sm gap-4 self-center">
        <button
          onClick={() => vote("agree")}
          className={`flex-1 rounded-2xl py-3.5 text-lg font-semibold transition-transform duration-75 ${
            myVote === "agree" ? "scale-90 bg-emerald-400" : "bg-emerald-600 hover:bg-emerald-500"
          }`}
        >
          👍 D'accord
        </button>
        <button
          onClick={() => vote("disagree")}
          className={`flex-1 rounded-2xl py-3.5 text-lg font-semibold transition-transform duration-75 ${
            myVote === "disagree" ? "scale-90 bg-rose-400" : "bg-rose-600 hover:bg-rose-500"
          }`}
        >
          👎 Pas d'accord
        </button>
      </div>
      <Link href="/tendances" className="self-center text-xs text-neutral-400 hover:underline">🔥 voir les tendances</Link>
    </div>
  );
}

/* ---------- Sous-composants ---------- */

function CategoryChips({
  category,
  setCategory,
}: {
  category: Category | "all";
  setCategory: (c: Category | "all") => void;
}) {
  return (
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
  );
}

function SessionBarLite({ votes }: { votes: number }) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={votes}
          initial={votes > 0 ? { scale: 1.35 } : false}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
          className="rounded-full bg-neutral-200 px-2 py-0.5 font-semibold dark:bg-neutral-800"
        >
          🗳️ {votes} cette session
        </motion.span>
      </AnimatePresence>
      <Link href="/profil" className="ml-auto hover:underline">👤 profil</Link>
    </div>
  );
}

function CardFace({
  s,
  phase = "voting",
  myVote = null,
  result = null,
  error = null,
  onVote,
  revealOrder = "text",
  overlay = false,
}: {
  s: Statement;
  phase?: Phase;
  myVote?: VoteType | null;
  result?: VoteResult | null;
  error?: string | null;
  onVote?: (v: VoteType) => void;
  revealOrder?: "pct" | "text";
  overlay?: boolean;
}) {
  if (overlay) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center overflow-hidden rounded-3xl bg-cover bg-center shadow-xl"
        style={
          s.image_url
            ? { backgroundImage: `url(${s.image_url})` }
            : { background: "linear-gradient(135deg,#1e1b4b,#7c3aed 50%,#db2777)" }
        }
      >
        <div className="absolute inset-0 bg-black/60" />
        <p className="relative z-10 max-w-md px-6 text-center text-xl font-bold text-white opacity-90">« {s.text} »</p>
      </div>
    );
  }

  const totalVotes = s.votes_agree + s.votes_disagree;

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-cover bg-center shadow-xl"
      style={
        s.image_url
          ? { backgroundImage: `url(${s.image_url})` }
          : { background: "linear-gradient(135deg,#1e1b4b,#7c3aed 50%,#db2777)" }
      }
    >
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 p-6 text-white">
        {s.category && s.category !== "autre" && (
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs backdrop-blur">
            {CATEGORIES.find((c) => c.value === s.category)?.label}
          </span>
        )}
        <p className="max-w-md text-center text-2xl font-bold leading-snug drop-shadow md:text-3xl">« {s.text} »</p>

        {phase === "voting" ? (
          <div className="w-full max-w-sm space-y-3 text-center">
            {/* Signaux sociaux : compteur temps réel */}
            <LiveVotes statementId={s.id} base={totalVotes} />
            {myVote && (
              <motion.p
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className={`text-lg font-extrabold ${myVote === "agree" ? "text-emerald-300" : "text-rose-300"}`}
              >
                {myVote === "agree" ? "👍 Enregistré !" : "👎 Enregistré !"}
              </motion.p>
            )}
          </div>
        ) : (
          result && <ResultPanel result={result} revealOrder={revealOrder} />
        )}

        {error && phase === "voting" && <p className="text-sm text-red-300">{error}</p>}

        <div className="mt-auto flex w-full max-w-sm items-center justify-between text-xs opacity-75">
          <span>{totalVotes} votes</span>
          <ShareButton text={s.text} imageUrl={s.image_url} />
        </div>
      </div>
    </div>
  );
}

function ResultPanel({ result, revealOrder }: { result: VoteResult; revealOrder: "pct" | "text" }) {
  const pctValue = result.vote === "agree" ? result.agree_pct : result.disagree_pct;
  const shownPct = useCountUp(result.agree_pct);

  const majorityText = (
    <p className="mt-2 text-sm opacity-90">
      {result.in_majority
        ? `✅ Tu es dans la majorité (${Math.max(result.agree_pct, result.disagree_pct)}% pensent comme toi)`
        : `🎯 Tu fais partie des ${Math.min(result.agree_pct, result.disagree_pct)}% minoritaires`}
    </p>
  );

  return (
    <div className="w-full max-w-sm rounded-2xl bg-black/60 p-5 text-center backdrop-blur">
      <div className="mb-3 flex h-3 overflow-hidden rounded-full">
        <div className="bg-emerald-500" style={{ width: `${shownPct}%` }} />
        <div className="bg-rose-500" style={{ width: `${100 - shownPct}%` }} />
      </div>
      {revealOrder === "pct" ? (
        <>
          <p className="text-lg font-bold">{result.agree_pct}% d'accord · {result.disagree_pct}% pas d'accord</p>
          {majorityText}
        </>
      ) : (
        <>
          {majorityText}
          <p className="mt-2 text-lg font-bold">{result.agree_pct}% d'accord · {result.disagree_pct}% pas d'accord</p>
        </>
      )}
      <p className="mt-2 text-xs opacity-60">Swipe ou attends pour la suite…</p>
    </div>
  );
}
