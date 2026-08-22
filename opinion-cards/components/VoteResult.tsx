"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import ShareButton from "./ShareButton";
import { t } from "@/lib/i18n";
import type { FeedStatement, Lang, VoteChoice, VoteResult as Result } from "@/lib/types";

/**
 * Compteur anime de 0 a `value`. Une duree nulle donne la valeur finale des
 * la premiere frame, ce qui couvre le mode "mouvement reduit".
 *
 * L'etat part toujours de 0, y compris cote serveur : une valeur initiale
 * dependante du client casserait l'hydratation.
 */
function useCountUp(value: number, duration: number) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let frame = 0;
    let start: number | null = null;

    const step = (ts: number) => {
      start ??= ts;
      const p = duration <= 0 ? 1 : Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(value * eased));
      if (p < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return shown;
}

export default function VoteResult({
  statement,
  result,
  vote,
  lang,
  onNext,
}: {
  statement: FeedStatement;
  result: Result;
  vote: VoteChoice;
  lang: Lang;
  onNext: () => void;
}) {
  const copy = t(lang);
  const reduced = useReducedMotion() ?? false;
  const userPct = vote === "agree" ? result.agree_pct : 100 - result.agree_pct;
  const shown = useCountUp(userPct, reduced ? 0 : 700);
  const accent = vote === "agree" ? "text-agree" : "text-disagree";

  // Meme etat initial serveur et client (sinon l'hydratation echoue) : seule
  // la transition change, instantanee en mode "mouvement reduit".
  const reveal = (delay: number, from: { y?: number } = {}) => ({
    initial: { opacity: 0, ...from },
    animate: { opacity: 1, y: 0 },
    transition: reduced ? { duration: 0 } : { delay },
  });

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={copy.tapToContinue}
      onClick={onNext}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onNext();
      }}
      {...reveal(0)}
      className="absolute inset-0 flex cursor-pointer flex-col justify-center gap-7 bg-ink/92 px-7 backdrop-blur-sm"
    >
      <div>
        <motion.p
          {...reveal(0.06, { y: 14 })}
          className={`font-display text-[clamp(4.5rem,22vw,7rem)] leading-[0.85] ${accent}`}
        >
          {shown}%
        </motion.p>
        <motion.p
          {...reveal(0.14, { y: 14 })}
          className="mt-3 font-display text-[clamp(1.35rem,5.6vw,1.9rem)] leading-tight text-paper"
        >
          {copy.verdict(userPct, result.is_majority, vote)}
        </motion.p>
      </div>

      {/* Repartition globale des votes */}
      <motion.div {...reveal(0.2)} className="space-y-3">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-paper/12">
          <motion.div
            className="bg-agree"
            initial={{ width: "50%" }}
            animate={{ width: `${result.agree_pct}%` }}
            transition={
              reduced ? { duration: 0 } : { delay: 0.24, duration: 0.6, ease: "easeOut" }
            }
          />
          <div className="flex-1 bg-disagree" />
        </div>
        <div className="flex justify-between">
          <span className="eyebrow text-agree">
            {copy.agree} {result.agree_pct}%
          </span>
          <span className="eyebrow text-disagree">
            {copy.disagree} {100 - result.agree_pct}%
          </span>
        </div>
      </motion.div>

      <motion.div {...reveal(0.5)} className="grid gap-3">
        <ShareButton
          statement={statement}
          lang={lang}
          result={{
            agreePct: result.agree_pct,
            vote,
            isMajority: result.is_majority,
            caption: copy.verdict(userPct, result.is_majority, vote),
          }}
        />
        <p className="eyebrow text-center text-paper/40">{copy.tapToContinue}</p>
      </motion.div>
    </motion.div>
  );
}
