"use client";

import Link from "next/link";
import VoteCard from "@/components/VoteCard";
import { useDeviceId } from "@/lib/use-device-id";

export default function Home() {
  const deviceId = useDeviceId();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6 md:max-w-lg">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">⚡ Opinion Cards</h1>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/tendances" className="rounded-full bg-neutral-200 px-3 py-2 font-semibold dark:bg-neutral-800">🔥</Link>
          <Link href="/profil" className="rounded-full bg-neutral-200 px-3 py-2 font-semibold dark:bg-neutral-800">👤</Link>
          <Link href="/create" className="rounded-full bg-black px-4 py-2 font-semibold text-white dark:bg-white dark:text-black">
            + Créer
          </Link>
        </nav>
      </header>
      {deviceId ? <VoteCard deviceId={deviceId} /> : null}
    </main>
  );
}
