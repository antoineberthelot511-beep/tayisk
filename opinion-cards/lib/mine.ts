"use client";

const KEY = "oc_my_statements";
const MAX = 200;

/**
 * Identifiants des cartes creees depuis cet appareil.
 *
 * Il n'y a pas de compte : l'attribution vit donc cote client. La colonne
 * created_by reste libre pour le jour ou des comptes seront ajoutes.
 */
export function getMyStatementIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function rememberStatement(id: string): void {
  if (typeof window === "undefined") return;
  const ids = getMyStatementIds().filter((existing) => existing !== id);
  ids.unshift(id);
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  } catch {
    // Stockage plein ou desactive : on perd l'attribution, sans casser la
    // publication qui vient de reussir.
  }
}
