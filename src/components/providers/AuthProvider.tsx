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

import { createClient } from "@/lib/supabase/client";
import { isLocalOnlyMode } from "@/lib/supabase/mock-mode";

import type { SupabaseClient, Session, User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use ref with lazy initialization to avoid SSR issues
  // undefined = not initialized, null = Supabase not configured
  const supabaseRef = useRef<SupabaseClient | null | undefined>(undefined);

  const getSupabase = useCallback(() => {
    if (supabaseRef.current === undefined) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  }, []);

  useEffect(() => {
    const supabase = getSupabase();

    // If Supabase client is null, we're in mock/local-only mode
    // Use mock auth from localStorage or auto-create for local-only mode
    if (!supabase) {
      const localOnly = isLocalOnlyMode();
      const e2eMockEnabled =
        process.env.NEXT_PUBLIC_ENABLE_E2E_MOCK_MODE === "true";

      // Must be either local-only mode or explicit E2E mock mode
      if (!localOnly && !e2eMockEnabled) {
        console.error(
          "[AuthProvider] Supabase not configured and neither local-only nor E2E mock mode enabled"
        );
        setIsLoading(false);
        return;
      }

      const mockAuthKey = "sb-localhost-auth-token";
      try {
        const storedAuth = localStorage.getItem(mockAuthKey);
        if (storedAuth) {
          const { currentSession } = JSON.parse(storedAuth);
          if (currentSession?.user) {
            setUser(currentSession.user as User);
            setSession(currentSession as Session);
            setIsLoading(false);
            return;
          }
        }

        // In local-only mode, auto-create a mock user if none exists
        if (localOnly) {
          const mockUser: User = {
            id: "local-user-id",
            email: "local@localhost",
            app_metadata: {},
            user_metadata: { name: "Local User" },
            aud: "authenticated",
            created_at: new Date().toISOString(),
          } as User;

          const mockSession: Session = {
            access_token: "local-mock-token",
            refresh_token: "local-mock-refresh",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: mockUser,
          } as Session;

          // Store in localStorage for persistence
          localStorage.setItem(
            mockAuthKey,
            JSON.stringify({ currentSession: mockSession })
          );

          setUser(mockUser);
          setSession(mockSession);
        }
      } catch {
        // Ignore parse errors
      }
      setIsLoading(false);
      return;
    }

    const getSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
      } finally {
        setIsLoading(false);
      }
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [getSupabase]);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    } else {
      // Mock auth: clear localStorage
      localStorage.removeItem("sb-localhost-auth-token");
      setUser(null);
      setSession(null);
    }
  }, [getSupabase]);

  const value = useMemo(
    () => ({
      user,
      session,
      isLoading,
      signOut,
    }),
    [user, session, isLoading, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
