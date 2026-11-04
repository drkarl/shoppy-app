import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SyncStatus } from "./SyncStatus";

describe("SyncStatus", () => {
  describe("offline status", () => {
    it("renders offline message without pending operations", () => {
      render(
        <SyncStatus status="offline" pendingOperations={0} justSynced={false} />
      );

      expect(
        screen.getByText("Offline - changes will sync later")
      ).toBeInTheDocument();
    });

    it("renders offline message with singular pending operation", () => {
      render(
        <SyncStatus status="offline" pendingOperations={1} justSynced={false} />
      );

      expect(
        screen.getByText("Offline - 1 change will sync later")
      ).toBeInTheDocument();
    });

    it("renders offline message with plural pending operations", () => {
      render(
        <SyncStatus status="offline" pendingOperations={3} justSynced={false} />
      );

      expect(
        screen.getByText("Offline - 3 changes will sync later")
      ).toBeInTheDocument();
    });

    it("has correct aria attributes", () => {
      render(
        <SyncStatus status="offline" pendingOperations={0} justSynced={false} />
      );

      expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    });
  });

  describe("syncing status", () => {
    it("renders syncing message with spinner", () => {
      render(
        <SyncStatus status="syncing" pendingOperations={0} justSynced={false} />
      );

      expect(screen.getByText("Syncing...")).toBeInTheDocument();
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  describe("synced status", () => {
    it("renders nothing when synced and not justSynced", () => {
      const { container } = render(
        <SyncStatus status="synced" pendingOperations={0} justSynced={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders success message when justSynced is true", () => {
      render(
        <SyncStatus status="synced" pendingOperations={0} justSynced={true} />
      );

      expect(screen.getByText("Synced")).toBeInTheDocument();
    });
  });

  describe("error status", () => {
    it("renders error message", () => {
      render(
        <SyncStatus status="error" pendingOperations={0} justSynced={false} />
      );

      expect(screen.getByText("Sync error - will retry")).toBeInTheDocument();
    });

    it("has assertive aria-live for errors", () => {
      render(
        <SyncStatus status="error" pendingOperations={0} justSynced={false} />
      );

      expect(screen.getByRole("status")).toHaveAttribute(
        "aria-live",
        "assertive"
      );
    });
  });

  describe("justSynced state", () => {
    it("takes precedence over other statuses", () => {
      render(
        <SyncStatus status="offline" pendingOperations={5} justSynced={true} />
      );

      // Should show synced message, not offline
      expect(screen.getByText("Synced")).toBeInTheDocument();
      expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
    });
  });

  describe("className prop", () => {
    it("applies custom className", () => {
      render(
        <SyncStatus
          status="offline"
          pendingOperations={0}
          justSynced={false}
          className="custom-class"
        />
      );

      expect(screen.getByRole("status")).toHaveClass("custom-class");
    });
  });
});
