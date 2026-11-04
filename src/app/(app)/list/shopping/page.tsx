"use client";

import { ArrowLeft, ChevronDown } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/AuthProvider";
import { useHousehold } from "@/components/providers/HouseholdProvider";
import { ProgressBar } from "@/components/shopping/ProgressBar";
import { ShoppingModeSkeleton } from "@/components/shopping/ShoppingModeSkeleton";
import { StoreSelector } from "@/components/shopping/StoreSelector";
import {
  VirtualizedShoppingList,
  VirtualizedCheckedShoppingList,
} from "@/components/shopping/VirtualizedShoppingList";
import { Button } from "@/components/ui/button";
import { UNCATEGORIZED_CATEGORY } from "@/constants/categories";
import { useActiveList } from "@/hooks/useActiveList";
import { useListItems } from "@/hooks/useListItems";
import { useStoreSelection } from "@/hooks/useStoreSelection";
import { cn } from "@/lib/utils";

// Lazy load Confetti since it's only shown when shopping is complete
const Confetti = dynamic(
  () => import("@/components/shopping/Confetti").then((mod) => mod.Confetti),
  { ssr: false }
);

import type { CategoryGroup, ListItem } from "@/types/list";

/**
 * Groups items by category and sorts groups according to the store's category order.
 * Categories not in the store order are placed at the end, sorted alphabetically.
 * "Other" (uncategorized) is always placed last.
 */
function groupAndSortByStoreOrder(
  items: ListItem[],
  categoryOrder: string[]
): CategoryGroup[] {
  // Group items by category
  const groups = new Map<string, CategoryGroup>();

  for (const item of items) {
    const categoryId = item.category_id || "uncategorized";
    const existing = groups.get(categoryId);

    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(categoryId, {
        category: item.categories || UNCATEGORIZED_CATEGORY,
        items: [item],
      });
    }
  }

  // Convert to array
  const groupArray = Array.from(groups.values());

  // Create order index map for efficient lookup
  const orderIndex = new Map<string, number>();
  categoryOrder.forEach((id, index) => {
    orderIndex.set(id, index);
  });

  // Sort groups by store's category order
  return groupArray.sort((a, b) => {
    const aId = a.category?.id || "uncategorized";
    const bId = b.category?.id || "uncategorized";

    // Uncategorized always goes last
    if (aId === "uncategorized") return 1;
    if (bId === "uncategorized") return -1;

    const aIndex = orderIndex.get(aId);
    const bIndex = orderIndex.get(bId);

    // If both have order indices, sort by order
    if (aIndex !== undefined && bIndex !== undefined) {
      return aIndex - bIndex;
    }

    // Categories with order come before those without
    if (aIndex !== undefined) return -1;
    if (bIndex !== undefined) return 1;

    // Both without order: sort alphabetically
    return (a.category?.name || "").localeCompare(b.category?.name || "");
  });
}

