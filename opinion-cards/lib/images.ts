type PexelsResponse = {
  photos?: { src?: { portrait?: string; large2x?: string; large?: string } }[];
};

/**
 * Cherche une image verticale correspondant au mot-cle.
 *
 * L'URL renvoyee est stockee en base a la creation et jamais re-interrogee a
 * l'affichage : c'est ce qui garde la consommation d'API a un appel par carte
 * creee, bien en dessous des quotas gratuits.
 */
export async function findImage(keyword: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key || !keyword.trim()) return null;

  try {
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", keyword);
    url.searchParams.set("per_page", "1");
    url.searchParams.set("orientation", "portrait");

    const res = await fetch(url, {
      headers: { authorization: key },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error("[images] HTTP", res.status);
      return null;
    }

    const data = (await res.json()) as PexelsResponse;
    const src = data.photos?.[0]?.src;
    return src?.portrait ?? src?.large2x ?? src?.large ?? null;
  } catch (error) {
    console.error("[images]", error);
    return null;
  }
}

const STOPWORDS = new Set([
  // fr
  "le", "la", "les", "un", "une", "des", "du", "de", "d", "l", "et", "ou", "mais",
  "que", "qui", "quoi", "dont", "ou", "est", "sont", "etre", "avoir", "il", "elle",
  "ils", "elles", "on", "nous", "vous", "je", "tu", "ce", "cet", "cette", "ces",
  "son", "sa", "ses", "leur", "leurs", "mon", "ma", "mes", "ton", "ta", "tes",
  "pas", "plus", "moins", "tres", "trop", "bien", "mal", "tout", "tous", "toute",
  "dans", "sur", "sous", "avec", "sans", "pour", "par", "en", "au", "aux", "a",
  "faut", "faudrait", "devrait", "doit", "peut", "meilleur", "meilleure",
  // en
  "the", "a", "an", "and", "or", "but", "is", "are", "be", "to", "of", "in", "on",
  "for", "with", "without", "it", "we", "you", "they", "should", "would", "more",
  "less", "than", "that", "this", "these", "those", "not",
  // es
  "el", "los", "las", "una", "unos", "unas", "y", "o", "pero", "es", "son", "ser",
  "por", "para", "con", "sin", "que", "se", "su", "sus", "mas", "menos", "no",
]);

/** Retire les accents pour comparer aux mots vides. */
function fold(word: string): string {
  return word.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Devine un mot-cle de recherche d'image a partir du texte : le mot porteur
 * de sens le plus long. Heuristique volontairement simple et gratuite ;
 * l'utilisateur peut de toute facon saisir son propre mot-cle.
 */
export function guessKeyword(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/['']/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !STOPWORDS.has(fold(w)));

  if (words.length === 0) return "abstract";

  return words.reduce((best, w) => (w.length > best.length ? w : best), "");
}
