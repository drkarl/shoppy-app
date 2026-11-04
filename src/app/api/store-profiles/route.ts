import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/store-profiles
 * Fetches all store profiles for the authenticated user's households.
 * RLS policies ensure users only see store profiles from their own households.
 *
 * Query params:
 * - household_id: (optional) Filter by specific household
 */
export async function GET(request: Request) {
  const supabase = await createClient();

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

  const { searchParams } = new URL(request.url);
  const householdId = searchParams.get("household_id");

  let query = supabase.from("store_profiles").select("*");

  if (householdId) {
    query = query.eq("household_id", householdId);
  }

  const { data: storeProfiles, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    console.error("Error fetching store profiles:", error);
    return NextResponse.json(
      { error: "Failed to fetch store profiles" },
      { status: 500 }
    );
  }

  return NextResponse.json({ store_profiles: storeProfiles });
}

/**
 * POST /api/store-profiles
 * Creates a new store profile for a household.
 * RLS policies verify the user belongs to the specified household.
 *
 * Request body:
 * - household_id: UUID of the household
 * - store_name: Name of the store
 * - category_order: Array of category UUIDs in preferred order
 * - is_default: (optional) Whether this is the default store profile
 */
export async function POST(request: Request) {
  const supabase = await createClient();

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
    household_id?: string;
    store_name?: string;
    category_order?: string[];
    is_default?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  if (!body.household_id) {
    return NextResponse.json(
      { error: "household_id is required" },
      { status: 400 }
    );
  }

  if (!body.store_name || body.store_name.trim() === "") {
    return NextResponse.json(
      { error: "store_name is required" },
      { status: 400 }
    );
  }

  if (body.store_name.length > 100) {
    return NextResponse.json(
      { error: "store_name must be 100 characters or less" },
      { status: 400 }
    );
  }

  if (!body.category_order || !Array.isArray(body.category_order)) {
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

  // Validate that all category_order items are valid UUIDs
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

  // If creating with is_default=true, clear is_default on all other
  // store profiles in the same household first
  if (body.is_default === true) {
    const { error: clearError } = await supabase
      .from("store_profiles")
      .update({ is_default: false })
      .eq("household_id", body.household_id);

    if (clearError) {
      console.error("Error clearing default flag:", clearError);
      return NextResponse.json(
        { error: "Failed to create store profile" },
        { status: 500 }
      );
    }
  }

  // Insert the store profile - RLS will verify household membership
  const { data: storeProfile, error: insertError } = await supabase
    .from("store_profiles")
    .insert({
      household_id: body.household_id,
      store_name: body.store_name.trim(),
      category_order: body.category_order,
      is_default: body.is_default ?? false,
    })
    .select()
    .single();

  if (insertError) {
    // Check for unique constraint violation
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "A store profile with this name already exists" },
        { status: 409 }
      );
    }
    // Check for RLS violation (no permission to insert)
    if (insertError.code === "42501") {
      return NextResponse.json(
        {
          error:
            "You do not have permission to create store profiles for this household",
        },
        { status: 403 }
      );
    }
    console.error("Error creating store profile:", insertError);
    return NextResponse.json(
      { error: "Failed to create store profile" },
      { status: 500 }
    );
  }

  return NextResponse.json({ store_profile: storeProfile }, { status: 201 });
}
