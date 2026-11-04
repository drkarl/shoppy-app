"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
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
import { memo, useCallback, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { ListItem } from "./ListItem";

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

const ITEM_HEIGHT = 48;
const CATEGORY_HEADER_HEIGHT = 52;
const VIRTUALIZATION_THRESHOLD = 50;

type VirtualizedRow =
  | {
      type: "category-header";
      category: Category | null;
      itemCount: number;
      categoryId: string;
    }
  | { type: "item"; item: ListItemType };

interface VirtualizedCategoryHeaderProps {
  category: Category | null;
  itemCount: number;
  isExpanded: boolean;
  onToggle: () => void;
}

const VirtualizedCategoryHeader = memo(function VirtualizedCategoryHeader({
  category,
  itemCount,
  isExpanded,
  onToggle,
}: VirtualizedCategoryHeaderProps) {
  const IconComponent = category?.icon
    ? CATEGORY_ICONS[category.icon] || Package
    : Package;
  const categoryName = category?.name || "Other";

  return (
    <button
      type="button"
      onClick={onToggle}
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
      <span className="text-sm text-muted-foreground">{itemCount}</span>
      <ChevronDown
        className={cn(
          "h-4 w-4 text-muted-foreground transition-transform",
          isExpanded && "rotate-180"
        )}
      />
    </button>
  );
});

interface VirtualizedListProps {
  groups: CategoryGroup[];
  onToggleItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onEditItem?: (itemId: string) => void;
}

export function VirtualizedList({
  groups,
  onToggleItem,
  onDeleteItem,
  onEditItem,
}: VirtualizedListProps) {
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
        itemCount: group.items.length,
        categoryId,
      });

      // Only add items if category is not collapsed
      if (!collapsedCategories.has(categoryId)) {
        for (const item of group.items) {
          result.push({ type: "item", item });
        }
      }
    }
    return result;
  }, [groups, collapsedCategories]);

  // Calculate total items for virtualization decision
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
                itemCount={group.items.length}
                isExpanded={isExpanded}
                onToggle={() => toggleCategory(categoryId)}
              />
              {isExpanded && (
                <div className="mt-1 space-y-1 pl-2">
                  {group.items.map((item) => (
                    <ListItem
                      key={item.id}
                      item={item}
                      onToggle={() => onToggleItem(item.id)}
                      onDelete={() => onDeleteItem(item.id)}
                      onEdit={
                        onEditItem ? () => onEditItem(item.id) : undefined
                      }
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
      className="max-h-[calc(100vh-200px)] overflow-auto"
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
                  itemCount={row.itemCount}
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
              }}
            >
              <ListItem
                item={row.item}
                onToggle={() => onToggleItem(row.item.id)}
                onDelete={() => onDeleteItem(row.item.id)}
                onEdit={onEditItem ? () => onEditItem(row.item.id) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface VirtualizedCheckedListProps {
  items: ListItemType[];
  onToggleItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
}

export function VirtualizedCheckedList({
  items,
  onToggleItem,
  onDeleteItem,
}: VirtualizedCheckedListProps) {
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
      <div className="space-y-1 pl-2">
        {items.map((item) => (
          <ListItem
            key={item.id}
            item={item}
            onToggle={() => onToggleItem(item.id)}
            onDelete={() => onDeleteItem(item.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="max-h-[300px] overflow-auto pl-2"
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
              <ListItem
                item={item}
                onToggle={() => onToggleItem(item.id)}
                onDelete={() => onDeleteItem(item.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
