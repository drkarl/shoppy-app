"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface ListSkeletonItemProps {
  showQuantity?: boolean;
}

/**
 * Skeleton for a single list item matching the ListItem component layout.
 * Shows checkbox, item name, and optionally quantity placeholders.
 */
function ListSkeletonItem({ showQuantity = false }: ListSkeletonItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2">
      {/* Checkbox placeholder */}
      <Skeleton className="h-5 w-5 shrink-0 rounded" />
      {/* Item name and quantity */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Skeleton className="h-4 w-32" />
        {showQuantity && <Skeleton className="h-3 w-8 shrink-0" />}
      </div>
      {/* Actions placeholder */}
      <Skeleton className="h-8 w-8 shrink-0 rounded" />
    </div>
  );
}

interface ListSkeletonGroupProps {
  itemCount?: number;
}

/**
 * Skeleton for a category group matching the CategoryGroup component layout.
 * Shows category header with icon, name, count, and expand arrow.
 */
function ListSkeletonGroup({ itemCount = 3 }: ListSkeletonGroupProps) {
  return (
    <div className="mb-4">
      {/* Category header */}
      <div className="flex w-full items-center gap-2 rounded-lg px-3 py-2">
        {/* Category icon */}
        <Skeleton className="h-8 w-8 rounded-lg" />
        {/* Category name */}
        <Skeleton className="h-5 max-w-24 flex-1" />
        {/* Item count */}
        <Skeleton className="h-4 w-4" />
        {/* Expand chevron */}
        <Skeleton className="h-4 w-4" />
      </div>

      {/* Items */}
      <div className="mt-1 space-y-1 pl-2">
        {Array.from({ length: itemCount }).map((_, i) => (
          <ListSkeletonItem key={i} showQuantity={i % 3 === 1} />
        ))}
      </div>
    </div>
  );
}

interface ListSkeletonProps {
  groupCount?: number;
  itemsPerGroup?: number | number[];
}

/**
 * Full list skeleton showing multiple category groups.
 * Matches the layout of the list page main content area.
 */
export function ListSkeleton({
  groupCount = 3,
  itemsPerGroup = [3, 2, 4],
}: ListSkeletonProps) {
  const itemCounts = Array.isArray(itemsPerGroup)
    ? itemsPerGroup
    : Array(groupCount).fill(itemsPerGroup);

  return (
    <div className="mb-6">
      {Array.from({ length: groupCount }).map((_, i) => (
        <ListSkeletonGroup
          key={i}
          itemCount={itemCounts[i] ?? itemCounts[0] ?? 3}
        />
      ))}
    </div>
  );
}

export { ListSkeletonGroup, ListSkeletonItem };