export default function ShoppingModePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { currentHousehold, isLoading: householdLoading } = useHousehold();

  const {
    list,
    isLoading: listLoading,
    createList,
  } = useActiveList(currentHousehold?.id || null);

  const {
    items,
    isLoading: itemsLoading,
    toggleItem,
  } = useListItems(list?.id || null);

  const {
    storeProfiles,
    selectedStore,
    isLoading: storesLoading,
    selectStore,
  } = useStoreSelection(currentHousehold?.id || null);

  const [showCompleted, setShowCompleted] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const isCreatingListRef = useRef(false);
  const wasCompleteRef = useRef(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Redirect if no household
  useEffect(() => {
    if (!authLoading && !householdLoading && user && !currentHousehold) {
      router.push("/onboarding");
    }
  }, [authLoading, householdLoading, user, currentHousehold, router]);

  // Auto-create list if none exists
  useEffect(() => {
    const autoCreateList = async () => {
      if (
        !listLoading &&
        !list &&
        currentHousehold &&
        !isCreatingListRef.current
      ) {
        isCreatingListRef.current = true;
        try {
          await createList("Shopping List");
        } catch {
          toast.error("Failed to create shopping list");
        } finally {
          isCreatingListRef.current = false;
        }
      }
    };
    autoCreateList();
  }, [listLoading, list, currentHousehold, createList]);

  const handleToggleItem = useCallback(
    async (itemId: string) => {
      const success = await toggleItem(itemId);
      if (!success) {
        toast.error("Failed to update item");
      }
    },
    [toggleItem]
  );

  // Separate pending and checked items
  const pendingItems = useMemo(
    () => items.filter((item) => item.status === "pending"),
    [items]
  );
  const checkedItems = useMemo(
    () => items.filter((item) => item.status === "checked"),
    [items]
  );

  // Group pending items by category, sorted by store's category order
  const pendingGroups = useMemo(() => {
    const categoryOrder = selectedStore?.category_order || [];
    return groupAndSortByStoreOrder(pendingItems, categoryOrder);
  }, [pendingItems, selectedStore?.category_order]);

  // Progress tracking
  const totalItems = items.length;
  const checkedCount = checkedItems.length;
  const isComplete = checkedCount === totalItems && totalItems > 0;

  // Trigger celebration when transitioning to complete
  useEffect(() => {
    if (isComplete && !wasCompleteRef.current) {
      setIsCelebrating(true);
    }
    wasCompleteRef.current = isComplete;
  }, [isComplete]);

  const handleCelebrationComplete = useCallback(() => {
    setIsCelebrating(false);
  }, []);

  // Loading state
  if (authLoading || householdLoading || !user || !currentHousehold) {
    return null;
  }

  const isLoading = listLoading || itemsLoading || storesLoading;
  const hasItems = items.length > 0;
  const hasPendingItems = pendingItems.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Celebration Confetti */}
      <Confetti
        isActive={isCelebrating}
        onComplete={handleCelebrationComplete}
      />

      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-3 px-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/list" aria-label="Back to list">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="flex-1 text-lg font-semibold">Shopping Mode</h1>
          {storeProfiles.length > 0 && (
            <StoreSelector
              stores={storeProfiles}
              selectedStore={selectedStore}
              onSelect={selectStore}
            />
          )}
        </div>
      </header>

      {/* Progress Bar - Sticky below header */}
      {hasItems && (
        <div className="sticky top-14 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <ProgressBar checked={checkedCount} total={totalItems} />
        </div>
      )}

      {/* Main Content */}
      <main className="container max-w-2xl px-4 py-4">
        {isLoading ? (
          <ShoppingModeSkeleton showProgressBar={false} />
        ) : !hasItems ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              No items on your list
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add items from the{" "}
              <Link href="/list" className="text-primary underline">
                main list
              </Link>{" "}
              to start shopping
            </p>
          </div>
        ) : !hasPendingItems ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <span className="text-3xl">🎉</span>
            </div>
            <p className="text-xl font-semibold text-green-600 dark:text-green-400">
              All done!
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;ve checked off all items on your list
            </p>
          </div>
        ) : (
          <>
            {/* Store info hint when no store selected */}
            {!selectedStore && storeProfiles.length === 0 && (
              <div className="mb-4 rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                <p>
                  Create store profiles in{" "}
                  <Link href="/settings" className="text-primary underline">
                    Settings
                  </Link>{" "}
                  to customize category order for different stores.
                </p>
              </div>
            )}

            {/* Pending Items by Category (Store Order) - Virtualized for performance */}
            <VirtualizedShoppingList
              groups={pendingGroups}
              onToggleItem={handleToggleItem}
            />
          </>
        )}

        {/* Completed Items (Collapsible) */}
        {checkedItems.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <button
              type="button"
              onClick={() => setShowCompleted(!showCompleted)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors",
                "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              aria-expanded={showCompleted}
            >
              <span className="flex-1 text-lg font-semibold text-muted-foreground">
                Checked Items
              </span>
              <span className="text-sm text-muted-foreground">
                {checkedItems.length}
              </span>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform",
                  showCompleted && "rotate-180"
                )}
              />
            </button>

            {showCompleted && (
              <VirtualizedCheckedShoppingList
                items={checkedItems}
                onToggleItem={handleToggleItem}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
