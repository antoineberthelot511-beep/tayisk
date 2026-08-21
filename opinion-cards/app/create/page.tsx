import Link from "next/link";
import CreateForm from "@/components/CreateForm";

export default function CreatePage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-md px-2 pt-6">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">← Retour au flux</Link>
      </div>
      <CreateForm />
    </main>
  );
}
