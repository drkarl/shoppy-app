"use client";

import { cn } from "@/lib/utils";

import { ItemActions } from "./ItemActions";
import { ItemCheckbox } from "./ItemCheckbox";

import type { ListItem as ListItemType } from "@/types/list";

interface ListItemProps {
  item: ListItemType;
  onToggle: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  disabled?: boolean;
}

export function ListItem({
  item,
  onToggle,
  onDelete,
  onEdit,
  disabled = false,
}: ListItemProps) {
  const isChecked = item.status === "checked";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
        "hover:bg-muted/50",
        isChecked && "opacity-60"
      )}
    >
      <ItemCheckbox
        checked={isChecked}
        onToggle={onToggle}
        disabled={disabled}
      />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={cn(
            "truncate font-medium",
            isChecked && "text-muted-foreground line-through"
          )}
        >
          {item.display_name}
        </span>
        {item.quantity > 1 && (
          <span
            className={cn(
              "shrink-0 text-sm text-muted-foreground",
              isChecked && "line-through"
            )}
          >
            x{item.quantity}
            {item.unit && ` ${item.unit}`}
          </span>
        )}
        {item.quantity === 1 && item.unit && (
          <span
            className={cn(
              "shrink-0 text-sm text-muted-foreground",
              isChecked && "line-through"
            )}
          >
            {item.unit}
          </span>
        )}
      </div>

      <ItemActions onDelete={onDelete} onEdit={onEdit} disabled={disabled} />
    </div>
  );
}
