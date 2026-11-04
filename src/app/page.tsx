"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { isLocalOnlyMode } from "@/lib/supabase/mock-mode";

export default function Home() {
  const router = useRouter();

  // In local-only mode, redirect directly to the list page
  useEffect(() => {
    if (isLocalOnlyMode()) {
      router.replace("/list");
    }
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Shoppy</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Collaborative smart shopping list
      </p>
    </main>
  );
}
