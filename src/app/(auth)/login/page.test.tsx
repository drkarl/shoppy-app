import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockSupabase = {
  auth: {
    signInWithOtp: vi.fn(),
    signInWithOAuth: vi.fn(),
  },
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: { origin: "http://localhost:3000" },
      writable: true,
    });
  });

  it("renders login form", () => {
    render(<LoginPage />);

    expect(screen.getByText("Welcome to Shoppy")).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send magic link/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in with google/i })
    ).toBeInTheDocument();
  });

  it("shows error when submitting empty email", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: /send magic link/i }));

    expect(toast.error).toHaveBeenCalledWith("Please enter your email address");
    expect(mockSupabase.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("shows error when submitting invalid email format", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    // Use email that passes HTML5 validation but fails our stricter regex (missing dot after @)
    await user.type(screen.getByLabelText(/email/i), "test@test");
    await user.click(screen.getByRole("button", { name: /send magic link/i }));

    expect(toast.error).toHaveBeenCalledWith(
      "Please enter a valid email address"
    );
    expect(mockSupabase.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("sends magic link successfully", async () => {
    const user = userEvent.setup();
    mockSupabase.auth.signInWithOtp.mockResolvedValue({ error: null });

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: "test@example.com",
        options: {
          emailRedirectTo: "http://localhost:3000/callback",
        },
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Check your email for the magic link!"
      );
    });
  });

  it("shows error when magic link fails", async () => {
    const user = userEvent.setup();
    mockSupabase.auth.signInWithOtp.mockResolvedValue({
      error: { message: "Rate limit exceeded" },
    });

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Rate limit exceeded");
    });
  });

  it("initiates Google OAuth sign in", async () => {
    const user = userEvent.setup();
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({ error: null });

    render(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: /sign in with google/i })
    );

    expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/callback",
      },
    });
  });

  it("shows error when Google OAuth fails", async () => {
    const user = userEvent.setup();
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      error: { message: "OAuth provider error" },
    });

    render(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: /sign in with google/i })
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("OAuth provider error");
    });
  });

  it("disables buttons during loading", async () => {
    const user = userEvent.setup();
    mockSupabase.auth.signInWithOtp.mockImplementation(
      () => new Promise(() => {})
    );

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /sign in with google/i })
      ).toBeDisabled();
    });
  });
});
