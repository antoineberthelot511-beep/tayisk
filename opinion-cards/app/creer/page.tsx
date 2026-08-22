import Link from "next/link";
import CreateForm from "@/components/CreateForm";

export const metadata = { title: "Proposer une opinion — Opinion Cards" };

export default function CreatePage() {
  return (
    <main className="mx-auto flex h-screen-safe w-full max-w-md flex-col px-5 pt-5 pb-6">
      <header className="mb-5 flex items-center justify-between">
        <Link href="/" className="eyebrow text-paper/60 hover:text-paper">
          &larr; Retour
        </Link>
        <span className="font-display text-xl tracking-tight">
          Opinion<span className="text-agree">.</span>
        </span>
      </header>
      <CreateForm />
    </main>
  );
}
