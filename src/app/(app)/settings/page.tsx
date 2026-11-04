"use client";

import { ArrowLeft, ChevronRight, Store, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { useHousehold } from "@/components/providers/HouseholdProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreSelection } from "@/hooks/useStoreSelection";

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { currentHousehold, isLoading: householdLoading } = useHousehold();
  const { storeProfiles, isLoading: storesLoading } = useStoreSelection(
    currentHousehold?.id ?? null
  );

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

  const storeCount = storeProfiles.length;
  const defaultStore = storeProfiles.find((s) => s.is_default);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/list" aria-label="Back to shopping list">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </header>

      <main className="container max-w-2xl space-y-6 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Household</CardTitle>
            <CardDescription>Manage your household settings</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Link
              href="/settings/invite"
              className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Invite Members</p>
                  <p className="text-sm text-muted-foreground">
                    Share invite link to add people
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Store Profiles</CardTitle>
            <CardDescription>
              Customize category order for each store
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Link
              href="/settings/stores"
              className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Store className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Manage Stores</p>
                  {storesLoading ? (
                    <Skeleton className="h-4 w-36" />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {storeCount === 0
                        ? "No stores configured"
                        : `${storeCount} store${storeCount !== 1 ? "s" : ""}${defaultStore ? ` · ${defaultStore.store_name} is default` : ""}`}
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
