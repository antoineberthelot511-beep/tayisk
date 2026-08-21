"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/auth-client";

/**
 * Compteur de votes temps réel (Supabase Realtime) pour la carte visible.
 * Un seul channel à la fois : unsubscribe dès que la carte change/sort du viewport
 * (cleanup React), pour préserver le quota du plan gratuit.
 */
export default function LiveVotes({ statementId, base }: { statementId: string; base: number }) {
  const [count, setCount] = useState(base);

  useEffect(() => {
    setCount(base);
    // Les IDs démo ne sont pas des UUIDs → pas de subscription
    if (!/^[0-9a-f-]{36}$/i.test(statementId)) return;

    const channel = supabaseBrowser
      .channel(`votes-${statementId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "votes", filter: `statement_id=eq.${statementId}` },
        () => setCount((c) => c + 1)
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [statementId, base]);

  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={count}
        initial={count !== base ? { scale: 1.3, color: "#6ee7b7" } : false}
        animate={{ scale: 1, color: "#ffffff" }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="inline-block text-sm font-semibold opacity-90"
      >
        ⚡ {count} personnes ont voté
      </motion.span>
    </AnimatePresence>
  );
}
