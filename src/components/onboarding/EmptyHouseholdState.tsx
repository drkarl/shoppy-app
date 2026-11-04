"use client";

import { Home, Plus, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EmptyHouseholdStateProps {
  onCreateHousehold: () => void;
  onJoinHousehold: () => void;
}

export function EmptyHouseholdState({
  onCreateHousehold,
  onJoinHousehold,
}: EmptyHouseholdStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div
        className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted"
        aria-hidden="true"
      >
        <Home className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">Welcome to Shoppy!</h3>
      <p className="max-w-xs text-sm text-muted-foreground">
        Create or join a household to start sharing shopping lists with your
        family or roommates.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button onClick={onCreateHousehold}>
          <Plus className="mr-1 h-4 w-4" />
          Create Household
        </Button>
        <Button variant="outline" onClick={onJoinHousehold}>
          <UserPlus className="mr-1 h-4 w-4" />
          Join Household
        </Button>
      </div>
    </div>
  );
}
