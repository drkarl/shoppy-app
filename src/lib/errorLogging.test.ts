import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createIssueUrl, logError } from "./errorLogging";

describe("errorLogging", () => {
  describe("logError", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("logs error message to console", () => {
      const error = new Error("Test error message");
      logError(error);

      expect(console.error).toHaveBeenCalledWith(
        "[Error Boundary]",
        "Test error message"
      );
    });

    it("logs stack trace when available", () => {
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at testFunction (/test.ts:1:1)";
      logError(error);

      expect(console.error).toHaveBeenCalledWith("[Stack Trace]", error.stack);
    });

    it("logs component stack when provided in errorInfo", () => {
      const error = new Error("Test error");
      const errorInfo = {
        componentStack: "\n    in TestComponent\n    in App",
      };
      logError(error, errorInfo);

      expect(console.error).toHaveBeenCalledWith(
        "[Component Stack]",
        errorInfo.componentStack
      );
    });

    it("logs context when provided", () => {
      const error = new Error("Test error");
      const context = { level: "app", route: "/test" };
      logError(error, undefined, context);

      expect(console.error).toHaveBeenCalledWith("[Context]", context);
    });

    it("returns logged error object with all fields", () => {
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test";
      const errorInfo = { componentStack: "in Component" };
      const context = { level: "app" };

      const result = logError(error, errorInfo, context);

      expect(result).toMatchObject({
        message: "Test error",
        stack: error.stack,
        componentStack: "in Component",
        context: { level: "app" },
      });
      expect(result.timestamp).toBeDefined();
    });

    it("handles error without stack trace", () => {
      const error = new Error("Test error");
      delete error.stack;
      logError(error);

      expect(console.error).toHaveBeenCalledWith(
        "[Error Boundary]",
        "Test error"
      );
      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });

  describe("createIssueUrl", () => {
    it("creates GitHub issue URL with encoded title", () => {
      const error = new Error("Test error message");
      const url = createIssueUrl(error);

      expect(url).toContain("github.com/drkarl/shoppy-app/issues/new");
      expect(url).toContain("title=Bug%3A%20Test%20error%20message");
    });

    it("truncates long error messages in title to 50 chars", () => {
      const longMessage =
        "This is a very long error message that exceeds the maximum character limit for a bug report title";
      const error = new Error(longMessage);
      const url = createIssueUrl(error);

      const titleParam = url.match(/title=([^&]*)/)?.[1] || "";
      const decodedTitle = decodeURIComponent(titleParam);
      // "Bug: " (5 chars) + first 50 chars of message = 55 total
      expect(decodedTitle).toBe(
        "Bug: This is a very long error message that exceeds the"
      );
    });

    it("includes error message in body", () => {
      const error = new Error("Test error");
      const url = createIssueUrl(error);

      expect(url).toContain("body=");
      const bodyParam = url.match(/body=([^&]*)/)?.[1] || "";
      const decodedBody = decodeURIComponent(bodyParam);
      expect(decodedBody).toContain("Test error");
    });

    it("includes stack trace in body when available", () => {
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at testFunction";
      const url = createIssueUrl(error);

      const bodyParam = url.match(/body=([^&]*)/)?.[1] || "";
      const decodedBody = decodeURIComponent(bodyParam);
      expect(decodedBody).toContain("testFunction");
    });

    it("handles error without stack trace", () => {
      const error = new Error("Test error");
      delete error.stack;
      const url = createIssueUrl(error);

      const bodyParam = url.match(/body=([^&]*)/)?.[1] || "";
      const decodedBody = decodeURIComponent(bodyParam);
      expect(decodedBody).toContain("No stack trace available");
    });
  });
});
