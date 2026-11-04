/**
 * Error logging utility for centralized error handling.
 * Logs errors to console with stack traces.
 * Can be extended to send errors to external services (e.g., Sentry).
 */

export interface ComponentErrorInfo {
  componentStack?: string | null;
}

export interface LoggedError {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

/**
 * Logs an error to the console with full context.
 * In production, this could be extended to send to Sentry or similar services.
 */
export function logError(
  error: Error,
  errorInfo?: ComponentErrorInfo,
  context?: Record<string, unknown>
): LoggedError {
  const loggedError: LoggedError = {
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo?.componentStack ?? undefined,
    timestamp: new Date().toISOString(),
    context,
  };

  // Log to console with full stack trace
  console.error("[Error Boundary]", error.message);
  if (error.stack) {
    console.error("[Stack Trace]", error.stack);
  }
  if (errorInfo?.componentStack) {
    console.error("[Component Stack]", errorInfo.componentStack);
  }
  if (context) {
    console.error("[Context]", context);
  }

  // Future: Send to external error tracking service
  // if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  //   Sentry.captureException(error, { extra: loggedError });
  // }

  return loggedError;
}

/**
 * Creates a GitHub issue URL pre-filled with error details.
 */
export function createIssueUrl(error: Error): string {
  const title = encodeURIComponent(`Bug: ${error.message.slice(0, 50)}`);
  const body = encodeURIComponent(
    `## Error Description\n\n${error.message}\n\n## Steps to Reproduce\n\n1. \n2. \n3. \n\n## Stack Trace\n\n\`\`\`\n${error.stack || "No stack trace available"}\n\`\`\``
  );

  return `https://github.com/drkarl/shoppy-app/issues/new?title=${title}&body=${body}`;
}
