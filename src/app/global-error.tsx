"use client";

import { useEffect } from "react";

import { logError } from "@/lib/errorLogging";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary for fatal errors that break the root layout.
 * This component cannot use any external UI components since the root layout may have failed.
 * Uses inline styles and basic HTML for maximum reliability.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    logError(error, undefined, { level: "global", digest: error.digest });
  }, [error]);

  // Note: This duplicates createIssueUrl logic intentionally.
  // global-error.tsx must work even if module imports fail, so we inline the URL generation.
  const handleReportIssue = () => {
    const title = encodeURIComponent(`Bug: ${error.message.slice(0, 50)}`);
    const body = encodeURIComponent(
      `## Error Description\n\n${error.message}\n\n## Steps to Reproduce\n\n1. \n2. \n3. \n\n## Stack Trace\n\n\`\`\`\n${error.stack || "No stack trace available"}\n\`\`\``
    );
    window.open(
      `https://github.com/drkarl/shoppy-app/issues/new?title=${title}&body=${body}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <div
          role="alert"
          aria-live="assertive"
          style={{
            maxWidth: "28rem",
            width: "100%",
            margin: "1rem",
            padding: "1.5rem",
            borderRadius: "0.75rem",
            border: "1px solid #27272a",
            backgroundColor: "#18181b",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div
              style={{
                width: "3rem",
                height: "3rem",
                margin: "0 auto 0.75rem",
                borderRadius: "50%",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <h1
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                margin: "0 0 0.5rem",
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: "0.875rem",
                color: "#a1a1aa",
                margin: 0,
              }}
            >
              A critical error occurred. Please try refreshing the page.
            </p>
          </div>

          <div
            style={{
              padding: "0.75rem",
              borderRadius: "0.375rem",
              backgroundColor: "#27272a",
              marginBottom: "1.5rem",
            }}
          >
            <p
              style={{
                fontFamily: "monospace",
                fontSize: "0.75rem",
                color: "#a1a1aa",
                margin: 0,
                wordBreak: "break-all",
              }}
            >
              {error.message}
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={reset}
              style={{
                flex: 1,
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "none",
                backgroundColor: "#fafafa",
                color: "#18181b",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
            <button
              onClick={handleReportIssue}
              style={{
                flex: 1,
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "1px solid #27272a",
                backgroundColor: "transparent",
                color: "#fafafa",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Report Issue
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
