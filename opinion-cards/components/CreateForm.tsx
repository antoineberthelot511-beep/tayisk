"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { rememberStatement } from "@/lib/mine";
import type { Suggestion } from "@/app/api/spellcheck/route";

const MAX_LENGTH = 200;
const SPELLCHECK_DELAY = 900;

type Sent =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "done"; pending: boolean }
  | { state: "error"; message: string };

export default function CreateForm() {
  const [text, setText] = useState("");
  const [keyword, setKeyword] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [sent, setSent] = useState<Sent>({ state: "idle" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const remaining = MAX_LENGTH - text.length;
  const tooShort = text.trim().length < 3;
  const busy = sent.state === "sending";

  // Les suggestions portent sur le texte au moment de la requete : sous le
  // seuil, on les masque plutot que de les effacer depuis un effet.
  const visibleSuggestions = text.trim().length < 4 ? [] : suggestions;

  // Correction orthographique, apres une pause dans la frappe
  useEffect(() => {
    if (text.trim().length < 4) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/spellcheck", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
        const data: { suggestions?: Suggestion[] } = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        // Correction indisponible : on n'affiche simplement rien.
      }
    }, SPELLCHECK_DELAY);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  /** Applique une correction en respectant les decalages deja appliques. */
  function applySuggestion(target: Suggestion) {
    setText(
      (current) =>
        current.slice(0, target.offset) +
        target.replacement +
        current.slice(target.offset + target.length),
    );
    setSuggestions((all) => all.filter((s) => s.offset !== target.offset));
    textareaRef.current?.focus();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (tooShort || busy) return;

    setSent({ state: "sending" });
    try {
      const res = await fetch("/api/statements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, keyword: keyword.trim() || undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSent({ state: "error", message: data.error ?? "Échec de l'envoi." });
        return;
      }
      // Sans compte, c'est ce qui rattache la carte a l'appareil pour /profil.
      if (typeof data.id === "string") rememberStatement(data.id);

      setSent({ state: "done", pending: data.status === "pending" });
      setText("");
      setKeyword("");
      setSuggestions([]);
    } catch {
      setSent({ state: "error", message: "Réseau indisponible. Réessaie." });
    }
  }

  if (sent.state === "done") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <p className="font-display text-4xl leading-tight">
          {sent.pending ? "Envoyée pour relecture" : "Ta carte est en ligne"}
        </p>
        <p className="max-w-xs text-sm text-paper/50">
          {sent.pending
            ? "Elle apparaîtra dans le flux une fois validée."
            : "Elle vient d'entrer dans le flux de vote."}
        </p>
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={() => setSent({ state: "idle" })}
            className="eyebrow rounded-full border border-paper/25 px-5 py-3 text-paper/80"
          >
            En proposer une autre
          </button>
          <Link href="/" className="eyebrow rounded-full bg-agree px-5 py-3 text-ink">
            Retour au flux
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
      {/* Le champ de saisie EST la carte : ce qu'on ecrit est ce qu'on verra */}
      <div className="relative flex-1 overflow-hidden rounded-[28px] bg-linear-to-b from-ink-2 to-ink">
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 left-6 font-display text-[7rem] leading-none text-paper/12"
        >
          &ldquo;
        </span>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
          maxLength={MAX_LENGTH}
          autoFocus
          placeholder="Écris une opinion tranchée, celle qui divise à table…"
          aria-label="Ton opinion"
          className="absolute inset-0 h-full w-full resize-none bg-transparent p-7 pt-24 font-display text-[clamp(1.7rem,6.5vw,2.4rem)] leading-[1.12] text-paper outline-none placeholder:text-paper/25"
        />
        <span
          className={`eyebrow absolute right-6 bottom-6 ${
            remaining < 20 ? "text-disagree" : "text-paper/35"
          }`}
        >
          {remaining}
        </span>
      </div>

      {visibleSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow text-paper/40">Corriger :</span>
          {visibleSuggestions.map((s) => (
            <button
              key={`${s.offset}-${s.replacement}`}
              type="button"
              onClick={() => applySuggestion(s)}
              title={s.message}
              className="rounded-full border border-paper/20 px-3 py-1.5 text-sm text-paper/80 transition-colors hover:border-agree hover:text-agree"
            >
              <span className="line-through opacity-50">{s.original}</span>{" "}
              {s.replacement}
            </button>
          ))}
        </div>
      )}

      <label className="flex items-center gap-3 rounded-2xl border border-paper/12 px-4 py-3">
        <span className="eyebrow shrink-0 text-paper/40">Image</span>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="mot-clé (auto si vide)"
          className="w-full bg-transparent text-sm outline-none placeholder:text-paper/25"
        />
      </label>

      {sent.state === "error" && (
        <p role="alert" className="text-sm text-disagree">
          {sent.message}
        </p>
      )}

      <button
        type="submit"
        disabled={tooShort || busy}
        className="eyebrow rounded-2xl bg-agree py-4 text-ink transition-opacity disabled:opacity-25"
      >
        {busy ? "Envoi…" : "Publier"}
      </button>
    </form>
  );
}
