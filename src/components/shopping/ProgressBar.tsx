"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  checked: number;
  total: number;
  className?: string;
}

export function ProgressBar({ checked, total, className }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;
  const isComplete = checked === total && total > 0;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          {checked} of {total} items
        </span>
        {isComplete && (
          <span className="font-medium text-green-600 dark:text-green-400">
            Complete!
          </span>
        )}
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300 ease-out",
            isComplete ? "bg-green-500 dark:bg-green-400" : "bg-primary"
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={checked}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${checked} of ${total} items checked`}
        />
      </div>
    </div>
  );
}
