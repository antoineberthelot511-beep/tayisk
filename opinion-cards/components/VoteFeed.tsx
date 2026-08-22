"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import VoteCard from "./VoteCard";
import VoteResult from "./VoteResult";
import { useDeviceId } from "@/lib/device";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/use-lang";
import type { FeedStatement, Lang, VoteChoice, VoteResult as Result } from "@/lib/types";

const PREFETCH_WHEN_UNDER = 4;
const AUTO_ADVANCE_MS = 4500;

export default function VoteFeed({ initial }: { initial: FeedStatement[] }) {
  const [queue, setQueue] = useState<FeedStatement[]>(initial);
  const lang = useLang();
  const deviceId = useDeviceId();
  const [vote, setVote] = useState<VoteChoice | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const loadingRef = useRef(false);

  const copy = t(lang);
  const current = queue[0];
  const upcoming = queue.slice(1, 3);
  const exitDir = vote === "agree" ? 1 : -1;

  const loadMore = useCallback(async () => {
    if (loadingRef.current || exhausted || !deviceId) return;
    loadingRef.current = true;
    try {
      const res = await fetch(
        `/api/statements?device=${encodeURIComponent(deviceId)}&limit=10`,
      );
      const data: { statements?: FeedStatement[] } = await res.json();
      const incoming = data.statements ?? [];

      // Le serveur exclut deja les cartes votees : une reponse vide veut dire
      // qu'il n'y a plus rien a proposer a ce device.
      if (incoming.length === 0) setExhausted(true);

      setQueue((q) => {
        const seen = new Set(q.map((s) => s.id));
        return [...q, ...incoming.filter((s) => !seen.has(s.id))];
      });
    } catch (error) {
      console.error("[feed] chargement:", error);
    } finally {
      loadingRef.current = false;
    }
  }, [deviceId, exhausted]);

  // Recharge quand la pile s'epuise. Le fetch est repousse hors de la phase
  // de commit : les mises a jour d'etat qu'il declenche ne doivent pas
  // s'enchainer sur le rendu en cours.
  useEffect(() => {
    if (queue.length >= PREFETCH_WHEN_UNDER) return;
    const timer = setTimeout(() => void loadMore(), 0);
    return () => clearTimeout(timer);
  }, [queue.length, loadMore]);

  const advance = useCallback(() => {
    setQueue((q) => q.slice(1));
    setResult(null);
    setVote(null);
  }, []);

  // Passage automatique a la carte suivante apres le reveal
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(advance, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [result, advance]);

  async function handleVote(choice: VoteChoice) {
    if (!current || result) return;

    // Reveal immediat a partir des compteurs connus ; l'appel reseau ne fait
    // que reconcilier ensuite avec le vrai total.
    const agree = current.votes_agree + (choice === "agree" ? 1 : 0);
    const disagree = current.votes_disagree + (choice === "disagree" ? 1 : 0);
    const total = agree + disagree;
    const agreePct = total === 0 ? 50 : Math.round((agree / total) * 100);
    const userPct = choice === "agree" ? agreePct : 100 - agreePct;

    setVote(choice);
    setResult({
      votes_agree: agree,
      votes_disagree: disagree,
      agree_pct: agreePct,
      is_majority: userPct >= 50,
      already_voted: false,
    });

    // Vibration courte quand on se retrouve dans la minorite
    if (userPct < 50 && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(18);
    }

    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          statement_id: current.id,
          device_id: deviceId,
          vote: choice,
        }),
      });
      if (res.ok) setResult((await res.json()) as Result);
    } catch (error) {
      console.error("[vote]", error);
    }
  }

  return (
    <main className="mx-auto flex h-screen-safe w-full max-w-md flex-col px-5 pt-5 pb-6">
      <header className="flex items-center justify-between">
        <span className="font-display text-xl tracking-tight">
          Opinion<span className="text-agree">.</span>
        </span>
        <nav className="flex items-center gap-2">
          <Link
            href="/profil"
            aria-label={copy.profile}
            title={copy.profile}
            className="rounded-full border border-paper/20 p-2 text-paper/60 transition-colors hover:border-paper/50 hover:text-paper"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
              <path
                d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <Link
            href="/creer"
            className="eyebrow rounded-full border border-paper/20 px-3.5 py-2 text-paper/70 transition-colors hover:border-paper/50 hover:text-paper"
          >
            {copy.createShort}
          </Link>
        </nav>
      </header>

      <div className="relative my-5 flex-1">
        {/* Cartes suivantes : donnent la profondeur et prechargent les images */}
        {upcoming
          .map((s, i) => (
            <div
              key={s.id}
              aria-hidden
              className="absolute inset-0"
              style={{
                transform: `translateY(${(i + 1) * 10}px) scale(${1 - (i + 1) * 0.035})`,
                opacity: 0.55 - i * 0.2,
              }}
            >
              <VoteCard statement={s} lang={lang} />
            </div>
          ))
          .reverse()}

        <AnimatePresence mode="popLayout">
          {current ? (
            <motion.div
              key={current.id}
              className="absolute inset-0"
              // Pas de fondu a l'entree : une carte semi-transparente laisserait
              // voir la pile juste derriere elle.
              initial={{ scale: 0.965, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{
                x: exitDir * 560,
                rotate: exitDir * 16,
                opacity: 0,
                transition: { duration: 0.34, ease: "easeIn" },
              }}
              transition={{ duration: 0.26 }}
            >
              <VoteCard
                statement={current}
                lang={lang}
                onVote={handleVote}
                locked={Boolean(result)}
              >
                {result && vote && (
                  <VoteResult
                    statement={current}
                    result={result}
                    vote={vote}
                    lang={lang}
                    onNext={advance}
                  />
                )}
              </VoteCard>
            </motion.div>
          ) : (
            <EmptyState key="empty" lang={lang} />
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleVote("disagree")}
          disabled={!current || Boolean(result)}
          className="eyebrow rounded-2xl border-2 border-disagree/60 py-4 text-disagree transition-all active:scale-95 disabled:opacity-30 hover:border-disagree hover:bg-disagree/10"
        >
          {copy.disagree}
        </button>
        <button
          type="button"
          onClick={() => handleVote("agree")}
          disabled={!current || Boolean(result)}
          className="eyebrow rounded-2xl border-2 border-agree/60 py-4 text-agree transition-all active:scale-95 disabled:opacity-30 hover:border-agree hover:bg-agree/10"
        >
          {copy.agree}
        </button>
      </div>
    </main>
  );
}

function EmptyState({ lang }: { lang: Lang }) {
  const copy = t(lang);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[28px] border border-paper/10 px-8 text-center"
    >
      <p className="font-display text-3xl leading-tight">{copy.done}</p>
      <p className="text-sm text-paper/50">{copy.doneSub}</p>
      <Link
        href="/creer"
        className="eyebrow mt-2 rounded-full bg-agree px-5 py-3 text-ink"
      >
        {copy.create}
      </Link>
    </motion.div>
  );
}
