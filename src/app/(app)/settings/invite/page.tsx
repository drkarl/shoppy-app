"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { useHousehold } from "@/components/providers/HouseholdProvider";
import { InviteCodeCard } from "@/components/settings/InviteCodeCard";
import { Button } from "@/components/ui/button";

export default function InviteSettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { currentHousehold, isLoading: householdLoading } = useHousehold();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading && !householdLoading && user && !currentHousehold) {
      router.push("/onboarding");
    }
  }, [authLoading, householdLoading, user, currentHousehold, router]);

  if (authLoading || householdLoading || !user || !currentHousehold) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings" aria-label="Back to settings">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">Invite Members</h1>
        </div>
      </header>

      <main className="container max-w-2xl px-4 py-6">
        <InviteCodeCard />
      </main>
    </div>
  );
}
