import { NextResponse } from "next/server";
import { detectTextLanguage } from "@/lib/i18n";
import { MAX_LENGTH } from "@/lib/create";

type LanguageToolResponse = {
  matches?: {
    offset: number;
    length: number;
    message?: string;
    replacements?: { value?: string }[];
  }[];
};

export type Suggestion = {
  offset: number;
  length: number;
  original: string;
  replacement: string;
  message: string;
};

/**
 * Correction orthographique via l'API publique de LanguageTool (gratuite,
 * limitee en debit). Purement indicative : toute erreur ici renvoie une liste
 * vide plutot que de bloquer la publication.
 */
export async function POST(request: Request) {
  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ suggestions: [] });
  }

  const text = (body.text ?? "").trim();
  if (text.length < 4 || text.length > MAX_LENGTH) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const res = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        text,
        language: detectTextLanguage(text),
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return NextResponse.json({ suggestions: [] });

    const data = (await res.json()) as LanguageToolResponse;

    const suggestions: Suggestion[] = (data.matches ?? [])
      .map((m) => ({
        offset: m.offset,
        length: m.length,
        original: text.slice(m.offset, m.offset + m.length),
        replacement: m.replacements?.[0]?.value ?? "",
        message: m.message ?? "",
      }))
      .filter((s) => s.replacement && s.replacement !== s.original)
      .slice(0, 6);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[spellcheck]", error);
    return NextResponse.json({ suggestions: [] });
  }
}
