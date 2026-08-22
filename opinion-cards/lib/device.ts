"use client";

import { useSyncExternalStore } from "react";

const KEY = "oc_device_id";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * Identifiant de device persistant, cote client uniquement.
 * Double stockage localStorage + cookie : le cookie survit au nettoyage du
 * storage par certains navigateurs, et inversement. Pas infaillible (mode
 * prive, effacement manuel) — suffisant pour la V1 sans compte obligatoire.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  const fromStorage = localStorage.getItem(KEY);
  const fromCookie = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${KEY}=`))
    ?.split("=")[1];

  const id = fromStorage || fromCookie || newId();

  if (fromStorage !== id) localStorage.setItem(KEY, id);
  if (fromCookie !== id) {
    document.cookie = `${KEY}=${id}; path=/; max-age=31536000; samesite=lax`;
  }
  return id;
}

// L'identifiant ne change jamais pendant la vie de la page : rien a ecouter.
const noopSubscribe = () => () => {};

// getSnapshot est appele a chaque rendu : on memorise pour ne pas reecrire le
// localStorage et le cookie a chaque fois.
let cachedId: string | null = null;
const snapshot = () => (cachedId ??= getDeviceId());

/**
 * Identifiant de device dans un composant React.
 *
 * useSyncExternalStore plutot qu'un useEffect : c'est la lecture d'une valeur
 * exterieure a React, indisponible au rendu serveur. Le serveur rend "" et le
 * client reprend la vraie valeur juste apres l'hydratation.
 */
export function useDeviceId(): string {
  return useSyncExternalStore(noopSubscribe, snapshot, () => "");
}
