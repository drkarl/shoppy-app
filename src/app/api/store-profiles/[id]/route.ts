import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/store-profiles/[id]
 * Fetches a specific store profile by ID.
 * RLS policies ensure users can only access store profiles from their households.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const supabase = await createClient();
  const { id } = await params;

  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: storeProfile, error } = await supabase
    .from("store_profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Store profile not found" },
        { status: 404 }
      );
    }
    console.error("Error fetching store profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch store profile" },
      { status: 500 }
    );
  }

  return NextResponse.json({ store_profile: storeProfile });
}

/**
 * PATCH /api/store-profiles/[id]
 * Updates a store profile.
 * RLS policies ensure users can only update store profiles from their households.
 *
 * Request body (all optional):
 * - store_name: New name for the store
 * - category_order: New array of category UUIDs
 * - is_default: Whether this is the default store profile
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const supabase = await createClient();
  const { id } = await params;

  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    store_name?: string;
    category_order?: string[];
    is_default?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {};

  if (body.store_name !== undefined) {
    if (body.store_name.trim() === "") {
      return NextResponse.json(
        { error: "store_name cannot be empty" },
        { status: 400 }
      );
    }
    if (body.store_name.length > 100) {
      return NextResponse.json(
        { error: "store_name must be 100 characters or less" },
        { status: 400 }
      );
    }
    updates.store_name = body.store_name.trim();
  }

  if (body.category_order !== undefined) {
    if (!Array.isArray(body.category_order)) {
      return NextResponse.json(
        { error: "category_order must be an array" },
        { status: 400 }
      );
    }
    // Limit array size to prevent potential resource exhaustion
    if (body.category_order.length > 100) {
      return NextResponse.json(
        { error: "category_order cannot exceed 100 items" },
        { status: 400 }
      );
    }
    // Validate UUIDs
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const invalidUuids = body.category_order.filter(
      (id) => typeof id !== "string" || !uuidRegex.test(id)
    );
    if (invalidUuids.length > 0) {
      return NextResponse.json(
        { error: "category_order must contain valid UUIDs" },
        { status: 400 }
      );
    }
    updates.category_order = body.category_order;
  }

  if (body.is_default !== undefined) {
    updates.is_default = body.is_default;
  }

  // If setting is_default=true, we need to clear is_default on other stores
  // in the same household. First, get the current store to find its household_id.
  let householdId: string | null = null;
  if (body.is_default === true) {
    const { data: currentProfile, error: fetchError } = await supabase
      .from("store_profiles")
      .select("household_id")
      .eq("id", id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Store profile not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching store profile:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch store profile" },
        { status: 500 }
      );
    }
    householdId = currentProfile.household_id;

    // Clear is_default on all other store profiles in the same household
    const { error: clearError } = await supabase
      .from("store_profiles")
      .update({ is_default: false })
      .eq("household_id", householdId)
      .neq("id", id);

    if (clearError) {
      console.error("Error clearing default flag:", clearError);
      return NextResponse.json(
        { error: "Failed to update store profile" },
        { status: 500 }
      );
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const { data: storeProfile, error: updateError } = await supabase
    .from("store_profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    if (updateError.code === "PGRST116") {
      return NextResponse.json(
        { error: "Store profile not found" },
        { status: 404 }
      );
    }
    if (updateError.code === "23505") {
      return NextResponse.json(
        { error: "A store profile with this name already exists" },
        { status: 409 }
      );
    }
    console.error("Error updating store profile:", updateError);
    return NextResponse.json(
      { error: "Failed to update store profile" },
      { status: 500 }
    );
  }

  return NextResponse.json({ store_profile: storeProfile });
}

/**
 * DELETE /api/store-profiles/[id]
 * Deletes a store profile.
 * RLS policies ensure users can only delete store profiles from their households.
 *
 * Note: This operation is intentionally idempotent - it returns success even if
 * the store profile doesn't exist (or is already deleted). This follows REST
 * best practices where DELETE should be safe to retry.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const supabase = await createClient();
  const { id } = await params;

  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error: deleteError } = await supabase
    .from("store_profiles")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Error deleting store profile:", deleteError);
    return NextResponse.json(
      { error: "Failed to delete store profile" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
