"use client";

import { Loader2, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCategories } from "@/hooks/useCategories";

interface StoreProfileStepProps {
  householdId: string;
  onNext: () => void;
  onSkip: () => void;
}

export function StoreProfileStep({
  householdId,
  onNext,
  onSkip,
}: StoreProfileStepProps) {
  const [storeName, setStoreName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { categories } = useCategories();

  const handleCreateStore = async () => {
    const trimmedName = storeName.trim();
    if (!trimmedName) return;

    setIsCreating(true);

    try {
      const defaultCategoryOrder = categories.map((cat) => cat.id);

      const response = await fetch("/api/store-profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          household_id: householdId,
          store_name: trimmedName,
          category_order: defaultCategoryOrder,
          is_default: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create store profile");
      }

      toast.success(`Store "${trimmedName}" created`);
      onNext();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create store profile";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Store className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">Add Your First Store</CardTitle>
        <CardDescription className="text-base">
          Create a store profile to customize item ordering based on store
          layout
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="store-name">Store Name</Label>
          <Input
            id="store-name"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="e.g., Lidl, Aldi, Walmart"
            maxLength={100}
            disabled={isCreating}
            onKeyDown={(e) => {
              if (e.key === "Enter" && storeName.trim()) {
                handleCreateStore();
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            You can add more stores and customize category ordering later in
            Settings.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleCreateStore}
            disabled={!storeName.trim() || isCreating}
            className="w-full"
            size="lg"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Store Profile"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={isCreating}
            className="w-full"
          >
            Skip for now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
