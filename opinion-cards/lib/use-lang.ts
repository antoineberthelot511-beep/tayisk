"use client";

import { useSyncExternalStore } from "react";
import { detectBrowserLang } from "./i18n";
import type { Lang } from "./types";

const noopSubscribe = () => () => {};

let cached: Lang | null = null;
const snapshot = (): Lang => (cached ??= detectBrowserLang());

/**
 * Langue d'affichage, deduite du navigateur.
 *
 * Le serveur ne connait pas cette valeur : il rend "fr" puis le client
 * bascule sur sa vraie langue apres hydratation.
 */
export function useLang(): Lang {
  return useSyncExternalStore(noopSubscribe, snapshot, (): Lang => "fr");
}
