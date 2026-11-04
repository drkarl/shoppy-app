import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { useSyncStatus } from "@/hooks/useSyncStatus";

import { OfflineIndicator } from "./OfflineIndicator";

vi.mock("@/hooks/useSyncStatus", () => ({
  useSyncStatus: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("OfflineIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("visibility", () => {
    it("renders nothing when synced and not justSynced", () => {
      (useSyncStatus as Mock).mockReturnValue({
        status: "synced",
        pendingOperations: 0,
        error: null,
        justSynced: false,
        isOffline: false,
        isSyncing: false,
        hasError: false,
      });

      const { container } = render(<OfflineIndicator />);
      expect(container.firstChild).toBeNull();
    });

    it("renders banner when offline", () => {
      (useSyncStatus as Mock).mockReturnValue({
        status: "offline",
        pendingOperations: 0,
        error: null,
        justSynced: false,
        isOffline: true,
        isSyncing: false,
        hasError: false,
      });

      render(<OfflineIndicator />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(
        screen.getByText("Offline - changes will sync later")
      ).toBeInTheDocument();
    });

    it("renders banner when syncing", () => {
      (useSyncStatus as Mock).mockReturnValue({
        status: "syncing",
        pendingOperations: 2,
        error: null,
        justSynced: false,
        isOffline: false,
        isSyncing: true,
        hasError: false,
      });

      render(<OfflineIndicator />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Syncing...")).toBeInTheDocument();
    });

    it("renders banner when justSynced", () => {
      (useSyncStatus as Mock).mockReturnValue({
        status: "synced",
        pendingOperations: 0,
        error: null,
        justSynced: true,
        isOffline: false,
        isSyncing: false,
        hasError: false,
      });

      render(<OfflineIndicator />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Synced")).toBeInTheDocument();
    });

    it("renders banner when there is an error", () => {
      (useSyncStatus as Mock).mockReturnValue({
        status: "error",
        pendingOperations: 0,
        error: new Error("Network error"),
        justSynced: false,
        isOffline: false,
        isSyncing: false,
        hasError: true,
      });

      render(<OfflineIndicator />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Sync error - will retry")).toBeInTheDocument();
    });
  });

  describe("styling", () => {
    it("applies amber styling for offline state", () => {
      (useSyncStatus as Mock).mockReturnValue({
        status: "offline",
        pendingOperations: 0,
        error: null,
        justSynced: false,
        isOffline: true,
        isSyncing: false,
        hasError: false,
      });

      render(<OfflineIndicator />);
      const banner = screen.getByRole("alert");
      expect(banner).toHaveClass("bg-amber-100");
    });

    it("applies blue styling for syncing state", () => {
      (useSyncStatus as Mock).mockReturnValue({
        status: "syncing",
        pendingOperations: 0,
        error: null,
        justSynced: false,
        isOffline: false,
        isSyncing: true,
        hasError: false,
      });

      render(<OfflineIndicator />);
      const banner = screen.getByRole("alert");
      expect(banner).toHaveClass("bg-blue-100");
    });

    it("applies green styling for justSynced state", () => {
      (useSyncStatus as Mock).mockReturnValue({
        status: "synced",
        pendingOperations: 0,
        error: null,
        justSynced: true,
        isOffline: false,
        isSyncing: false,
        hasError: false,
      });

      render(<OfflineIndicator />);
      const banner = screen.getByRole("alert");
      expect(banner).toHaveClass("bg-green-100");
    });

    it("applies red styling for error state", () => {
      (useSyncStatus as Mock).mockReturnValue({
        status: "error",
        pendingOperations: 0,
        error: new Error("Failed"),
        justSynced: false,
        isOffline: false,
        isSyncing: false,
        hasError: true,
      });

      render(<OfflineIndicator />);
      const banner = screen.getByRole("alert");
      expect(banner).toHaveClass("bg-red-100");
    });
  });

  describe("accessibility", () => {
    it("has proper aria-live for offline state", () => {
      (useSyncStatus as Mock).mockReturnValue({
        status: "offline",
        pendingOperations: 0,
        error: null,
        justSynced: false,
        isOffline: true,
        isSyncing: false,
        hasError: false,
      });

      render(<OfflineIndicator />);
      expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "polite");
    });

    it("has assertive aria-live for error state", () => {
      (useSyncStatus as Mock).mockReturnValue({
        status: "error",
        pendingOperations: 0,
        error: new Error("Failed"),
        justSynced: false,
        isOffline: false,
        isSyncing: false,
        hasError: true,
      });

      render(<OfflineIndicator />);
      expect(screen.getByRole("alert")).toHaveAttribute(
        "aria-live",
        "assertive"
      );
    });

    it("includes status in aria-label", () => {
      (useSyncStatus as Mock).mockReturnValue({
        status: "offline",
        pendingOperations: 0,
        error: null,
        justSynced: false,
        isOffline: true,
        isSyncing: false,
        hasError: false,
      });

      render(<OfflineIndicator />);
      expect(screen.getByRole("alert")).toHaveAttribute(
        "aria-label",
        "Sync status: offline"
      );
    });
  });

  describe("toast notifications", () => {
    it("shows toast when sync error occurs", async () => {
      const { toast } = await import("sonner");

      (useSyncStatus as Mock).mockReturnValue({
        status: "error",
        pendingOperations: 0,
        error: new Error("Connection failed"),
        justSynced: false,
        isOffline: false,
        isSyncing: false,
        hasError: true,
      });

      render(<OfflineIndicator />);

      expect(toast.error).toHaveBeenCalledWith("Sync error: Connection failed");
    });

    it("does not show toast for the same error twice", async () => {
      const { toast } = await import("sonner");

      const syncError = new Error("Connection failed");

      (useSyncStatus as Mock).mockReturnValue({
        status: "error",
        pendingOperations: 0,
        error: syncError,
        justSynced: false,
        isOffline: false,
        isSyncing: false,
        hasError: true,
      });

      const { rerender } = render(<OfflineIndicator />);

      expect(toast.error).toHaveBeenCalledTimes(1);

      // Rerender with same error
      rerender(<OfflineIndicator />);

      expect(toast.error).toHaveBeenCalledTimes(1);
    });
  });
});
