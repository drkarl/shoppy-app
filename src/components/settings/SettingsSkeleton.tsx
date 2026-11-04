"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for a settings menu item (used in main settings page).
 * Matches the layout of setting card links with icon, title, and description.
 */
export function SettingsMenuItemSkeleton() {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        {/* Icon circle */}
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5">
          {/* Title */}
          <Skeleton className="h-4 w-28" />
          {/* Description */}
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      {/* Chevron */}
      <Skeleton className="h-5 w-5" />
    </div>
  );
}

/**
 * Skeleton for a store profile card matching StoreProfileCard layout.
 * Used on the store profiles settings page.
 */
export function StoreProfileCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            {/* Store name */}
            <Skeleton className="h-5 w-32" />
            {/* Category count */}
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* Action buttons */}
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

interface StoreProfilesSkeletonProps {
  count?: number;
}

/**
 * Skeleton for the store profiles list.
 */
export function StoreProfilesSkeleton({
  count = 2,
}: StoreProfilesSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <StoreProfileCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for the main settings page menu items.
 */
export function SettingsMenuSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-5 w-24" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-48" />
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <SettingsMenuItemSkeleton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-5 w-28" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-56" />
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <SettingsMenuItemSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}
