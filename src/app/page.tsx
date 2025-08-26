import { Button } from "@/components/ui/button";
import { HydrateClient } from "@/trpc/server";
import Link from "next/link";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex flex-col items-center justify-center h-screen">
        <Button asChild>
          <Link href="/transaction/upload">Upload PDF</Link>
        </Button>
      </main>
    </HydrateClient>
  );
}
