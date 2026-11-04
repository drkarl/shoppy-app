"use client";

import { Plus, Store } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EmptyStoreStateProps {
  onAddStore: () => void;
}

export function EmptyStoreState({ onAddStore }: EmptyStoreStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div
        className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted"
        aria-hidden="true"
      >
        <Store className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">No Store Profiles</h3>
      <p className="max-w-xs text-sm text-muted-foreground">
        Set up your first store to optimize shopping routes and organize items
        by aisle.
      </p>
      <Button onClick={onAddStore} className="mt-6">
        <Plus className="mr-1 h-4 w-4" />
        Add Your First Store
      </Button>
    </div>
  );
}
