"use client";

import { Home, ChevronDown, LogOut, Loader2 } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import {
  useHousehold,
  type Household,
} from "@/components/providers/HouseholdProvider";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { user, signOut } = useAuth();
  const { currentHousehold, households, isLoading, setCurrentHousehold } =
    useHousehold();

  const hasMultipleHouseholds = households.length > 1;

  if (!user) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Home className="h-5 w-5 text-muted-foreground" />
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : currentHousehold ? (
            <div className="flex items-center gap-1">
              <span className="font-medium">{currentHousehold.name}</span>
              {hasMultipleHouseholds && (
                <HouseholdSwitcher
                  households={households}
                  currentHousehold={currentHousehold}
                  onSelect={setCurrentHousehold}
                />
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">No household</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {user.email}
          </span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

interface HouseholdSwitcherProps {
  households: Household[];
  currentHousehold: Household;
  onSelect: (household: Household) => void;
}

function HouseholdSwitcher({
  households,
  currentHousehold,
  onSelect,
}: HouseholdSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const otherHouseholds = households.filter(
    (h) => h.id !== currentHousehold.id
  );

  const handleSelect = useCallback(
    (household: Household) => {
      onSelect(household);
      setIsOpen(false);
    },
    [onSelect]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  }, []);

  const handleItemKeyDown = useCallback(
    (e: React.KeyboardEvent, household: Household) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelect(household);
      }
    },
    [handleSelect]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-1"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <ChevronDown className="h-4 w-4" />
        <span className="sr-only">Switch household</span>
      </Button>
      {isOpen && (
        <div
          className="absolute left-0 top-full pt-1"
          role="listbox"
          aria-label="Select household"
        >
          <div className="rounded-md border bg-popover p-1 shadow-md">
            {otherHouseholds.map((household) => (
              <button
                key={household.id}
                role="option"
                aria-selected={false}
                onClick={() => handleSelect(household)}
                onKeyDown={(e) => handleItemKeyDown(e, household)}
                className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
              >
                {household.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
