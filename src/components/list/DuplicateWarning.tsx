"use client";

import { AlertTriangle, Merge, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

/**
 * Represents the new item being added by the user.
 */
export interface NewItemData {
  displayName: string;
  quantity: number;
  unit: string | null;
}

/**
 * Represents the existing item that was matched as a potential duplicate.
 */
export interface ExistingItemData {
  id: string;
  displayName: string;
  quantity: number;
  unit: string | null;
}

/**
 * Props for the DuplicateWarning component.
 */
export interface DuplicateWarningProps {
  /** Whether the warning is open */
  isOpen: boolean;
  /** Callback when the warning is closed (via outside click, Escape, or action) */
  onClose: () => void;
  /** The new item being added */
  newItem: NewItemData;
  /** The existing item detected as a duplicate */
  existingItem: ExistingItemData;
  /** Confidence level of the match (0.7-1.0) */
  confidence: number;
  /** Callback when user chooses to merge quantities */
  onMerge: () => void;
  /** Callback when user chooses to add as a separate item */
  onAddAnyway: () => void;
}

/**
 * Formats quantity and unit for display.
 */
function formatQuantity(quantity: number, unit: string | null): string {
  if (unit) {
    return `${quantity} ${unit}`;
  }
  return quantity.toString();
}

/**
 * Returns the confidence badge label and style based on confidence level.
 * Threshold aligns with CONFIDENCE.EXACT and CONFIDENCE.DICTIONARY in DuplicateDetector.
 */
function getConfidenceBadge(confidence: number): {
  label: string;
  className: string;
} {
  // High confidence: matches CONFIDENCE.EXACT (1.0) and CONFIDENCE.DICTIONARY (0.9)
  if (confidence >= 0.9) {
    return {
      label: "High Confidence",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };
  }
  return {
    label: "Medium Confidence",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  };
}

/**
 * Item comparison card component.
 */
function ItemCard({
  label,
  name,
  quantity,
  unit,
  variant,
}: {
  label: string;
  name: string;
  quantity: number;
  unit: string | null;
  variant: "new" | "existing";
}) {
  return (
    <div
      className={cn(
        "flex-1 rounded-lg border p-4",
        variant === "new"
          ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
          : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
      )}
    >
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-medium">{name}</p>
      <p className="text-sm text-muted-foreground">
        Qty: {formatQuantity(quantity, unit)}
      </p>
    </div>
  );
}

/**
 * Shared content for both Dialog and Sheet variants.
 */
function DuplicateWarningContent({
  newItem,
  existingItem,
  confidence,
}: Pick<DuplicateWarningProps, "newItem" | "existingItem" | "confidence">) {
  const badge = getConfidenceBadge(confidence);
  const mergedQuantity = existingItem.quantity + newItem.quantity;

  return (
    <>
      {/* Confidence Badge */}
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-yellow-500" />
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            badge.className
          )}
          data-testid="confidence-badge"
        >
          {badge.label}
        </span>
      </div>

      {/* Item Comparison */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <ItemCard
          label="Adding"
          name={newItem.displayName}
          quantity={newItem.quantity}
          unit={newItem.unit}
          variant="new"
        />
        <ItemCard
          label="Already in list"
          name={existingItem.displayName}
          quantity={existingItem.quantity}
          unit={existingItem.unit}
          variant="existing"
        />
      </div>

      {/* Merge Preview */}
      {/* Unit precedence: existingItem.unit takes priority over newItem.unit */}
      <div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-3">
        <p className="text-sm">
          <span className="font-medium">Merged result:</span>{" "}
          {existingItem.displayName} &times;{" "}
          {formatQuantity(mergedQuantity, existingItem.unit || newItem.unit)}
        </p>
      </div>
    </>
  );
}

/**
 * DuplicateWarning component displays a warning when a potential duplicate item
 * is detected in the shopping list. It shows a comparison between the new item
 * and the existing item, with options to merge quantities or add anyway.
 *
 * On mobile viewports (< 768px), renders as a bottom Sheet.
 * On desktop viewports (>= 768px), renders as a centered Dialog.
 */
export function DuplicateWarning({
  isOpen,
  onClose,
  newItem,
  existingItem,
  confidence,
  onMerge,
  onAddAnyway,
}: DuplicateWarningProps) {
  const isMobile = useIsMobile();

  const handleMerge = () => {
    onMerge();
    onClose();
  };

  const handleAddAnyway = () => {
    onAddAnyway();
    onClose();
  };

  // During SSR or initial render, don't show anything
  if (isMobile === undefined) {
    return null;
  }

  // Mobile: Render as bottom Sheet
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          className="rounded-t-xl"
          aria-describedby="duplicate-warning-description"
        >
          <SheetHeader>
            <SheetTitle>Possible Duplicate Item</SheetTitle>
            <SheetDescription id="duplicate-warning-description">
              This item might already be on your list.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-4">
            <DuplicateWarningContent
              newItem={newItem}
              existingItem={existingItem}
              confidence={confidence}
            />
          </div>
          <SheetFooter className="mt-6 flex-col gap-2 sm:flex-col">
            <Button onClick={handleMerge} className="w-full">
              <Merge className="mr-2 h-4 w-4" />
              Merge Quantities
            </Button>
            <Button
              variant="outline"
              onClick={handleAddAnyway}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Anyway
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Render as Dialog
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby="duplicate-warning-description">
        <DialogHeader>
          <DialogTitle>Possible Duplicate Item</DialogTitle>
          <DialogDescription id="duplicate-warning-description">
            This item might already be on your list.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <DuplicateWarningContent
            newItem={newItem}
            existingItem={existingItem}
            confidence={confidence}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleAddAnyway}>
            <Plus className="mr-2 h-4 w-4" />
            Add Anyway
          </Button>
          <Button onClick={handleMerge}>
            <Merge className="mr-2 h-4 w-4" />
            Merge Quantities
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
