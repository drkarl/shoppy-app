"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface ItemCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}

export function ItemCheckbox({
  checked,
  onToggle,
  disabled = false,
  className,
}: ItemCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/50 bg-background hover:border-primary/50",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {checked && <Check className="h-4 w-4" strokeWidth={3} />}
    </button>
  );
}
