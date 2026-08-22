import { SUPPORTED_LANGS, type Lang } from "./types";

/** Codes cibles DeepL pour nos langues. */
const DEEPL_TARGET: Record<Lang, string> = { fr: "FR", en: "EN-US", es: "ES" };

type DeepLResponse = { translations?: { text?: string }[] };

async function translateWithDeepL(
  text: string,
  from: Lang,
  to: Lang,
): Promise<string | null> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) return null;

  // Les cles se terminant par ':fx' sont des cles du plan gratuit, qui
  // utilise un domaine distinct.
  const host = key.endsWith(":fx")
    ? "https://api-free.deepl.com"
    : "https://api.deepl.com";

  try {
    const res = await fetch(`${host}/v2/translate`, {
      method: "POST",
      headers: {
        authorization: `DeepL-Auth-Key ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: [text],
        source_lang: from.toUpperCase(),
        target_lang: DEEPL_TARGET[to],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error("[translate] DeepL HTTP", res.status);
      return null;
    }

    const data = (await res.json()) as DeepLResponse;
    return data.translations?.[0]?.text ?? null;
  } catch (error) {
    console.error("[translate] DeepL", error);
    return null;
  }
}

async function translateWithLibre(
  text: string,
  from: Lang,
  to: Lang,
): Promise<string | null> {
  const base = process.env.LIBRETRANSLATE_URL;
  if (!base) return null;

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/translate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: text, source: from, target: to, format: "text" }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error("[translate] LibreTranslate HTTP", res.status);
      return null;
    }

    const data = (await res.json()) as { translatedText?: string };
    return data.translatedText ?? null;
  } catch (error) {
    console.error("[translate] LibreTranslate", error);
    return null;
  }
}

/**
 * Traduit le texte vers toutes les langues supportees, une seule fois a la
 * creation. Les traductions manquantes sont simplement absentes du resultat :
 * l'affichage retombe alors sur le texte original.
 */
export async function translateAll(
  text: string,
  from: Lang,
): Promise<Partial<Record<Lang, string>>> {
  const targets = SUPPORTED_LANGS.filter((l) => l !== from);

  const results = await Promise.all(
    targets.map(async (to) => {
      const translated =
        (await translateWithDeepL(text, from, to)) ??
        (await translateWithLibre(text, from, to));
      return [to, translated] as const;
    }),
  );

  const translations: Partial<Record<Lang, string>> = { [from]: text };
  for (const [lang, value] of results) {
    if (value) translations[lang] = value;
  }
  return translations;
}
