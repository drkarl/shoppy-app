"use client";

import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/AuthProvider";
import { useHousehold } from "@/components/providers/HouseholdProvider";
import { EmptyStoreState } from "@/components/settings/EmptyStoreState";
import { StoreProfilesSkeleton } from "@/components/settings/SettingsSkeleton";
import { StoreProfileCard } from "@/components/settings/StoreProfileCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCategories } from "@/hooks/useCategories";

import type { StoreProfile } from "@/types/store-profile";

export default function StoreProfilesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { currentHousehold, isLoading: householdLoading } = useHousehold();
  const { categories } = useCategories();

  const [storeProfiles, setStoreProfiles] = useState<StoreProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingStoreId, setDeletingStoreId] = useState<string | null>(null);
  const [togglingDefaultId, setTogglingDefaultId] = useState<string | null>(
    null
  );

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

  // Fetch store profiles
  const fetchStoreProfiles = useCallback(async () => {
    if (!currentHousehold) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/store-profiles?household_id=${encodeURIComponent(currentHousehold.id)}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch store profiles");
      }
      const data = await response.json();
      setStoreProfiles(data.store_profiles || []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch store profiles";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentHousehold]);

  useEffect(() => {
    if (currentHousehold) {
      fetchStoreProfiles();
    }
  }, [currentHousehold, fetchStoreProfiles]);

  // Create new store profile
  const handleCreateStore = useCallback(async () => {
    if (!currentHousehold || !newStoreName.trim()) return;

    setIsCreating(true);

    try {
      // Use default category order from categories
      const defaultCategoryOrder = categories.map((cat) => cat.id);

      const response = await fetch("/api/store-profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          household_id: currentHousehold.id,
          store_name: newStoreName.trim(),
          category_order: defaultCategoryOrder,
          is_default: storeProfiles.length === 0, // First store is default
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create store profile");
      }

      toast.success(`Store "${newStoreName.trim()}" created`);
      setNewStoreName("");
      setAddDialogOpen(false);
      await fetchStoreProfiles();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create store profile";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  }, [
    currentHousehold,
    newStoreName,
    categories,
    storeProfiles.length,
    fetchStoreProfiles,
  ]);

  // Delete store profile
  const handleDeleteStore = useCallback(
    async (storeId: string) => {
      setDeletingStoreId(storeId);

      try {
        const response = await fetch(`/api/store-profiles/${storeId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete store profile");
        }

        toast.success("Store profile deleted");
        await fetchStoreProfiles();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete store profile";
        toast.error(message);
      } finally {
        setDeletingStoreId(null);
      }
    },
    [fetchStoreProfiles]
  );

  // Toggle default store
  const handleToggleDefault = useCallback(
    async (storeId: string, isDefault: boolean) => {
      setTogglingDefaultId(storeId);

      try {
        const response = await fetch(`/api/store-profiles/${storeId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ is_default: isDefault }),
        });

        if (!response.ok) {
          throw new Error("Failed to update store profile");
        }

        toast.success(
          isDefault ? "Store set as default" : "Default store cleared"
        );
        await fetchStoreProfiles();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update store profile";
        toast.error(message);
      } finally {
        setTogglingDefaultId(null);
      }
    },
    [fetchStoreProfiles]
  );

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
          <h1 className="flex-1 text-lg font-semibold">Store Profiles</h1>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" aria-label="Add new store">
                <Plus className="mr-1 h-4 w-4" />
                Add Store
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Store Profile</DialogTitle>
                <DialogDescription>
                  Create a new store profile to customize category ordering for
                  a specific store.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="store-name">Store Name</Label>
                <Input
                  id="store-name"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="e.g., Lidl"
                  className="mt-2"
                  maxLength={100}
                  disabled={isCreating}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newStoreName.trim()) {
                      handleCreateStore();
                    }
                  }}
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isCreating}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  onClick={handleCreateStore}
                  disabled={!newStoreName.trim() || isCreating}
                >
                  {isCreating ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container max-w-2xl space-y-4 px-4 py-6">
        {isLoading ? (
          <StoreProfilesSkeleton />
        ) : error ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-destructive">{error}</p>
              <div className="mt-4 flex justify-center">
                <Button variant="outline" onClick={fetchStoreProfiles}>
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : storeProfiles.length === 0 ? (
          <EmptyStoreState onAddStore={() => setAddDialogOpen(true)} />
        ) : (
          storeProfiles.map((store) => (
            <StoreProfileCard
              key={store.id}
              store={store}
              onDelete={handleDeleteStore}
              onToggleDefault={handleToggleDefault}
              isDeleting={deletingStoreId === store.id}
              isTogglingDefault={togglingDefaultId === store.id}
            />
          ))
        )}
      </main>
    </div>
  );
}
