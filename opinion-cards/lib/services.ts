import type { SupportedLang } from "./types";

/**
 * Modération de contenu via l'API OpenAI Moderation (gratuite).
 * Retourne { flagged, categories } — si OPENAI_API_KEY absent, non flaggé.
 */
export async function moderateText(
  text: string
): Promise<{ flagged: boolean; failed: boolean; result: unknown }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { flagged: false, failed: false, result: { skipped: "no_api_key" } };

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
    });
    if (!res.ok) {
      // Erreur API (rate limit 429, etc.) : modération indisponible
      return { flagged: false, failed: true, result: { error: `moderation_http_${res.status}` } };
    }
    const json = await res.json();
    const r = json.results?.[0];
    return { flagged: Boolean(r?.flagged), failed: false, result: r };
  } catch {
    return { flagged: false, failed: true, result: { error: "moderation_fetch_failed" } };
  }
}

/** Traduction vers FR/EN/ES. DeepL si clé, sinon LibreTranslate si URL, sinon rien. */
export async function translateText(text: string, sourceLang: string): Promise<Partial<Record<SupportedLang, string>>> {
  const targets: SupportedLang[] = (["fr", "en", "es"] as SupportedLang[]).filter((l) => l !== sourceLang);
  const translations: Partial<Record<SupportedLang, string>> = {};

  const deepl = process.env.DEEPL_API_KEY;
  if (deepl) {
    const host = deepl.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";
    let ok = true;
    for (const target of targets) {
      try {
        const res = await fetch(`https://${host}/v2/translate`, {
          method: "POST",
          headers: { Authorization: `DeepL-Auth-Key ${deepl}`, "Content-Type": "application/json" },
          body: JSON.stringify({ text: [text], target_lang: target.toUpperCase() }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.translations?.[0]?.text) translations[target] = json.translations[0].text;
        } else {
          ok = false;
        }
      } catch {
        ok = false;
      }
    }
    if (ok && Object.keys(translations).length > 0) return translations;
  }

  const libre = process.env.LIBRETRANSLATE_URL;
  if (libre) {
    for (const target of targets) {
      try {
        const res = await fetch(`${libre.replace(/\/$/, "")}/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: text, source: sourceLang, target, format: "text" }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.translatedText) translations[target] = json.translatedText;
        }
      } catch {
        /* ignore */
      }
    }
  }

  return translations;
}

/** Recherche d'image Pexels par mot-clé (cache géré en DB via image_url). */
export async function fetchImage(keyword: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key || !keyword) return null;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: key } }
    );
    if (!res.ok) {
      console.error("Pexels error:", res.status);
      return null;
    }
    const json = await res.json();
    return json.photos?.[0]?.src?.large ?? null;
  } catch (e) {
    console.error("Pexels fetch failed:", e);
    return null;
  }
}

/** Extrait un mot-clé simple du texte pour la recherche d'image. */
export function extractKeyword(text: string): string {
  const stop = new Set([
    "le","la","les","un","une","des","du","de","et","ou","à","au","aux","en","dans","pour","par","sur","que","qui","est","sont","il","elle","ils","elles","je","tu","nous","vous","on","ne","pas","plus","moins","the","a","an","of","to","in","on","is","are","be","should","would",
  ]);
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));
  return words.slice(0, 2).join(" ") || "abstract";
}
