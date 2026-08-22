import { SUPPORTED_LANGS, type Lang, type FeedStatement, type VoteChoice } from "./types";

export function normalizeLang(raw: string | null | undefined): Lang {
  const base = (raw ?? "").toLowerCase().split("-")[0];
  return (SUPPORTED_LANGS as string[]).includes(base) ? (base as Lang) : "fr";
}

/** Langue du navigateur, cote client. */
export function detectBrowserLang(): Lang {
  if (typeof navigator === "undefined") return "fr";
  return normalizeLang(navigator.language);
}

/** Langue depuis l'en-tete Accept-Language, cote serveur. */
export function langFromAcceptLanguage(header: string | null): Lang {
  if (!header) return "fr";
  return normalizeLang(header.split(",")[0]);
}

/** Mots tres frequents, propres a chaque langue supportee. */
const MARKERS: Record<Lang, string[]> = {
  fr: ["le", "la", "les", "des", "une", "est", "sont", "pas", "que", "qui", "pour",
       "dans", "avec", "plus", "on", "il", "elle", "faut", "cest", "du", "au"],
  en: ["the", "is", "are", "of", "and", "to", "in", "should", "with", "that",
       "you", "we", "it", "for", "not", "be", "have", "more"],
  es: ["el", "los", "las", "una", "es", "son", "que", "para", "con", "por",
       "no", "se", "su", "mas", "muy", "pero", "gente"],
};

/**
 * Devine la langue d'un texte en comptant les mots outils de chaque langue.
 * Suffisant pour trois langues eloignees ; en cas d'egalite, on retombe sur
 * la langue par defaut passee en second argument.
 */
export function detectTextLanguage(text: string, fallback: Lang = "fr"): Lang {
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^\p{L}]+/u)
    .filter(Boolean);

  let best: Lang = fallback;
  let bestScore = 0;

  for (const lang of SUPPORTED_LANGS) {
    const markers = MARKERS[lang];
    const score = words.filter((w) => markers.includes(w)).length;
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }
  return best;
}

/** Texte traduit si disponible, sinon texte original. */
export function pickText(statement: FeedStatement, lang: Lang): string {
  return statement.translations?.[lang]?.trim() || statement.text;
}

const STRINGS = {
  fr: {
    agree: "D'accord",
    disagree: "Pas d'accord",
    verdict: (pct: number, isMajority: boolean, vote: VoteChoice) =>
      isMajority
        ? `${pct}% des gens pensent comme toi`
        : vote === "agree"
          ? `Tu fais partie des ${pct}% qui sont d'accord`
          : `Tu fais partie des ${pct}% qui ne sont pas d'accord`,
    tapToContinue: "Touche pour continuer",
    create: "Proposer une opinion",
    newCard: "Nouvelle carte",
    share: "Partager en story",
    done: "Tu as voté sur toutes les cartes !",
    doneSub: "Reviens plus tard, ou propose la tienne.",
    votes: (n: number) => (n > 1 ? `${n} votes` : `${n} vote`),
  },
  en: {
    agree: "Agree",
    disagree: "Disagree",
    verdict: (pct: number, isMajority: boolean, vote: VoteChoice) =>
      isMajority
        ? `${pct}% of people think like you`
        : vote === "agree"
          ? `You're among the ${pct}% who agree`
          : `You're among the ${pct}% who disagree`,
    tapToContinue: "Tap to continue",
    create: "Post an opinion",
    newCard: "New card",
    share: "Share to story",
    done: "You voted on every card!",
    doneSub: "Come back later, or post your own.",
    votes: (n: number) => (n > 1 ? `${n} votes` : `${n} vote`),
  },
  es: {
    agree: "De acuerdo",
    disagree: "En desacuerdo",
    verdict: (pct: number, isMajority: boolean, vote: VoteChoice) =>
      isMajority
        ? `${pct}% de la gente piensa como tú`
        : vote === "agree"
          ? `Eres parte del ${pct}% que está de acuerdo`
          : `Eres parte del ${pct}% que no está de acuerdo`,
    tapToContinue: "Toca para continuar",
    create: "Publicar una opinión",
    newCard: "Nueva carta",
    share: "Compartir en story",
    done: "¡Ya votaste todas las cartas!",
    doneSub: "Vuelve más tarde, o publica la tuya.",
    votes: (n: number) => (n > 1 ? `${n} votos` : `${n} voto`),
  },
} as const;

export function t(lang: Lang) {
  return STRINGS[lang];
}
