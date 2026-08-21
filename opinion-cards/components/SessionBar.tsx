"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { getSessionUser } from "@/lib/auth-client";

/**
 * Barre de statut permanent : streak quotidien (avec pulsation danger si
 * pas voté depuis >20h aujourd'hui) + compteur de votes de la session.
 */
export default function SessionBar({
  sessionVotes,
  lastVoteAt,
  reduced,
}: {
  sessionVotes: number;
  lastVoteAt: number | null;
  reduced: boolean;
}) {
  // Streak : fetch une fois si connecté ; sinon basé sur localStorage (device)
  // Le composant parent remonte `lastVoteAt` (timestamp du dernier vote local).

  const hoursSinceVote = lastVoteAt ? (Date.now() - lastVoteAt) / 3_600_000 : null;
  const inDanger = hoursSinceVote !== null && hoursSinceVote >= 20 && hoursSinceVote < 48;

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Streak — icône flamme, pulsation rouge/orange en danger */}
      <motion.span
        animate={inDanger && !reduced ? { scale: [1, 1.15, 1] } : undefined}
        transition={inDanger ? { repeat: Infinity, duration: 1.2 } : undefined}
        className={`rounded-full px-2 py-1 font-bold ${
          inDanger
            ? "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400"
            : "bg-neutral-200 dark:bg-neutral-800"
        }`}
        title="Votre série quotidienne"
      >
        🔥 <span className={inDanger ? "animate-pulse" : ""}>!</span>
      </motion.span>

      {/* Compteur de votes de session */}
      <AnimatePresence mode="popLayout">
        <motion.span
          key={sessionVotes}
          initial={{ scale: 1.4 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className="rounded-full bg-neutral-200 px-2 py-1 font-semibold dark:bg-neutral-800"
          title="Votes cette session"
        >
          🗳️ {sessionVotes}
        </motion.span>
      </AnimatePresence>

      <Link href="/profil" className="ml-auto text-neutral-400 hover:text-black dark:hover:text-white">
        profil ›
      </Link>
    </div>
  );
}
