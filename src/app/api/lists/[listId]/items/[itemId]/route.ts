import { NextResponse } from "next/server";

import { PGRST_NOT_FOUND } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ listId: string; itemId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { listId, itemId } = await params;
    const supabase = await createClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First verify the list exists and user has access (via RLS)
    const { data: list, error: listError } = await supabase
      .from("lists")
      .select("id")
      .eq("id", listId)
      .single();

    if (listError || !list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Get the item (RLS will verify access)
    const { data: item, error: itemError } = await supabase
      .from("list_items")
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
      .eq("id", itemId)
      .eq("list_id", listId)
      .single();

    if (itemError) {
      if (itemError.code === PGRST_NOT_FOUND) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      console.error("Error fetching item:", itemError);
      return NextResponse.json(
        { error: "Failed to fetch item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ item }, { status: 200 });
  } catch (error) {
    console.error(
      "Unexpected error in GET /api/lists/[listId]/items/[itemId]:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { listId, itemId } = await params;
    const supabase = await createClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // First verify the list exists and user has access (via RLS)
    const { data: list, error: listError } = await supabase
      .from("lists")
      .select("id")
      .eq("id", listId)
      .single();

    if (listError || !list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Check if item exists
    const { data: existingItem, error: existingError } = await supabase
      .from("list_items")
      .select("id, status")
      .eq("id", itemId)
      .eq("list_id", listId)
      .single();

    if (existingError || !existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const {
      display_name,
      raw_text,
      quantity,
      unit,
      note,
      category_id,
      status,
    } = body;

    const updates: Record<string, unknown> = {};

    // Validate and set display_name
    if (display_name !== undefined) {
      if (typeof display_name !== "string") {
        return NextResponse.json(
          { error: "display_name must be a string" },
          { status: 400 }
        );
      }
      const trimmed = display_name.trim();
      if (trimmed.length === 0) {
        return NextResponse.json(
          { error: "display_name cannot be empty" },
          { status: 400 }
        );
      }
      if (trimmed.length > 255) {
        return NextResponse.json(
          { error: "display_name must be 255 characters or less" },
          { status: 400 }
        );
      }
      updates.display_name = trimmed;
    }

    // Validate and set raw_text
    if (raw_text !== undefined) {
      if (typeof raw_text !== "string") {
        return NextResponse.json(
          { error: "raw_text must be a string" },
          { status: 400 }
        );
      }
      updates.raw_text = raw_text.trim();
    }

    // Validate and set quantity
    if (quantity !== undefined) {
      const parsedQuantity = Number(quantity);
      if (isNaN(parsedQuantity) || parsedQuantity < 0) {
        return NextResponse.json(
          { error: "quantity must be a non-negative number" },
          { status: 400 }
        );
      }
      updates.quantity = parsedQuantity;
    }

    // Validate and set unit
    if (unit !== undefined) {
      if (unit !== null && typeof unit !== "string") {
        return NextResponse.json(
          { error: "unit must be a string or null" },
          { status: 400 }
        );
      }
      updates.unit = unit === null ? null : unit.trim() || null;
    }

    // Validate and set note
    if (note !== undefined) {
      if (note !== null && typeof note !== "string") {
        return NextResponse.json(
          { error: "note must be a string or null" },
          { status: 400 }
        );
      }
      updates.note = note === null ? null : note.trim() || null;
    }

    // Validate and set category_id
    if (category_id !== undefined) {
      if (category_id !== null && typeof category_id !== "string") {
        return NextResponse.json(
          { error: "category_id must be a string or null" },
          { status: 400 }
        );
      }
      updates.category_id = category_id;
    }

    // Handle status change (check/uncheck)
    if (status !== undefined) {
      if (status !== "pending" && status !== "checked") {
        return NextResponse.json(
          { error: "status must be 'pending' or 'checked'" },
          { status: 400 }
        );
      }
      updates.status = status;

      // Set checked_by and checked_at when checking
      if (status === "checked") {
        updates.checked_by = user.id;
        updates.checked_at = new Date().toISOString();
      } else {
        // Clear when unchecking
        updates.checked_by = null;
        updates.checked_at = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update the item (RLS will verify access)
    const { data: item, error: itemError } = await supabase
      .from("list_items")
      .update(updates)
      .eq("id", itemId)
      .eq("list_id", listId)
      .select()
      .single();

    if (itemError) {
      console.error("Error updating item:", itemError);
      return NextResponse.json(
        { error: "Failed to update item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ item }, { status: 200 });
  } catch (error) {
    console.error(
      "Unexpected error in PUT /api/lists/[listId]/items/[itemId]:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { listId, itemId } = await params;
    const supabase = await createClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First verify the list exists and user has access (via RLS)
    const { data: list, error: listError } = await supabase
      .from("lists")
      .select("id")
      .eq("id", listId)
      .single();

    if (listError || !list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Check if item exists
    const { data: existingItem, error: existingError } = await supabase
      .from("list_items")
      .select("id")
      .eq("id", itemId)
      .eq("list_id", listId)
      .single();

    if (existingError || !existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Delete the item (RLS will verify access)
    const { error: deleteError } = await supabase
      .from("list_items")
      .delete()
      .eq("id", itemId)
      .eq("list_id", listId);

    if (deleteError) {
      console.error("Error deleting item:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete item" },
        { status: 500 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(
      "Unexpected error in DELETE /api/lists/[listId]/items/[itemId]:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
