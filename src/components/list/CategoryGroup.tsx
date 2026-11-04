"use client";

import {
  Baby,
  Beef,
  Candy,
  Carrot,
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

import { ListItem } from "./ListItem";

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

interface CategoryGroupProps {
  category: Category | null;
  items: ListItemType[];
  onToggleItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onEditItem?: (itemId: string) => void;
  defaultExpanded?: boolean;
}

export function CategoryGroup({
  category,
  items,
  onToggleItem,
  onDeleteItem,
  onEditItem,
  defaultExpanded = true,
}: CategoryGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const IconComponent = category?.icon
    ? CATEGORY_ICONS[category.icon] || Package
    : Package;

  const categoryName = category?.name || "Other";

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors",
          "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        aria-expanded={isExpanded}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <IconComponent className="h-4 w-4 text-primary" />
        </div>
        <span className="flex-1 font-semibold">{categoryName}</span>
        <span className="text-sm text-muted-foreground">{items.length}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {isExpanded && (
        <div className="mt-1 space-y-1 pl-2">
          {items.map((item) => (
            <ListItem
              key={item.id}
              item={item}
              onToggle={() => onToggleItem(item.id)}
              onDelete={() => onDeleteItem(item.id)}
              onEdit={onEditItem ? () => onEditItem(item.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
