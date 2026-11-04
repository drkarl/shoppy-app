"use client";

import { AlertTriangle, Bug, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createIssueUrl, logError } from "@/lib/errorLogging";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback component to render when an error occurs */
  fallback?: ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional level indicator for styling/logging purposes */
  level?: "app" | "route" | "component";
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary component that catches JavaScript errors in child components.
 *
 * Note: Error boundaries do NOT catch errors in:
 * - Event handlers (use try/catch instead)
 * - Asynchronous code (setTimeout, fetch, promises)
 * - Server-side rendering
 * - Errors thrown in the error boundary itself
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, level = "component" } = this.props;

    // Log the error with context
    logError(error, errorInfo, { level });

    // Call optional error callback
    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReportIssue = (): void => {
    const { error } = this.state;
    if (error) {
      window.open(createIssueUrl(error), "_blank", "noopener,noreferrer");
    }
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div
          className="flex min-h-[200px] items-center justify-center p-4"
          role="alert"
          aria-live="assertive"
        >
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred. You can try again or report this
                issue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="rounded-md bg-muted p-3">
                  <p className="break-all font-mono text-xs text-muted-foreground">
                    {error.message}
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                onClick={this.handleRetry}
                variant="default"
                className="flex-1"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
              <Button
                onClick={this.handleReportIssue}
                variant="outline"
                className="flex-1"
              >
                <Bug className="mr-2 h-4 w-4" />
                Report Issue
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return children;
  }
}
