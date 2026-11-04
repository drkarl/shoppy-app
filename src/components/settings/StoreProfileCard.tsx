"use client";

import { Pencil, Star, StarOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useCallback } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

import type { StoreProfile } from "@/types/store-profile";

interface StoreProfileCardProps {
  store: StoreProfile;
  onDelete: (storeId: string) => Promise<void>;
  onToggleDefault: (storeId: string, isDefault: boolean) => Promise<void>;
  isDeleting?: boolean;
  isTogglingDefault?: boolean;
}

export function StoreProfileCard({
  store,
  onDelete,
  onToggleDefault,
  isDeleting = false,
  isTogglingDefault = false,
}: StoreProfileCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDelete = useCallback(async () => {
    await onDelete(store.id);
    setDeleteDialogOpen(false);
  }, [store.id, onDelete]);

  const handleToggleDefault = useCallback(async () => {
    await onToggleDefault(store.id, !store.is_default);
  }, [store.id, store.is_default, onToggleDefault]);

  return (
    <Card data-testid={`store-card-${store.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{store.store_name}</CardTitle>
            <CardDescription className="mt-1">
              {store.category_order.length} categories configured
            </CardDescription>
          </div>
          {store.is_default && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              <Star className="h-3 w-3 fill-current" />
              Default
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleDefault}
            disabled={isTogglingDefault}
            aria-label={
              store.is_default
                ? `Remove ${store.store_name} as default store`
                : `Set ${store.store_name} as default store`
            }
          >
            {store.is_default ? (
              <>
                <StarOff className="mr-1 h-4 w-4" />
                Remove Default
              </>
            ) : (
              <>
                <Star className="mr-1 h-4 w-4" />
                Set as Default
              </>
            )}
          </Button>

          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/settings/stores/${store.id}`}
              aria-label={`Edit ${store.store_name}`}
            >
              <Pencil className="mr-1 h-4 w-4" />
              Edit
            </Link>
          </Button>

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                aria-label={`Delete ${store.store_name}`}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Store Profile</DialogTitle>
                <DialogDescription>
                  Delete {store.store_name} profile? This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isDeleting}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
