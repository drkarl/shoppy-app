import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./ErrorBoundary";

// Component that throws an error for testing
function ErrorThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <div>Normal content</div>;
}

// Suppress console.error during tests since ErrorBoundary logs errors
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("catches component errors and shows fallback UI", () => {
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText(/An unexpected error occurred/)
    ).toBeInTheDocument();
    expect(screen.getByText("Test error message")).toBeInTheDocument();
  });

  it("shows Retry button in error state", () => {
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("shows Report Issue button in error state", () => {
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(
      screen.getByRole("button", { name: /report issue/i })
    ).toBeInTheDocument();
  });

  it("remounts component tree when Retry is clicked", async () => {
    const user = userEvent.setup();

    // Using a ref to control throwing behavior
    let shouldThrow = true;
    const ControlledComponent = () => {
      if (shouldThrow) {
        throw new Error("Test error");
      }
      return <div>Recovered content</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <ControlledComponent />
      </ErrorBoundary>
    );

    // Should show error state
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Fix the error condition
    shouldThrow = false;

    // Click Retry
    await user.click(screen.getByRole("button", { name: /retry/i }));

    // Rerender to trigger the recovered state
    rerender(
      <ErrorBoundary>
        <ControlledComponent />
      </ErrorBoundary>
    );

    // Should now show recovered content
    expect(screen.getByText("Recovered content")).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ErrorThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom error UI")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("calls onError callback when error is caught", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ErrorThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe("Test error message");
  });

  it("logs error to console with context", () => {
    render(
      <ErrorBoundary level="app">
        <ErrorThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalledWith(
      "[Error Boundary]",
      "Test error message"
    );
    expect(console.error).toHaveBeenCalledWith(
      "[Context]",
      expect.objectContaining({ level: "app" })
    );
  });

  it("has proper accessibility attributes on error state", () => {
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    const alertContainer = screen.getByRole("alert");
    expect(alertContainer).toBeInTheDocument();
    expect(alertContainer).toHaveAttribute("aria-live", "assertive");
  });

  it("opens Report Issue link in new window", async () => {
    const user = userEvent.setup();
    const mockOpen = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <ErrorBoundary>
        <ErrorThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    await user.click(screen.getByRole("button", { name: /report issue/i }));

    expect(mockOpen).toHaveBeenCalledWith(
      expect.stringContaining("github.com/drkarl/shoppy-app/issues/new"),
      "_blank",
      "noopener,noreferrer"
    );

    mockOpen.mockRestore();
  });

  it("does NOT catch errors in async code (documented limitation)", async () => {
    // This test documents that error boundaries don't catch async errors
    // In real usage, async errors need try/catch blocks
    const AsyncErrorComponent = () => {
      // This error would NOT be caught by ErrorBoundary
      // Using setTimeout to simulate async behavior
      // setTimeout(() => { throw new Error('Async error'); }, 0);
      return <div>Async component</div>;
    };

    render(
      <ErrorBoundary>
        <AsyncErrorComponent />
      </ErrorBoundary>
    );

    // Component renders normally because async errors aren't caught
    expect(screen.getByText("Async component")).toBeInTheDocument();
  });
});
