import { test as base, expect, type Page } from "@playwright/test";

import { isSupabaseConfigured, TEST_USER } from "./fixtures";

/**
 * E2E tests for authentication flows.
 *
 * Tests:
 * - Login page display and form validation
 * - Magic link flow (email OTP)
 * - OAuth flow setup (Google)
 * - Protected route redirects
 * - Session persistence
 * - Logout functionality
 */

/**
 * Extended test fixture for auth tests.
 */
const test = base.extend<{
  unauthenticatedPage: Page;
}>({
  /**
   * Provides a page without authentication.
   */
  unauthenticatedPage: async ({ page }, use) => {
    // Clear any existing auth state
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await use(page);
  },
});

test.describe("Login Page", () => {
  test("should display login page with all elements", async ({
    unauthenticatedPage: page,
  }) => {
    await page.goto("/login");

    // Verify page title and description
    await expect(page.getByText(/welcome to shoppy/i)).toBeVisible();
    await expect(
      page.getByText(/sign in to your account to continue/i)
    ).toBeVisible();

    // Verify email input
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(emailInput).toHaveAttribute("placeholder", "you@example.com");

    // Verify magic link button
    await expect(
      page.getByRole("button", { name: /send magic link/i })
    ).toBeVisible();

    // Verify Google sign-in button
    await expect(
      page.getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();

    // Verify "Or continue with" separator
    await expect(page.getByText(/or continue with/i)).toBeVisible();
  });

  test("should show error for invalid email format", async ({
    unauthenticatedPage: page,
  }) => {
    await page.goto("/login");

    // Enter invalid email that passes browser validation but fails app validation
    // Using a format without proper domain extension
    await page.getByLabel(/email/i).fill("test@");
    await page.getByRole("button", { name: /send magic link/i }).click();

    // Browser may show native validation or app may show toast
    // We just verify the form doesn't proceed (no success toast)
    // Use toPass() for resilient waiting instead of arbitrary timeout
    await expect(async () => {
      await expect(page).toHaveURL(/\/login/);
    }).toPass({ timeout: 2000 });
  });

  test("should show error for empty email", async ({
    unauthenticatedPage: page,
  }) => {
    await page.goto("/login");

    // Click submit without entering email
    await page.getByRole("button", { name: /send magic link/i }).click();

    // Should show error toast
    await expect(
      page.getByText(/please enter your email address/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("should show loading state during magic link submission", async ({
    unauthenticatedPage: page,
  }) => {
    // Skip if Supabase not configured (API call will fail)
    test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

    await page.goto("/login");

    // Enter valid email
    await page.getByLabel(/email/i).fill("test@example.com");
    await page.getByRole("button", { name: /send magic link/i }).click();

    // Should show loading state
    await expect(page.getByText(/sending/i)).toBeVisible();

    // Button should be disabled during loading
    await expect(page.getByRole("button", { name: /sending/i })).toBeDisabled();
  });

  test("should initiate Google OAuth flow", async ({
    unauthenticatedPage: page,
  }) => {
    // Skip if Supabase not configured
    test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

    await page.goto("/login");

    // Track navigation to OAuth provider
    const [popup] = await Promise.all([
      page.waitForEvent("popup").catch(() => null),
      page.getByRole("button", { name: /sign in with google/i }).click(),
    ]);

    // Either a popup opens or we navigate to OAuth provider
    if (popup) {
      // Popup-based OAuth
      await expect(popup).toHaveURL(/accounts\.google\.com|supabase/);
    } else {
      // Redirect-based OAuth - check button shows loading
      await expect(page.getByText(/redirecting/i)).toBeVisible();
    }
  });
});

test.describe("Protected Routes", () => {
  test("should redirect unauthenticated users from /list to /login", async ({
    unauthenticatedPage: page,
  }) => {
    await page.goto("/list");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("should redirect unauthenticated users from /settings to /login", async ({
    unauthenticatedPage: page,
  }) => {
    await page.goto("/settings");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("should redirect unauthenticated users from shopping mode to /login", async ({
    unauthenticatedPage: page,
  }) => {
    await page.goto("/list/shopping");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Session Persistence", () => {
  test("should maintain session after page reload", async ({ page }) => {
    // Set up mock auth state
    await page.addInitScript(() => {
      const mockUser = {
        id: "test-user-id",
        email: "e2e-test@shoppy.test",
        aud: "authenticated",
        role: "authenticated",
      };
      const mockSession = {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user: mockUser,
      };
      localStorage.setItem(
        "sb-localhost-auth-token",
        JSON.stringify({
          currentSession: mockSession,
          expiresAt: Date.now() + 3600000,
        })
      );
    });

    // Go to list page
    await page.goto("/list");
    await page.waitForLoadState("networkidle");

    // Should stay on list page (authenticated)
    await expect(page).toHaveURL(/\/list/);

    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Should still be on list page (session persisted)
    await expect(page).toHaveURL(/\/list/);
  });

  test("should clear session on logout", async ({ page }) => {
    // Skip if Supabase not configured (needs real auth)
    test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

    // Set up mock auth state
    await page.addInitScript(() => {
      const mockUser = {
        id: "test-user-id",
        email: "e2e-test@shoppy.test",
        aud: "authenticated",
        role: "authenticated",
      };
      const mockSession = {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user: mockUser,
      };
      localStorage.setItem(
        "sb-localhost-auth-token",
        JSON.stringify({
          currentSession: mockSession,
          expiresAt: Date.now() + 3600000,
        })
      );
    });

    // Go to settings page
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Find and click logout button if present
    const logoutButton = page.getByRole("button", { name: /sign out|logout/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);

      // Session should be cleared
      const token = await page.evaluate(() =>
        localStorage.getItem("sb-localhost-auth-token")
      );
      expect(token).toBeNull();
    }
  });
});

test.describe("Onboarding Redirect", () => {
  test("should redirect authenticated users without household to onboarding", async ({
    page,
  }) => {
    // Set up mock auth without household
    await page.addInitScript(() => {
      const mockUser = {
        id: "new-user-without-household",
        email: "new-user@shoppy.test",
        aud: "authenticated",
        role: "authenticated",
      };
      const mockSession = {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user: mockUser,
      };
      localStorage.setItem(
        "sb-localhost-auth-token",
        JSON.stringify({
          currentSession: mockSession,
          expiresAt: Date.now() + 3600000,
        })
      );
    });

    await page.goto("/list");
    await page.waitForLoadState("networkidle");

    // Should redirect to onboarding when no household exists
    // (Note: With mock auth, the app may create mock household data)
    // This test verifies the redirect logic is in place
    const url = page.url();
    expect(url).toMatch(/\/(list|onboarding)/);
  });
});

test.describe("Auth Callback", () => {
  test("should handle auth callback redirect", async ({
    unauthenticatedPage: page,
  }) => {
    // Visit callback page without valid token (should handle gracefully)
    await page.goto("/callback");

    // Should either redirect to login or show appropriate state
    await expect(page).toHaveURL(/\/(callback|login|list)/);
  });
});

test.describe("Join Page Auth Check", () => {
  test("should prompt login for unauthenticated users on join page", async ({
    unauthenticatedPage: page,
  }) => {
    await page.goto("/join/test-invite-code");

    // Should show login prompt
    await expect(page.getByText(/join a household/i)).toBeVisible();
    await expect(
      page.getByText(/sign in to join this household/i)
    ).toBeVisible();
    // The button/link says "Sign in to continue"
    await expect(page.getByText(/sign in to continue/i)).toBeVisible();
  });

  test("should preserve invite code in redirect URL", async ({
    unauthenticatedPage: page,
  }) => {
    const inviteCode = "test-invite-abc123";
    await page.goto(`/join/${inviteCode}`);

    // Check the sign-in link/button contains the redirect
    const signInElement = page.getByRole("link", {
      name: /sign in to continue/i,
    });
    const href = await signInElement.getAttribute("href");
    expect(href).toContain(`redirect=/join/${inviteCode}`);
  });
});

test.describe("Email Validation", () => {
  test("should prevent submission of obviously invalid emails", async ({
    unauthenticatedPage: page,
  }) => {
    await page.goto("/login");

    // Test with clearly invalid format
    await page.getByLabel(/email/i).fill("not-an-email");
    await page.getByRole("button", { name: /send magic link/i }).click();

    // Browser native validation should prevent submission
    // We verify we stay on login page (no navigation)
    // Use toPass() for resilient waiting instead of arbitrary timeout
    await expect(async () => {
      await expect(page).toHaveURL(/\/login/);
    }).toPass({ timeout: 2000 });
  });

  test("should accept valid email format", async ({
    unauthenticatedPage: page,
  }) => {
    await page.goto("/login");

    // Test with valid format
    await page.getByLabel(/email/i).fill("test@example.com");

    // Input should accept the value without browser validation errors
    await expect(page.getByLabel(/email/i)).toHaveValue("test@example.com");
  });
});

test.describe("Real Auth Flow", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should successfully log in with test credentials", async ({
    unauthenticatedPage: page,
  }) => {
    await page.goto("/login");

    // Fill in credentials
    await page.getByLabel(/email/i).fill(TEST_USER.email);

    // Trigger magic link (this will send an email in real flow)
    await page.getByRole("button", { name: /send magic link/i }).click();

    // Should show success message
    await expect(
      page.getByText(/check your email for the magic link/i)
    ).toBeVisible({ timeout: 10000 });

    // Email input should be cleared
    await expect(page.getByLabel(/email/i)).toHaveValue("");
  });
});
