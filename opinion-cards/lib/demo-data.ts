import type { Statement } from "./types";

/** Données de test utilisées quand Supabase n'est pas configuré. */
export const demoStatements: Statement[] = [
  { id: "demo-1", text: "Le télétravail améliore la qualité de vie.", text_language: "fr", translations: { en: "Remote work improves quality of life.", es: "El trabajo remoto mejora la calidad de vida." }, image_url: null, image_keyword: "remote work", votes_agree: 78, votes_disagree: 22 },
  { id: "demo-2", text: "Les réseaux sociaux font plus de mal que de bien.", text_language: "fr", translations: { en: "Social media does more harm than good.", es: "Las redes sociales hacen más daño que bien." }, image_url: null, image_keyword: "social media", votes_agree: 64, votes_disagree: 36 },
  { id: "demo-3", text: "Voyager seul est la meilleure façon de grandir.", text_language: "fr", translations: { en: "Traveling alone is the best way to grow.", es: "Viajar solo es la mejor manera de crecer." }, image_url: null, image_keyword: "travel", votes_agree: 81, votes_disagree: 19 },
  { id: "demo-4", text: "L'intelligence artificielle créera plus d'emplois qu'elle n'en détruira.", text_language: "fr", translations: { en: "AI will create more jobs than it destroys.", es: "La IA creará más empleos de los que destruirá." }, image_url: null, image_keyword: "artificial intelligence", votes_agree: 35, votes_disagree: 65 },
  { id: "demo-5", text: "Il faudrait interdire les voitures en centre-ville.", text_language: "fr", translations: { en: "Cars should be banned from city centers.", es: "Deberían prohibirse los coches en el centro." }, image_url: null, image_keyword: "city street", votes_agree: 52, votes_disagree: 48 },
  { id: "demo-6", text: "Le café est supérieur au thé.", text_language: "fr", translations: { en: "Coffee is superior to tea.", es: "El café es superior al té." }, image_url: null, image_keyword: "coffee", votes_agree: 70, votes_disagree: 30 },
];

/** Stockage en mémoire pour le mode démo (votes inclus). */
export const demoVotesByDevice = new Map<string, Set<string>>();

export function demoApplyVote(deviceId: string, statementId: string, vote: "agree" | "disagree") {
  const s = demoStatements.find((d) => d.id === statementId);
  if (!s) throw new Error("Statement not found");
  let voted = demoVotesByDevice.get(deviceId);
  if (!voted) {
    voted = new Set();
    demoVotesByDevice.set(deviceId, voted);
  }
  if (voted.has(statementId)) throw new Error("Already voted");
  voted.add(statementId);
  if (vote === "agree") s.votes_agree += 1;
  else s.votes_disagree += 1;
  return s;
}

export function demoNextStatement(deviceId: string): Statement | null {
  const voted = demoVotesByDevice.get(deviceId) ?? new Set<string>();
  return demoStatements.filter((s) => !voted.has(s.id))[0] ?? null;
}
