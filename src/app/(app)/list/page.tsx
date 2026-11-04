"use client";

import { ChevronDown, Settings } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AddItemBar } from "@/components/list/AddItemBar";
import { EmptyState } from "@/components/list/EmptyState";
import { ListSkeleton } from "@/components/list/ListSkeleton";
import {
  VirtualizedList,
  VirtualizedCheckedList,
} from "@/components/list/VirtualizedList";
import { useAuth } from "@/components/providers/AuthProvider";
import { useHousehold } from "@/components/providers/HouseholdProvider";
import { Button } from "@/components/ui/button";
import { useActiveList } from "@/hooks/useActiveList";
import { useListItems } from "@/hooks/useListItems";
import { checkForDuplicate } from "@/lib/matching/DuplicateDetector";
import { parseQuantityAndUnit } from "@/lib/matching/normalize";
import { cn } from "@/lib/utils";

import type {
  ExistingItemData,
  NewItemData,
} from "@/components/list/DuplicateWarning";

// Lazy load DuplicateWarning since it's only shown when a duplicate is detected
const DuplicateWarning = dynamic(
  () =>
    import("@/components/list/DuplicateWarning").then(
      (mod) => mod.DuplicateWarning
    ),
  { ssr: false }
);

export default function ListPage() {
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
    pendingGroups,
    checkedItems,
    isLoading: itemsLoading,
    refetch,
    addItem,
    toggleItem,
    deleteItem,
  } = useListItems(list?.id || null);

  const [showCompleted, setShowCompleted] = useState(true);
  const isCreatingListRef = useRef(false);

  // Duplicate detection state
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingNewItem, setPendingNewItem] = useState<NewItemData | null>(
    null
  );
  const [existingMatchItem, setExistingMatchItem] =
    useState<ExistingItemData | null>(null);
  const [matchConfidence, setMatchConfidence] = useState(0);

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

  const handleAddItem = useCallback(
    async (displayName: string, quantity: number): Promise<boolean> => {
      // Parse input to get proper text, quantity, and unit
      const parsed = parseQuantityAndUnit(`${quantity} ${displayName}`);
      const textForMatching = parsed.text || displayName;

      // Check for duplicates among pending items only
      const pendingItems = items.filter((i) => i.status === "pending");
      const duplicateCheck = checkForDuplicate(
        textForMatching,
        pendingItems.map((i) => ({ id: i.id, display_name: i.display_name }))
      );

      if (duplicateCheck.duplicate.found) {
        // Found a potential duplicate - show warning dialog
        const matchedItem = duplicateCheck.duplicate.matchedItem;
        const fullMatchedItem = items.find((i) => i.id === matchedItem.id);

        setPendingNewItem({
          displayName,
          quantity,
          unit: parsed.unit,
        });
        setExistingMatchItem({
          id: matchedItem.id,
          displayName: matchedItem.display_name,
          quantity: fullMatchedItem?.quantity || 1,
          unit: fullMatchedItem?.unit || null,
        });
        setMatchConfidence(duplicateCheck.duplicate.confidence);
        setShowDuplicateWarning(true);
        return true; // Return true to clear input
      }

      // No duplicate - add directly
      const item = await addItem(displayName, quantity);
      if (item) {
        toast.success(`Added ${displayName}`);
        return true;
      } else {
        toast.error("Failed to add item");
        return false;
      }
    },
    [addItem, items]
  );

  const handleMerge = useCallback(async () => {
    if (!pendingNewItem || !existingMatchItem || !list?.id) return;

    // For merging a new item with an existing one, we update the existing item's quantity
    const response = await fetch(
      `/api/lists/${list.id}/items/${existingMatchItem.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: existingMatchItem.quantity + pendingNewItem.quantity,
        }),
      }
    );

    if (response.ok) {
      // Check for unit mismatch warning
      if (
        pendingNewItem.unit &&
        existingMatchItem.unit &&
        pendingNewItem.unit !== existingMatchItem.unit
      ) {
        toast.warning("Different units detected. Merge quantities manually.");
      } else {
        toast.success("Items merged successfully");
      }
      // Refetch to update UI
      await refetch();
    } else {
      toast.error("Failed to merge items");
    }

    // Clear state
    setPendingNewItem(null);
    setExistingMatchItem(null);
    setShowDuplicateWarning(false);
  }, [pendingNewItem, existingMatchItem, list?.id, refetch]);

  const handleAddAnyway = useCallback(async () => {
    if (!pendingNewItem) return;

    const item = await addItem(
      pendingNewItem.displayName,
      pendingNewItem.quantity
    );
    if (item) {
      toast.success(`Added ${pendingNewItem.displayName}`);
    } else {
      toast.error("Failed to add item");
    }

    // Clear state
    setPendingNewItem(null);
    setExistingMatchItem(null);
    setShowDuplicateWarning(false);
  }, [pendingNewItem, addItem]);

  const handleCloseDuplicateWarning = useCallback(() => {
    setPendingNewItem(null);
    setExistingMatchItem(null);
    setShowDuplicateWarning(false);
  }, []);

  const handleToggleItem = useCallback(
    async (itemId: string) => {
      const success = await toggleItem(itemId);
      if (!success) {
        toast.error("Failed to update item");
      }
    },
    [toggleItem]
  );

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      const success = await deleteItem(itemId);
      if (success) {
        toast.success("Item deleted");
      } else {
        toast.error("Failed to delete item");
      }
    },
    [deleteItem]
  );

  // Loading state
  if (authLoading || householdLoading || !user || !currentHousehold) {
    return null;
  }

  const isLoading = listLoading || itemsLoading;
  const hasItems = pendingGroups.length > 0 || checkedItems.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <h1 className="text-lg font-semibold">
            {list?.name || "Shopping List"}
          </h1>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings" aria-label="Settings">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Add Item Bar - Sticky below header */}
      <div className="sticky top-14 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <AddItemBar onAddItem={handleAddItem} disabled={isLoading || !list} />
      </div>

      {/* Main Content */}
      <main className="container max-w-2xl px-4 py-4">
        {isLoading ? (
          <ListSkeleton />
        ) : !hasItems ? (
          <EmptyState />
        ) : (
          <>
            {/* Pending Items by Category - Virtualized for performance */}
            {pendingGroups.length > 0 && (
              <div className="mb-6">
                <VirtualizedList
                  groups={pendingGroups}
                  onToggleItem={handleToggleItem}
                  onDeleteItem={handleDeleteItem}
                />
              </div>
            )}

            {/* Completed Items - Virtualized for performance */}
            {checkedItems.length > 0 && (
              <div className="border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowCompleted(!showCompleted)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                    "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                  aria-expanded={showCompleted}
                >
                  <span className="flex-1 font-semibold text-muted-foreground">
                    Completed
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {checkedItems.length}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      showCompleted && "rotate-180"
                    )}
                  />
                </button>

                {showCompleted && (
                  <VirtualizedCheckedList
                    items={checkedItems}
                    onToggleItem={handleToggleItem}
                    onDeleteItem={handleDeleteItem}
                  />
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Duplicate Warning Dialog */}
      {pendingNewItem && existingMatchItem && (
        <DuplicateWarning
          isOpen={showDuplicateWarning}
          onClose={handleCloseDuplicateWarning}
          newItem={pendingNewItem}
          existingItem={existingMatchItem}
          confidence={matchConfidence}
          onMerge={handleMerge}
          onAddAnyway={handleAddAnyway}
        />
      )}
    </div>
  );
}
