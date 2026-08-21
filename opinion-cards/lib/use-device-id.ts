"use client";

import { useEffect, useState } from "react";

const KEY = "oc_device_id";

/** Identifiant de device persisté en localStorage + cookie. */
export function useDeviceId(): string | null {
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    document.cookie = `oc_device_id=${id}; path=/; max-age=31536000; samesite=lax`;
    setDeviceId(id);
  }, []);

  return deviceId;
}
