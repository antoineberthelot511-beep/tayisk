"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { renderStory, type StoryResult } from "@/lib/story";
import type { FeedStatement, Lang } from "@/lib/types";

type Phase = "idle" | "working" | "error";

export default function ShareButton({
  statement,
  lang,
  result,
  variant = "full",
}: {
  statement: FeedStatement;
  lang: Lang;
  result?: StoryResult;
  variant?: "full" | "icon";
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const copy = t(lang);

  async function handleShare() {
    if (phase === "working") return;
    setPhase("working");

    try {
      const blob = await renderStory(statement, lang, result);
      const file = new File([blob], "opinion.png", { type: "image/png" });

      // Partage natif : c'est ce qui fait apparaitre Instagram / Snapchat
      // dans le selecteur du telephone.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        // Desktop et navigateurs sans partage de fichiers : telechargement.
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "opinion.png";
        link.click();
        URL.revokeObjectURL(url);
      }
      setPhase("idle");
    } catch (error) {
      // L'utilisateur qui ferme le selecteur de partage n'est pas une erreur.
      if (error instanceof DOMException && error.name === "AbortError") {
        setPhase("idle");
        return;
      }
      console.error("[share]", error);
      setPhase("error");
    }
  }

  // Le parent est cliquable (carte swipable, overlay qui passe a la suivante) :
  // sans arret de propagation, partager ferait aussi avancer le feed.
  const onClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    void handleShare();
  };

  const icon = (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M12 16V4m0 0L8 8m4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onClick}
        // Sans ca, le geste demarre un swipe de la carte au lieu d'un clic.
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={copy.share}
        title={copy.share}
        className="rounded-full border border-paper/20 p-2 text-paper/60 transition-colors hover:border-paper/50 hover:text-paper disabled:opacity-40"
        disabled={phase === "working"}
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      disabled={phase === "working"}
      className="eyebrow flex items-center justify-center gap-2 rounded-2xl border border-paper/25 py-3.5 text-paper/85 transition-colors hover:border-paper/60 hover:text-paper disabled:opacity-40"
    >
      {icon}
      {phase === "working" ? "…" : phase === "error" ? "Réessayer" : copy.share}
    </button>
  );
}
