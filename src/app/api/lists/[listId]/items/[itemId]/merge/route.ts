import { NextResponse } from "next/server";

import { PGRST_NOT_FOUND } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ listId: string; itemId: string }>;
}

export interface MergeRequest {
  source_item_id: string;
}

/**
 * POST /api/lists/[listId]/items/[itemId]/merge
 *
 * Merges a source item into the target item (identified by itemId in URL).
 * - Adds quantities together
 * - Keeps metadata from target item (category, note, added_by)
 * - Deletes the source item after merge
 * - Returns warning if units differ
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { listId, itemId: targetItemId } = await params;
    const supabase = await createClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    let body: MergeRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { source_item_id: sourceItemId } = body;

    // Validate source_item_id
    if (!sourceItemId || typeof sourceItemId !== "string") {
      return NextResponse.json(
        { error: "source_item_id is required" },
        { status: 400 }
      );
    }

    // Cannot merge an item with itself
    if (sourceItemId === targetItemId) {
      return NextResponse.json(
        { error: "Cannot merge an item with itself" },
        { status: 400 }
      );
    }

    // Verify list exists and user has access (via RLS)
    const { data: list, error: listError } = await supabase
      .from("lists")
      .select("id")
      .eq("id", listId)
      .single();

    if (listError || !list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Fetch target item (the one we're merging into)
    const { data: targetItem, error: targetError } = await supabase
      .from("list_items")
      .select("id, quantity, unit, note, category_id, added_by, display_name")
      .eq("id", targetItemId)
      .eq("list_id", listId)
      .single();

    if (targetError) {
      if (targetError.code === PGRST_NOT_FOUND) {
        return NextResponse.json(
          { error: "Target item not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching target item:", targetError);
      return NextResponse.json(
        { error: "Failed to fetch target item" },
        { status: 500 }
      );
    }

    // Fetch source item (the one being merged from)
    const { data: sourceItem, error: sourceError } = await supabase
      .from("list_items")
      .select("id, quantity, unit")
      .eq("id", sourceItemId)
      .eq("list_id", listId)
      .single();

    if (sourceError) {
      if (sourceError.code === PGRST_NOT_FOUND) {
        return NextResponse.json(
          { error: "Source item not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching source item:", sourceError);
      return NextResponse.json(
        { error: "Failed to fetch source item" },
        { status: 500 }
      );
    }

    // Check for unit mismatch
    let warning: string | undefined;
    const targetHasUnit = targetItem.unit !== null && targetItem.unit !== "";
    const sourceHasUnit = sourceItem.unit !== null && sourceItem.unit !== "";

    if (targetHasUnit && sourceHasUnit && targetItem.unit !== sourceItem.unit) {
      warning = "Different units detected. Merge quantities manually.";
    }

    // Calculate merged quantity
    const mergedQuantity = targetItem.quantity + sourceItem.quantity;

    // Update target item with merged quantity (keep all other metadata from target)
    const { data: updatedItem, error: updateError } = await supabase
      .from("list_items")
      .update({ quantity: mergedQuantity })
      .eq("id", targetItemId)
      .eq("list_id", listId)
      .select(
        `
        id,
        list_id,
        raw_text,
        display_name,
        quantity,
        unit,
        note,
        category_id,
        status,
        added_by,
        checked_by,
        checked_at,
        version,
        created_at,
        updated_at,
        categories (
          id,
          name,
          icon
        )
      `
      )
      .single();

    if (updateError) {
      console.error("Error updating target item:", updateError);
      return NextResponse.json(
        { error: "Failed to merge items" },
        { status: 500 }
      );
    }

    // Delete source item
    const { error: deleteError } = await supabase
      .from("list_items")
      .delete()
      .eq("id", sourceItemId)
      .eq("list_id", listId);

    // Track whether source item was successfully deleted
    // If delete fails, the merge succeeded but cleanup failed - client may want to know
    const sourceItemDeleted = !deleteError;
    if (deleteError) {
      console.error("Error deleting source item:", deleteError);
    }

    const response: {
      item: typeof updatedItem;
      warning?: string;
      sourceItemDeleted: boolean;
    } = {
      item: updatedItem,
      sourceItemDeleted,
    };
    if (warning) {
      response.warning = warning;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(
      "Unexpected error in POST /api/lists/[listId]/items/[itemId]/merge:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
