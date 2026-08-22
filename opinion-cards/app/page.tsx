import { cookies } from "next/headers";
import VoteFeed from "@/components/VoteFeed";
import { getFeed } from "@/lib/feed";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Le device_id est pose par le client ; au premier passage il n'existe pas
  // encore et on sert simplement un lot aleatoire.
  const deviceId = (await cookies()).get("oc_device_id")?.value ?? "";
  const initial = await getFeed(deviceId);

  return <VoteFeed initial={initial} />;
}
