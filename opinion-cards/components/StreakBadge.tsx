"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getSessionUser, supabaseBrowser } from "@/lib/auth-client";

/**
 * Flamme de streak permanente dans le header.
 - Connecté : streak réel depuis profiles + RPC update_streak
 - Anonyme : série locale (localStorage)
 * Pulsation rouge/orange si pas voté depuis >20h aujourd'hui (danger de rupture).
 */
export default function StreakBadge({ reduced }: { reduced?: boolean }) {
  const [streak, setStreak] = useState(0);
  const [danger, setDanger] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getSessionUser();
      if (u) {
        const { data } = await supabaseBrowser.from("profiles").select("streak_count,last_vote_date").eq("id", u.id).maybeSingle();
        if (data) {
          setStreak(data.streak_count ?? 0);
          const hours = data.last_vote_date
            ? (Date.now() - new Date(data.last_vote_date).getTime()) / 3_600_000
            : 999;
          setDanger(hours >= 20 && hours < 48);
          return;
        }
      }
      // Mode anonyme : série locale
      const last = Number(localStorage.getItem("oc_last_vote_at") ?? 0);
      const days = last ? Math.floor((Date.now() - last) / 86_400_000) : 999;
      const local = Number(localStorage.getItem("oc_local_streak") ?? 0);
      setStreak(last && days <= 1 ? Math.max(local, 1) : 0);
      setDanger(last > 0 && days >= 1 && days < 2);
    })();
  }, []);

  return (
    <motion.span
      animate={danger && !reduced ? { scale: [1, 1.18, 1] } : undefined}
      transition={danger ? { repeat: Infinity, duration: 1.2 } : undefined}
      title={danger ? "Votez aujourd'hui pour garder votre série !" : "Votre série quotidienne"}
      className={`rounded-full px-2 py-1 text-xs font-bold ${
        danger
          ? "bg-orange-500 text-white"
          : "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      }`}
    >
      🔥 {streak}
    </motion.span>
  );
}
