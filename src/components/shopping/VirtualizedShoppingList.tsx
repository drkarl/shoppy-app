"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
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
import { memo, useCallback, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import type {
  Category,
  CategoryGroup,
  ListItem as ListItemType,
} from "@/types/list";

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

const ITEM_HEIGHT = 68;
const CATEGORY_HEADER_HEIGHT = 64;
const VIRTUALIZATION_THRESHOLD = 50;

type VirtualizedRow =
  | {
      type: "category-header";
      category: Category | null;
      items: ListItemType[];
      categoryId: string;
    }
  | { type: "item"; item: ListItemType };

interface VirtualizedShoppingItemProps {
  item: ListItemType;
  onToggle: () => void;
  disabled?: boolean;
}

const VirtualizedShoppingItem = memo(function VirtualizedShoppingItem({
  item,
  onToggle,
  disabled = false,
}: VirtualizedShoppingItemProps) {
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
});

interface VirtualizedCategoryHeaderProps {
  category: Category | null;
  items: ListItemType[];
  isExpanded: boolean;
  onToggle: () => void;
}

const VirtualizedCategoryHeader = memo(function VirtualizedCategoryHeader({
  category,
  items,
  isExpanded,
  onToggle,
}: VirtualizedCategoryHeaderProps) {
  const IconComponent = category?.icon
    ? CATEGORY_ICONS[category.icon] || Package
    : Package;
  const categoryName = category?.name || "Other";
  const checkedCount = items.filter((i) => i.status === "checked").length;
  const allChecked = checkedCount === items.length && items.length > 0;

  return (
    <button
      type="button"
      onClick={onToggle}
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
          allChecked ? "bg-green-500/20 dark:bg-green-400/20" : "bg-primary/10"
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
  );
});

interface VirtualizedShoppingListProps {
  groups: CategoryGroup[];
  onToggleItem: (itemId: string) => void;
}

export function VirtualizedShoppingList({
  groups,
  onToggleItem,
}: VirtualizedShoppingListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );

  const toggleCategory = useCallback((categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // Flatten groups into rows for virtualization
  const rows = useMemo(() => {
    const result: VirtualizedRow[] = [];
    for (const group of groups) {
      const categoryId = group.category?.id || "uncategorized";
      result.push({
        type: "category-header",
        category: group.category,
        items: group.items,
        categoryId,
      });

      if (!collapsedCategories.has(categoryId)) {
        for (const item of group.items) {
          result.push({ type: "item", item });
        }
      }
    }
    return result;
  }, [groups, collapsedCategories]);

  const totalItems = useMemo(() => {
    return groups.reduce((sum, g) => sum + g.items.length, 0);
  }, [groups]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) =>
      rows[index]?.type === "category-header"
        ? CATEGORY_HEADER_HEIGHT
        : ITEM_HEIGHT,
    overscan: 10,
  });

  // For small lists, render without virtualization
  if (totalItems < VIRTUALIZATION_THRESHOLD) {
    return (
      <div className="space-y-4">
        {groups.map((group) => {
          const categoryId = group.category?.id || "uncategorized";
          const isExpanded = !collapsedCategories.has(categoryId);
          return (
            <div key={categoryId} className="mb-4">
              <VirtualizedCategoryHeader
                category={group.category}
                items={group.items}
                isExpanded={isExpanded}
                onToggle={() => toggleCategory(categoryId)}
              />
              {isExpanded && (
                <div className="mt-2 space-y-2 px-2">
                  {group.items.map((item) => (
                    <VirtualizedShoppingItem
                      key={item.id}
                      item={item}
                      onToggle={() => onToggleItem(item.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // For large lists, use virtualization
  return (
    <div
      ref={parentRef}
      className="max-h-[calc(100vh-250px)] overflow-auto"
      style={{ contain: "strict" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;

          if (row.type === "category-header") {
            const isExpanded = !collapsedCategories.has(row.categoryId);
            return (
              <div
                key={`header-${row.categoryId}`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <VirtualizedCategoryHeader
                  category={row.category}
                  items={row.items}
                  isExpanded={isExpanded}
                  onToggle={() => toggleCategory(row.categoryId)}
                />
              </div>
            );
          }

          return (
            <div
              key={row.item.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                paddingLeft: "8px",
                paddingRight: "8px",
              }}
            >
              <VirtualizedShoppingItem
                item={row.item}
                onToggle={() => onToggleItem(row.item.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface VirtualizedCheckedShoppingListProps {
  items: ListItemType[];
  onToggleItem: (itemId: string) => void;
}

export function VirtualizedCheckedShoppingList({
  items,
  onToggleItem,
}: VirtualizedCheckedShoppingListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 10,
  });

  // For small lists, render without virtualization
  if (items.length < VIRTUALIZATION_THRESHOLD) {
    return (
      <div className="space-y-2 px-2">
        {items.map((item) => (
          <VirtualizedShoppingItem
            key={item.id}
            item={item}
            onToggle={() => onToggleItem(item.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="max-h-[300px] overflow-auto px-2"
      style={{ contain: "strict" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          if (!item) return null;

          return (
            <div
              key={item.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <VirtualizedShoppingItem
                item={item}
                onToggle={() => onToggleItem(item.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
