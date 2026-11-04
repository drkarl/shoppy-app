"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Baby,
  Beef,
  Carrot,
  Cookie,
  CupSoda,
  GripVertical,
  Milk,
  Package,
  Snowflake,
  SprayCan,
  Bath,
} from "lucide-react";
import { useState, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CategoryItem {
  id: string;
  name: string;
  icon: string;
}

interface CategoryOrderListProps {
  categories: CategoryItem[];
  categoryOrder: string[];
  onSave: (newOrder: string[]) => Promise<void>;
  isSaving?: boolean;
}

// Map icon names from database to Lucide components
const CATEGORY_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  carrot: Carrot,
  beef: Beef,
  milk: Milk,
  // TODO: Add a proper bread-slice icon when available in Lucide
  "bread-slice": Carrot,
  package: Package,
  snowflake: Snowflake,
  cookie: Cookie,
  "cup-soda": CupSoda,
  baby: Baby,
  "spray-can": SprayCan,
  bath: Bath,
};

interface SortableCategoryItemProps {
  category: CategoryItem;
  isDragging?: boolean;
}

function SortableCategoryItem({
  category,
  isDragging = false,
}: SortableCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const IconComponent = CATEGORY_ICONS[category.icon] || Package;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors",
        (isDragging || isSortableDragging) && "opacity-50",
        "hover:bg-accent/50"
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${category.name}`}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
        <IconComponent className="h-4 w-4 text-primary" />
      </div>
      <span className="flex-1 font-medium">{category.name}</span>
    </div>
  );
}

interface DragOverlayItemProps {
  category: CategoryItem;
}

function DragOverlayItem({ category }: DragOverlayItemProps) {
  const IconComponent = CATEGORY_ICONS[category.icon] || Package;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-lg">
      <div className="cursor-grabbing text-muted-foreground">
        <GripVertical className="h-5 w-5" />
      </div>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
        <IconComponent className="h-4 w-4 text-primary" />
      </div>
      <span className="flex-1 font-medium">{category.name}</span>
    </div>
  );
}

export function CategoryOrderList({
  categories,
  categoryOrder,
  onSave,
  isSaving = false,
}: CategoryOrderListProps) {
  // Create ordered list of categories based on categoryOrder
  const getOrderedCategories = useCallback(() => {
    const orderedCategories: CategoryItem[] = [];
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    // Add categories in the specified order
    for (const id of categoryOrder) {
      const category = categoryMap.get(id);
      if (category) {
        orderedCategories.push(category);
        categoryMap.delete(id);
      }
    }

    // Add any remaining categories not in the order
    for (const category of categoryMap.values()) {
      orderedCategories.push(category);
    }

    return orderedCategories;
  }, [categories, categoryOrder]);

  const [items, setItems] = useState<CategoryItem[]>(getOrderedCategories);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync items when props change (e.g., after saving in another tab)
  // Using React's recommended pattern of adjusting state during render
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevCategoryOrder, setPrevCategoryOrder] = useState(categoryOrder);
  if (prevCategoryOrder !== categoryOrder) {
    setPrevCategoryOrder(categoryOrder);
    setItems(getOrderedCategories());
    setHasChanges(false);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setItems((currentItems) => {
        const oldIndex = currentItems.findIndex(
          (item) => item.id === active.id
        );
        const newIndex = currentItems.findIndex((item) => item.id === over.id);

        return arrayMove(currentItems, oldIndex, newIndex);
      });
      setHasChanges(true);
    }
  }, []);

  const handleSave = useCallback(async () => {
    const newOrder = items.map((item) => item.id);
    await onSave(newOrder);
    setHasChanges(false);
  }, [items, onSave]);

  const activeCategory = activeId
    ? items.find((item) => item.id === activeId)
    : null;

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2" role="list" aria-label="Category order">
            {items.map((category) => (
              <SortableCategoryItem
                key={category.id}
                category={category}
                isDragging={activeId === category.id}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeCategory ? (
            <DragOverlayItem category={activeCategory} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? "Saving..." : "Save Order"}
        </Button>
      </div>
    </div>
  );
}
