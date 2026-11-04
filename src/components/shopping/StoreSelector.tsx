"use client";

import { Store, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

import { Button } from "@/components/ui/button";

import type { StoreProfile } from "@/types/store-profile";

interface StoreSelectorProps {
  stores: StoreProfile[];
  selectedStore: StoreProfile | null;
  onSelect: (store: StoreProfile) => void;
}

export function StoreSelector({
  stores,
  selectedStore,
  onSelect,
}: StoreSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (store: StoreProfile) => {
      onSelect(store);
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
    (e: React.KeyboardEvent, store: StoreProfile) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelect(store);
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

  if (stores.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Store className="h-4 w-4" />
        <span className="max-w-[150px] truncate">
          {selectedStore?.store_name || "Select store"}
        </span>
        <ChevronDown className="h-4 w-4" />
        <span className="sr-only">Switch store</span>
      </Button>
      {isOpen && (
        <div
          className="absolute left-0 top-full z-50 pt-1"
          role="listbox"
          aria-label="Select store"
        >
          <div className="min-w-[200px] rounded-md border bg-popover p-1 shadow-md">
            {stores.map((store) => (
              <button
                key={store.id}
                role="option"
                aria-selected={selectedStore?.id === store.id}
                onClick={() => handleSelect(store)}
                onKeyDown={(e) => handleItemKeyDown(e, store)}
                className={`flex w-full items-center justify-between gap-2 rounded px-3 py-1.5 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none ${
                  selectedStore?.id === store.id ? "bg-accent" : ""
                }`}
              >
                <span className="truncate">{store.store_name}</span>
                {store.is_default && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    ★ Default
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
