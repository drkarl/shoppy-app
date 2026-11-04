import { NextResponse } from "next/server";

import { PG_RLS_VIOLATION } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ listId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { listId } = await params;
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

    // Get all items for this list (RLS will verify access)
    const { data: items, error: itemsError } = await supabase
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
      .eq("list_id", listId)
      .order("created_at", { ascending: false });

    if (itemsError) {
      console.error("Error fetching items:", itemsError);
      return NextResponse.json(
        { error: "Failed to fetch items" },
        { status: 500 }
      );
    }

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in GET /api/lists/[listId]/items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { listId } = await params;
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

    const { raw_text, display_name, quantity, unit, note, category_id } = body;

    // Validate display_name (required)
    if (!display_name || typeof display_name !== "string") {
      return NextResponse.json(
        { error: "display_name is required" },
        { status: 400 }
      );
    }

    const trimmedDisplayName = display_name.trim();
    if (trimmedDisplayName.length === 0) {
      return NextResponse.json(
        { error: "display_name cannot be empty" },
        { status: 400 }
      );
    }

    if (trimmedDisplayName.length > 255) {
      return NextResponse.json(
        { error: "display_name must be 255 characters or less" },
        { status: 400 }
      );
    }

    // Validate quantity (optional, must be positive)
    let validatedQuantity = 1; // default
    if (quantity !== undefined) {
      const parsedQuantity = Number(quantity);
      if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
        return NextResponse.json(
          { error: "Quantity must be positive" },
          { status: 400 }
        );
      }
      validatedQuantity = parsedQuantity;
    }

    // Validate unit (optional)
    let validatedUnit = null;
    if (unit !== undefined && unit !== null) {
      if (typeof unit !== "string") {
        return NextResponse.json(
          { error: "unit must be a string" },
          { status: 400 }
        );
      }
      validatedUnit = unit.trim() || null;
    }

    // Validate note (optional)
    let validatedNote = null;
    if (note !== undefined && note !== null) {
      if (typeof note !== "string") {
        return NextResponse.json(
          { error: "note must be a string" },
          { status: 400 }
        );
      }
      validatedNote = note.trim() || null;
    }

    // Validate category_id (optional)
    let validatedCategoryId = null;
    if (category_id !== undefined && category_id !== null) {
      if (typeof category_id !== "string") {
        return NextResponse.json(
          { error: "category_id must be a string" },
          { status: 400 }
        );
      }
      validatedCategoryId = category_id;
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

    // Create the item (RLS will verify access)
    const { data: item, error: itemError } = await supabase
      .from("list_items")
      .insert({
        list_id: listId,
        raw_text: raw_text?.trim() || trimmedDisplayName,
        display_name: trimmedDisplayName,
        quantity: validatedQuantity,
        unit: validatedUnit,
        note: validatedNote,
        category_id: validatedCategoryId,
        added_by: user.id,
        status: "pending",
      })
      .select()
      .single();

    if (itemError) {
      console.error("Error creating item:", itemError);
      // Check if it's an RLS policy violation
      if (itemError.code === PG_RLS_VIOLATION) {
        return NextResponse.json(
          { error: "Access denied to this list" },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/lists/[listId]/items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
