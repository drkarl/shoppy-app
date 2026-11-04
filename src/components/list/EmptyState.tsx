"use client";

import { ShoppingCart, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  /** Label for the CTA button. Button only renders when both actionLabel and onAction are provided. */
  actionLabel?: string;
  /** Callback for the CTA button. Button only renders when both actionLabel and onAction are provided. */
  onAction?: () => void;
}

export function EmptyState({
  title = "Your list is empty",
  description = "Add your first item using the input above",
  icon: Icon = ShoppingCart,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div
        className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted"
        aria-hidden="true"
      >
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-6">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
