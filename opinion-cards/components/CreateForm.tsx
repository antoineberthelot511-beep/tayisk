"use client";

import { useState } from "react";

import { CATEGORIES, type Category } from "@/lib/types";
import { useDeviceId } from "@/lib/use-device-id";
import { getSessionUser } from "@/lib/auth-client";

const MAX = 200;
const LANGS = [
  { code: "fr", label: "🇫🇷 Français" },
  { code: "en", label: "🇬🇧 English" },
  { code: "es", label: "🇪🇸 Español" },
];

/** Corrections orthographiques basiques (accents courants manquants). */
function basicFix(t: string): string {
  const map: Record<string, string> = { "ca": "ça", "tres": "très", "apres": "après", "etre": "être", "a": "a" };
  return t.replace(/\b(tres|apres|etre)\b/g, (m) => map[m] ?? m);
}

export default function CreateForm() {
  const [text, setText] = useState("");
  const [lang, setLang] = useState("fr");
  const [category, setCategory] = useState<Category>("autre");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const deviceId = useDeviceId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = basicFix(text.trim());
    if (!clean || clean.length > MAX) return;
    setBusy(true);
    setStatus(null);
    try {
      const user = await getSessionUser();
      const res = await fetch("/api/statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, language: lang, category, deviceId, userId: user?.id }),
      });
      const json = await res.json();
      if (res.status === 422) setStatus({ ok: false, msg: json.message });
      else if (res.status === 429) setStatus({ ok: false, msg: json.error });
      else if (!res.ok) setStatus({ ok: false, msg: json.error ?? json.message ?? "Erreur inconnue" });
      else {
        setStatus({ ok: true, msg: json.message });
        setText("");
      }
    } catch {
      setStatus({ ok: false, msg: "Erreur réseau." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Créer une opinion</h1>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        placeholder="Exprimez une opinion courte…"
        rows={4}
        className="w-full resize-none rounded-2xl border border-neutral-300 bg-white p-4 text-lg outline-none focus:border-black dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-white"
      />
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
        <span>{text.length}/{MAX}</span>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Catégorie</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={busy || !text.trim()}
        className="rounded-2xl bg-black py-4 text-lg font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        {busy ? "Envoi…" : "Publier"}
      </button>
      {status && (
        <p className={`rounded-xl p-3 text-sm ${status.ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
          {status.msg}
        </p>
      )}
    </form>
  );
}
