import { NextResponse } from "next/server";

import { PG_RLS_VIOLATION } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
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

    // Get all lists for households the user belongs to
    const { data: lists, error: listsError } = await supabase
      .from("lists")
      .select(
        `
        id,
        household_id,
        name,
        status,
        created_at,
        updated_at,
        households (
          id,
          name
        )
      `
      )
      .order("created_at", { ascending: false });

    if (listsError) {
      console.error("Error fetching lists:", listsError);
      return NextResponse.json(
        { error: "Failed to fetch lists" },
        { status: 500 }
      );
    }

    return NextResponse.json({ lists }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in GET /api/lists:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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

    const { name, household_id } = body;

    if (!household_id || typeof household_id !== "string") {
      return NextResponse.json(
        { error: "household_id is required" },
        { status: 400 }
      );
    }

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "List name is required" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return NextResponse.json(
        { error: "List name cannot be empty" },
        { status: 400 }
      );
    }

    if (trimmedName.length > 100) {
      return NextResponse.json(
        { error: "List name must be 100 characters or less" },
        { status: 400 }
      );
    }

    // RLS will verify user has access to this household
    const { data: list, error: listError } = await supabase
      .from("lists")
      .insert({
        household_id,
        name: trimmedName,
        status: "active",
      })
      .select()
      .single();

    if (listError) {
      console.error("Error creating list:", listError);
      // Check if it's an RLS policy violation (user not in household)
      if (listError.code === PG_RLS_VIOLATION) {
        return NextResponse.json(
          { error: "Access denied to this household" },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create list" },
        { status: 500 }
      );
    }

    return NextResponse.json({ list }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/lists:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
