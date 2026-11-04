"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ItemActionsProps {
  onEdit?: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function ItemActions({ onEdit, onDelete, disabled }: ItemActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Check if the new focus target is within the menu
    if (!menuRef.current?.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
    }
  }, []);

  const handleDelete = useCallback(() => {
    setIsOpen(false);
    onDelete();
  }, [onDelete]);

  const handleEdit = useCallback(() => {
    setIsOpen(false);
    onEdit?.();
  }, [onEdit]);

  return (
    <div className="relative" ref={menuRef} onBlur={handleBlur}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Item actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-full z-50 mt-1 min-w-32 overflow-hidden rounded-md border bg-popover p-1 shadow-md",
            "animate-in fade-in-0 zoom-in-95"
          )}
        >
          {onEdit && (
            <button
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus:bg-accent"
              onClick={handleEdit}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
          <button
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-destructive/10 focus:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
