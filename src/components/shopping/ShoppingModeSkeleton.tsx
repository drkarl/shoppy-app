"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for a single shopping item matching ShoppingItem layout.
 * Features larger tap targets (44x44px checkbox) for mobile use.
 */
function ShoppingItemSkeleton({
  showQuantity = false,
}: {
  showQuantity?: boolean;
}) {
  return (
    <div className="flex w-full items-center gap-4 rounded-xl bg-card px-4 py-3">
      {/* Large checkbox placeholder - 44x44px tap target */}
      <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
      {/* Item details */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-4 w-36" />
        {showQuantity && <Skeleton className="h-3 w-12" />}
      </div>
    </div>
  );
}

interface ShoppingGroupSkeletonProps {
  itemCount?: number;
}

/**
 * Skeleton for a shopping category group matching ShoppingCategoryGroup layout.
 */
function ShoppingGroupSkeleton({ itemCount = 3 }: ShoppingGroupSkeletonProps) {
  return (
    <div className="mb-4">
      {/* Category header */}
      <div className="flex w-full items-center gap-3 rounded-xl px-4 py-3">
        {/* Category icon */}
        <Skeleton className="h-10 w-10 rounded-xl" />
        {/* Category name */}
        <Skeleton className="h-5 max-w-28 flex-1" />
        {/* Count badge */}
        <Skeleton className="h-4 w-8" />
        {/* Chevron */}
        <Skeleton className="h-5 w-5" />
      </div>

      {/* Items */}
      <div className="mt-2 space-y-2 px-2">
        {Array.from({ length: itemCount }).map((_, i) => (
          <ShoppingItemSkeleton key={i} showQuantity={i % 2 === 1} />
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for the progress bar matching ProgressBar layout.
 */
function ProgressBarSkeleton() {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="mt-2 h-2 w-full rounded-full" />
    </div>
  );
}

interface ShoppingModeSkeletonProps {
  groupCount?: number;
  itemsPerGroup?: number | number[];
  showProgressBar?: boolean;
}

/**
 * Full shopping mode skeleton.
 * Matches the layout of the shopping mode page main content area.
 * Does not include container wrapper - should be used inside a container.
 */
export function ShoppingModeSkeleton({
  groupCount = 3,
  itemsPerGroup = [2, 3, 2],
  showProgressBar = false,
}: ShoppingModeSkeletonProps) {
  const itemCounts = Array.isArray(itemsPerGroup)
    ? itemsPerGroup
    : Array(groupCount).fill(itemsPerGroup);

  return (
    <>
      {/* Progress bar skeleton - caller should handle sticky positioning */}
      {showProgressBar && <ProgressBarSkeleton />}

      {/* Content skeleton */}
      {Array.from({ length: groupCount }).map((_, i) => (
        <ShoppingGroupSkeleton
          key={i}
          itemCount={itemCounts[i] ?? itemCounts[0] ?? 3}
        />
      ))}
    </>
  );
}

export { ProgressBarSkeleton, ShoppingGroupSkeleton, ShoppingItemSkeleton };
