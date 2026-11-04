"use client";

import { Home, Loader2 } from "lucide-react";
import { useState } from "react";

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

interface CreateHouseholdStepProps {
  onNext: (householdName: string) => Promise<void>;
  onBack: () => void;
}

export function CreateHouseholdStep({
  onNext,
  onBack,
}: CreateHouseholdStepProps) {
  const [householdName, setHouseholdName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = householdName.trim();
    if (!trimmedName) {
      setError("Please enter a household name");
      return;
    }

    if (trimmedName.length > 50) {
      setError("Household name must be 50 characters or less");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await onNext(trimmedName);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create household"
      );
      setIsCreating(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Home className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">Create Your Household</CardTitle>
        <CardDescription className="text-base">
          Give your household a name to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="household-name">Household Name</Label>
            <Input
              id="household-name"
              value={householdName}
              onChange={(e) => {
                setHouseholdName(e.target.value);
                setError(null);
              }}
              placeholder="e.g., Smith Family, Our Home"
              maxLength={50}
              disabled={isCreating}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={isCreating}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={!householdName.trim() || isCreating}
              className="flex-1"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Household"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
