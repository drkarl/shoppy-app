"use client";

import {
  Baby,
  Beef,
  Candy,
  Carrot,
  Check,
  ChevronDown,
  Coffee,
  Cookie,
  Croissant,
  Fish,
  Milk,
  Package,
  ShowerHead,
  Snowflake,
  Sparkles,
  Utensils,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import type { Category, ListItem as ListItemType } from "@/types/list";

// Map icon names from database to Lucide components
const CATEGORY_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  carrot: Carrot,
  beef: Beef,
  fish: Fish,
  milk: Milk,
  croissant: Croissant,
  utensils: Utensils,
  snowflake: Snowflake,
  candy: Candy,
  cookie: Cookie,
  coffee: Coffee,
  baby: Baby,
  sparkles: Sparkles,
  "shower-head": ShowerHead,
  package: Package,
};

interface ShoppingItemProps {
  item: ListItemType;
  onToggle: () => void;
  disabled?: boolean;
}

export function ShoppingItem({
  item,
  onToggle,
  disabled = false,
}: ShoppingItemProps) {
  const isChecked = item.status === "checked";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition-all",
        "active:scale-[0.98]",
        isChecked ? "bg-muted/30" : "bg-card hover:bg-muted/50 active:bg-muted"
      )}
    >
      {/* Large checkbox for easy tapping - 44x44px minimum tap target */}
      <div
        role="checkbox"
        aria-checked={isChecked}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition-all",
          isChecked
            ? "border-green-500 bg-green-500 text-white dark:border-green-400 dark:bg-green-400"
            : "border-muted-foreground/40 bg-background hover:border-primary/50"
        )}
      >
        {isChecked && <Check className="h-6 w-6" strokeWidth={3} />}
      </div>

      {/* Item details */}
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate text-base font-medium",
            isChecked && "text-muted-foreground line-through"
          )}
        >
          {item.display_name}
        </span>
        {(item.quantity > 1 || item.unit) && (
          <span
            className={cn(
              "text-sm text-muted-foreground",
              isChecked && "line-through"
            )}
          >
            {item.quantity > 1 ? `x${item.quantity}` : ""}
            {item.quantity > 1 && item.unit ? " " : ""}
            {item.unit || ""}
          </span>
        )}
      </div>
    </button>
  );
}

interface ShoppingCategoryGroupProps {
  category: Category | null;
  items: ListItemType[];
  onToggleItem: (itemId: string) => void;
  defaultExpanded?: boolean;
}

export function ShoppingCategoryGroup({
  category,
  items,
  onToggleItem,
  defaultExpanded = true,
}: ShoppingCategoryGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const IconComponent = category?.icon
    ? CATEGORY_ICONS[category.icon] || Package
    : Package;

  const categoryName = category?.name || "Other";
  const checkedCount = items.filter((i) => i.status === "checked").length;
  const allChecked = checkedCount === items.length && items.length > 0;

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors",
          "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          allChecked && "opacity-60"
        )}
        aria-expanded={isExpanded}
      >
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
            allChecked
              ? "bg-green-500/20 dark:bg-green-400/20"
              : "bg-primary/10"
          )}
        >
          <IconComponent
            className={cn(
              "h-5 w-5",
              allChecked ? "text-green-600 dark:text-green-400" : "text-primary"
            )}
          />
        </div>
        <span
          className={cn(
            "flex-1 text-lg font-semibold",
            allChecked && "text-muted-foreground line-through"
          )}
        >
          {categoryName}
        </span>
        <span className="text-sm text-muted-foreground">
          {checkedCount}/{items.length}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2 px-2">
          {items.map((item) => (
            <ShoppingItem
              key={item.id}
              item={item}
              onToggle={() => onToggleItem(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
