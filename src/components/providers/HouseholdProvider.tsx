"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/client";
import { isLocalOnlyMode } from "@/lib/supabase/mock-mode";

import { useAuth } from "./AuthProvider";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  invite_expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
}

interface HouseholdContextType {
  households: Household[];
  currentHousehold: Household | null;
  userRole: "owner" | "member" | null;
  isLoading: boolean;
  error: string | null;
  setCurrentHousehold: (household: Household) => void;
  createHousehold: (name: string) => Promise<Household | null>;
  refreshHouseholds: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(
  undefined
);

interface HouseholdProviderProps {
  children: React.ReactNode;
}

export function HouseholdProvider({ children }: HouseholdProviderProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [currentHousehold, setCurrentHousehold] = useState<Household | null>(
    null
  );
  const [userRole, setUserRole] = useState<"owner" | "member" | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // undefined = not initialized, null = Supabase not configured
  const supabaseRef = useRef<SupabaseClient | null | undefined>(undefined);
  const currentHouseholdIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    currentHouseholdIdRef.current = currentHousehold?.id ?? null;
  }, [currentHousehold?.id]);

  const getSupabase = useCallback(() => {
    if (supabaseRef.current === undefined) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  }, []);

  const fetchHouseholds = useCallback(async () => {
    if (!user) {
      setHouseholds([]);
      setCurrentHousehold(null);
      setUserRole(null);
      setIsLoading(false);
      return;
    }

    const supabase = getSupabase();

    // If Supabase client is null, we're in mock/local-only mode
    // Use Dexie for local-only mode, mock data for E2E tests
    if (!supabase) {
      const localOnly = isLocalOnlyMode();
      const e2eMockEnabled =
        process.env.NEXT_PUBLIC_ENABLE_E2E_MOCK_MODE === "true";

      // Must be either local-only mode or explicit E2E mock mode
      if (!localOnly && !e2eMockEnabled) {
        console.error(
          "[HouseholdProvider] Supabase not configured and neither local-only nor E2E mock mode enabled"
        );
        setIsLoading(false);
        return;
      }

      // In local-only mode, use Dexie for persistence
      if (localOnly) {
        try {
          let localHouseholds = await db.households.toArray();

          // Auto-create a local household if none exists
          if (localHouseholds.length === 0) {
            const now = new Date().toISOString();
            const newHousehold = {
              id: crypto.randomUUID(),
              name: "My Household",
              inviteCode: "LOCAL",
              createdAt: now,
              updatedAt: now,
            };
            await db.households.add(newHousehold);
            localHouseholds = [newHousehold];
          }

          // Convert Dexie camelCase to snake_case for consistency
          const households: Household[] = localHouseholds.map((h) => ({
            id: h.id,
            name: h.name,
            invite_code: h.inviteCode,
            invite_expires_at: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            created_at: h.createdAt,
            updated_at: h.updatedAt,
          }));

          setHouseholds(households);
          setCurrentHousehold(households[0]);
          setUserRole("owner");
        } catch (err) {
          console.error("[HouseholdProvider] Dexie error:", err);
        }
        setIsLoading(false);
        return;
      }

      // E2E mock mode: use static mock data
      const mockHousehold: Household = {
        id: "mock-household-id",
        name: "Test Household",
        invite_code: "TEST123",
        invite_expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setHouseholds([mockHousehold]);
      setCurrentHousehold(mockHousehold);
      setUserRole("owner");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
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
        throw membershipError;
      }

      const userHouseholds: Household[] = memberships
        .map((m) => m.households as unknown as Household)
        .filter(Boolean);

      setHouseholds(userHouseholds);

      // If no current household selected, or current is no longer in the list, select first
      if (userHouseholds.length > 0) {
        const existingCurrent = userHouseholds.find(
          (h) => h.id === currentHouseholdIdRef.current
        );
        if (existingCurrent) {
          setCurrentHousehold(existingCurrent);
          const membership = memberships.find(
            (m) =>
              (m.households as unknown as Household)?.id === existingCurrent.id
          );
          setUserRole(membership?.role as "owner" | "member" | null);
        } else {
          setCurrentHousehold(userHouseholds[0]);
          const membership = memberships.find(
            (m) =>
              (m.households as unknown as Household)?.id ===
              userHouseholds[0].id
          );
          setUserRole(membership?.role as "owner" | "member" | null);
        }
      } else {
        setCurrentHousehold(null);
        setUserRole(null);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch households";
      setError(message);
      console.error("Error fetching households:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, getSupabase]);

  // Update user role when current household changes
  const handleSetCurrentHousehold = useCallback(
    async (household: Household) => {
      setCurrentHousehold(household);

      if (!user) {
        setUserRole(null);
        return;
      }

      const supabase = getSupabase();
      if (!supabase) {
        // In local-only mode, user is always owner of their local household
        if (isLocalOnlyMode()) {
          setUserRole("owner");
          return;
        }
        setUserRole(null);
        return;
      }

      try {
        const { data: membership } = await supabase
          .from("household_members")
          .select("role")
          .eq("household_id", household.id)
          .eq("user_id", user.id)
          .single();

        setUserRole(membership?.role as "owner" | "member" | null);
      } catch {
        setUserRole(null);
      }
    },
    [user, getSupabase]
  );

  const createHousehold = useCallback(
    async (name: string): Promise<Household | null> => {
      if (!user) {
        setError("Must be logged in to create a household");
        return null;
      }

      setError(null);

      // In local-only mode, create directly in Dexie
      if (isLocalOnlyMode()) {
        try {
          const now = new Date().toISOString();
          const newHousehold = {
            id: crypto.randomUUID(),
            name,
            inviteCode: "LOCAL",
            createdAt: now,
            updatedAt: now,
          };
          await db.households.add(newHousehold);

          const household: Household = {
            id: newHousehold.id,
            name: newHousehold.name,
            invite_code: newHousehold.inviteCode,
            invite_expires_at: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            created_at: newHousehold.createdAt,
            updated_at: newHousehold.updatedAt,
          };

          // Refresh households list
          await fetchHouseholds();

          return household;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to create household";
          setError(message);
          console.error("Error creating household:", err);
          return null;
        }
      }

      try {
        const response = await fetch("/api/households", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create household");
        }

        const { household } = await response.json();

        // Refresh households list
        await fetchHouseholds();

        return household;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create household";
        setError(message);
        console.error("Error creating household:", err);
        return null;
      }
    },
    [user, fetchHouseholds]
  );

  // Fetch households when user changes
  useEffect(() => {
    if (!authLoading) {
      fetchHouseholds();
    }
  }, [user?.id, authLoading, fetchHouseholds]);

  const value = useMemo(
    () => ({
      households,
      currentHousehold,
      userRole,
      isLoading: isLoading || authLoading,
      error,
      setCurrentHousehold: handleSetCurrentHousehold,
      createHousehold,
      refreshHouseholds: fetchHouseholds,
    }),
    [
      households,
      currentHousehold,
      userRole,
      isLoading,
      authLoading,
      error,
      handleSetCurrentHousehold,
      createHousehold,
      fetchHouseholds,
    ]
  );

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (context === undefined) {
    throw new Error("useHousehold must be used within a HouseholdProvider");
  }
  return context;
}
