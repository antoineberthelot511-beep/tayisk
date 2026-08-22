"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { renderStory, type StoryResult } from "@/lib/story";
import type { FeedStatement, Lang } from "@/lib/types";

type Phase = "idle" | "working" | "retry" | "unsupported";

function download(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  // Liberer l'URL tout de suite annulerait le telechargement sur certains
  // navigateurs : on laisse le temps au transfert de demarrer.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

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
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  // Le bouton du resultat est le chemin de partage principal : on compose son
  // image tout de suite. L'icone sur la carte, elle, attend un debut
  // d'interaction pour ne pas composer une story a chaque carte affichee.
  const [armed, setArmed] = useState(variant === "full");
  const copy = t(lang);

  // Composer a l'avance est ce qui permet d'appeler navigator.share() de
  // maniere synchrone au clic : apres un await, iOS Safari considere
  // l'activation utilisateur expiree et refuse le partage.
  useEffect(() => {
    if (!armed) return;
    let cancelled = false;

    renderStory(statement, lang, result)
      .then((blob) => {
        if (!cancelled) setFile(new File([blob], "opinion.png", { type: "image/png" }));
      })
      .catch((error) => console.error("[share] composition", error));

    return () => {
      cancelled = true;
    };
  }, [armed, statement, lang, result]);

  /** Declenche la composition des le premier signe d'interaction. */
  const arm = () => setArmed(true);

  function handleShare(event: React.MouseEvent) {
    // Le parent est cliquable (carte swipable, overlay qui passe a la
    // suivante) : sans arret de propagation, partager ferait aussi avancer.
    event.stopPropagation();

    if (!file) {
      // Composition pas encore prete : elle demarre ici, le prochain tap
      // trouvera l'image disponible.
      setArmed(true);
      setPhase("working");
      return;
    }

    // Le partage de fichiers exige un contexte securise : en HTTP simple
    // (test depuis un telephone sur l'IP locale) l'API n'existe pas.
    if (!navigator.canShare?.({ files: [file] })) {
      download(file);
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setPhase("unsupported");
      }
      return;
    }

    navigator
      .share({ files: [file] })
      .then(() => setPhase("idle"))
      .catch((error: unknown) => {
        // Fermer le selecteur de partage n'est pas une erreur.
        if (error instanceof DOMException && error.name === "AbortError") {
          setPhase("idle");
          return;
        }
        console.error("[share]", error);
        setPhase("retry");
      });
  }

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
        onClick={handleShare}
        // Sans ca, le geste demarre un swipe de la carte au lieu d'un clic.
        onPointerDown={(e) => {
          e.stopPropagation();
          arm();
        }}
        onPointerEnter={arm}
        onFocus={arm}
        aria-label={copy.share}
        title={copy.share}
        className="rounded-full border border-paper/20 p-2 text-paper/60 transition-colors hover:border-paper/50 hover:text-paper"
      >
        {icon}
      </button>
    );
  }

  const label =
    phase === "working"
      ? copy.sharePreparing
      : phase === "retry"
        ? copy.shareRetry
        : copy.share;

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleShare}
        onPointerDown={(e) => e.stopPropagation()}
        className="eyebrow flex items-center justify-center gap-2 rounded-2xl border border-paper/25 py-3.5 text-paper/85 transition-colors hover:border-paper/60 hover:text-paper"
      >
        {icon}
        {label}
      </button>
      {phase === "unsupported" && (
        <p className="text-center text-xs text-paper/45">{copy.shareNeedsHttps}</p>
      )}
    </div>
  );
}
