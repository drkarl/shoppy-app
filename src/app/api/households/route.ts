import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { name } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Household name is required" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return NextResponse.json(
        { error: "Household name cannot be empty" },
        { status: 400 }
      );
    }

    if (trimmedName.length > 50) {
      return NextResponse.json(
        { error: "Household name must be 50 characters or less" },
        { status: 400 }
      );
    }

    // Create household (trigger automatically adds creator as owner)
    const { data: household, error: householdError } = await supabase
      .from("households")
      .insert({ name: trimmedName })
      .select()
      .single();

    if (householdError) {
      console.error("Error creating household:", householdError);
      return NextResponse.json(
        { error: "Failed to create household" },
        { status: 500 }
      );
    }

    // Create default shopping list
    const { error: listError } = await supabase.from("lists").insert({
      household_id: household.id,
      name: "Shopping List",
      status: "active",
    });

    if (listError) {
      console.error("Error creating default list:", listError);
      // Household was created but list failed - this is a partial success
      // We still return the household since the trigger already made the user an owner
      return NextResponse.json(
        {
          household,
          warning: "Household created but default list creation failed",
        },
        { status: 201 }
      );
    }

    return NextResponse.json({ household }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/households:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all households the user is a member of
    const { data: memberships, error: membershipError } = await supabase
      .from("household_members")
      .select(
        `
        role,
        households (
          id,
          name,
          invite_code,
          invite_expires_at,
          created_at,
          updated_at
        )
      `
      )
      .eq("user_id", user.id);

    if (membershipError) {
      console.error("Error fetching households:", membershipError);
      return NextResponse.json(
        { error: "Failed to fetch households" },
        { status: 500 }
      );
    }

    interface HouseholdData {
      id: string;
      name: string;
      invite_code: string;
      invite_expires_at: string;
      created_at: string;
      updated_at: string;
    }

    const households = memberships
      .map((m) => {
        const household = m.households as unknown as HouseholdData | null;
        if (!household) return null;
        return {
          ...household,
          role: m.role,
        };
      })
      .filter((h): h is NonNullable<typeof h> => h !== null && !!h.id);

    return NextResponse.json({ households }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in GET /api/households:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
