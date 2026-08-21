import { getSupabase } from "./db";

const BUCKET = "statement-images";
let bucketReady = false;

/** Télécharge l'image source et la stocke dans Supabase Storage. Retourne le chemin. */
export async function storeImage(imageUrl: string, statementId: string): Promise<string | null> {
  try {
    const sb = getSupabase();
    if (!bucketReady) {
      // Crée le bucket s'il n'existe pas (service role)
      const { error } = await sb.storage.createBucket(BUCKET, { public: true });
      if (!error || error.message.includes("exists")) bucketReady = true;
    }
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = imageUrl.match(/\.(jpe?g|png|webp)/i)?.[1]?.toLowerCase() ?? "jpeg";
    const path = `${statementId}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, buffer, {
      contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      upsert: true,
    });
    if (error) {
      console.error("Storage upload failed:", error.message);
      return null;
    }
    return path;
  } catch (e) {
    console.error("storeImage failed:", e);
    return null;
  }
}

/** URL publique d'une image stockée. */
export function publicImageUrl(path: string | null): string | null {
  if (!path) return null;
  return getSupabase().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
