import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { id: householdId } = await context.params;

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

    // Verify user is a member of this household
    const { data: membership, error: membershipError } = await supabase
      .from("household_members")
      .select("role")
      .eq("household_id", householdId)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "You are not a member of this household" },
        { status: 403 }
      );
    }

    // Fetch the household invite details
    const { data: household, error: householdError } = await supabase
      .from("households")
      .select("id, name, invite_code, invite_expires_at")
      .eq("id", householdId)
      .single();

    if (householdError || !household) {
      return NextResponse.json(
        { error: "Household not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        invite_code: household.invite_code,
        invite_expires_at: household.invite_expires_at,
        household_name: household.name,
        is_owner: membership.role === "owner",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Unexpected error in GET /api/households/[id]/invite:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { id: householdId } = await context.params;

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

    // Use the RPC function that handles owner verification atomically.
    // Security note: The owner check happens inside the `regenerate_invite_code` RPC function,
    // not in this route handler. The RPC verifies the authenticated user is the household owner
    // before allowing the regeneration, ensuring atomic validation and update.
    const { data: newCode, error: regenerateError } = await supabase.rpc(
      "regenerate_invite_code",
      { p_household_id: householdId }
    );

    if (regenerateError) {
      const errorMessage = regenerateError.message || "Failed to regenerate";

      if (errorMessage.includes("Only household owner")) {
        return NextResponse.json(
          { error: "Only the household owner can regenerate the invite code" },
          { status: 403 }
        );
      }

      console.error("Error regenerating invite code:", regenerateError);
      return NextResponse.json(
        { error: "Failed to regenerate invite code" },
        { status: 500 }
      );
    }

    // Fetch updated invite details
    const { data: household, error: fetchError } = await supabase
      .from("households")
      .select("invite_code, invite_expires_at")
      .eq("id", householdId)
      .single();

    if (fetchError) {
      // Regeneration was successful, just return the new code
      return NextResponse.json({ invite_code: newCode }, { status: 200 });
    }

    return NextResponse.json(
      {
        invite_code: household.invite_code,
        invite_expires_at: household.invite_expires_at,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Unexpected error in POST /api/households/[id]/invite:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
