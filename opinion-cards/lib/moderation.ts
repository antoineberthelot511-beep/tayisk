export type ModerationOutcome = {
  flagged: boolean;
  /** Categories declenchees, pour le message d'erreur et le stockage. */
  categories: string[];
  /** Reponse brute de l'API, stockee dans statements.moderation_result. */
  raw: unknown;
  /** L'API n'a pas pu etre appelee (cle absente ou panne). */
  skipped: boolean;
};

type OpenAiModerationResponse = {
  results?: {
    flagged?: boolean;
    categories?: Record<string, boolean>;
  }[];
};

/**
 * Modere un texte via l'API gratuite d'OpenAI.
 *
 * Sans cle, ou si l'appel echoue, on renvoie `skipped: true` sans bloquer :
 * la carte part alors en 'pending' pour une relecture humaine plutot que
 * d'etre publiee sans controle (voir resolveStatus dans l'API de creation).
 */
export async function moderateText(text: string): Promise<ModerationOutcome> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { flagged: false, categories: [], raw: null, skipped: true };

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error("[moderation] HTTP", res.status, await res.text());
      return { flagged: false, categories: [], raw: null, skipped: true };
    }

    const data = (await res.json()) as OpenAiModerationResponse;
    const result = data.results?.[0];
    const categories = Object.entries(result?.categories ?? {})
      .filter(([, on]) => on)
      .map(([name]) => name);

    return {
      flagged: Boolean(result?.flagged),
      categories,
      raw: data,
      skipped: false,
    };
  } catch (error) {
    console.error("[moderation]", error);
    return { flagged: false, categories: [], raw: null, skipped: true };
  }
}
