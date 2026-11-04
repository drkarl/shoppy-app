import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { AuthProvider, useAuth } from "./AuthProvider";

const mockSession = {
  user: {
    id: "123",
    email: "test@example.com",
    aud: "authenticated",
    role: "authenticated",
  },
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
};

const mockSubscription = {
  unsubscribe: vi.fn(),
};

const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: mockSubscription },
    })),
    signOut: vi.fn(),
  },
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

function TestConsumer() {
  const { user, isLoading, signOut } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <span data-testid="user-email">{user?.email ?? "No user"}</span>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
    });
  });

  it("provides auth context to children", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user-email")).toHaveTextContent("No user");
    });
  });

  it("loads session on mount", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("user-email")).toHaveTextContent(
        "test@example.com"
      );
    });
  });

  it("subscribes to auth state changes", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });
  });

  it("unsubscribes on unmount", async () => {
    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user-email")).toBeInTheDocument();
    });

    unmount();

    expect(mockSubscription.unsubscribe).toHaveBeenCalled();
  });

  it("calls signOut when signOut is invoked", async () => {
    const user = userEvent.setup();
    mockSupabase.auth.signOut.mockResolvedValue({ error: null });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sign out/i })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });

  it("throws error when useAuth is used outside AuthProvider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow("useAuth must be used within an AuthProvider");

    consoleError.mockRestore();
  });
});
