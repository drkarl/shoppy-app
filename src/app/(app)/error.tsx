"use client";

import { AlertTriangle, Bug, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

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

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Route-level error boundary for protected app routes.
 * Catches errors from list, settings, and other authenticated pages.
 */
export default function AppError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logError(error, undefined, { level: "route", route: "(app)" });
  }, [error]);

  const handleReportIssue = () => {
    window.open(createIssueUrl(error), "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4"
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
            We encountered an error loading this page. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-3">
            <p className="break-all font-mono text-xs text-muted-foreground">
              {error.message}
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <div className="flex w-full gap-2">
            <Button onClick={reset} variant="default" className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
            <Button
              onClick={handleReportIssue}
              variant="outline"
              className="flex-1"
            >
              <Bug className="mr-2 h-4 w-4" />
              Report Issue
            </Button>
          </div>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/list">
              <Home className="mr-2 h-4 w-4" />
              Back to List
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
