"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/AuthProvider";
import { useHousehold } from "@/components/providers/HouseholdProvider";
import { CategoryOrderList } from "@/components/settings/CategoryOrderList";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCategories } from "@/hooks/useCategories";

import type { StoreProfile } from "@/types/store-profile";

export default function StoreProfileSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params.storeId as string;

  const { user, isLoading: authLoading } = useAuth();
  const { currentHousehold, isLoading: householdLoading } = useHousehold();
  const { categories, isLoading: categoriesLoading } = useCategories();

  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Redirect to onboarding if no household
  useEffect(() => {
    if (!authLoading && !householdLoading && user && !currentHousehold) {
      router.push("/onboarding");
    }
  }, [authLoading, householdLoading, user, currentHousehold, router]);

  // Fetch the store profile
  useEffect(() => {
    async function fetchStoreProfile() {
      if (!storeId) return;

      setIsLoadingProfile(true);
      setError(null);

      try {
        const response = await fetch(`/api/store-profiles/${storeId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Store profile not found");
          } else {
            setError("Failed to load store profile");
          }
          return;
        }
        const data = await response.json();
        setStoreProfile(data.store_profile);
      } catch (err) {
        console.error("Error fetching store profile:", err);
        setError("Failed to load store profile");
      } finally {
        setIsLoadingProfile(false);
      }
    }

    fetchStoreProfile();
  }, [storeId]);

  const handleSaveCategoryOrder = useCallback(
    async (newOrder: string[]) => {
      if (!storeId) return;

      setIsSaving(true);

      try {
        const response = await fetch(`/api/store-profiles/${storeId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category_order: newOrder }),
        });

        if (!response.ok) {
          throw new Error("Failed to save category order");
        }

        const data = await response.json();
        setStoreProfile(data.store_profile);
        toast.success("Category order saved");
      } catch (err) {
        console.error("Error saving category order:", err);
        toast.error("Failed to save category order");
      } finally {
        setIsSaving(false);
      }
    },
    [storeId]
  );

  const isLoading =
    authLoading ||
    householdLoading ||
    isLoadingProfile ||
    categoriesLoading ||
    !user ||
    !currentHousehold;

  if (isLoading && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center gap-4 px-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/settings" aria-label="Back to settings">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-lg font-semibold">Store Settings</h1>
          </div>
        </header>
        <main className="container max-w-2xl px-4 py-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">{error}</p>
              <div className="mt-4 flex justify-center">
                <Button variant="outline" asChild>
                  <Link href="/settings">Back to Settings</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
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
          <h1 className="text-lg font-semibold">
            {storeProfile?.store_name || "Store Settings"}
          </h1>
        </div>
      </header>

      <main className="container max-w-2xl space-y-6 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Category Order</CardTitle>
            <CardDescription>
              Drag and drop categories to set the order for shopping at this
              store. Items will be grouped in this order when viewing your
              shopping list.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {storeProfile && categories.length > 0 ? (
              <CategoryOrderList
                categories={categories}
                categoryOrder={storeProfile.category_order}
                onSave={handleSaveCategoryOrder}
                isSaving={isSaving}
              />
            ) : storeProfile && categories.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No categories available. Please sync your data to load
                categories.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
