"use client";

import { Home, Loader2, LogIn, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/AuthProvider";
import { useHousehold } from "@/components/providers/HouseholdProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type InviteStatus =
  | "loading"
  | "valid"
  | "expired"
  | "invalid"
  | "already_member"
  | "error";

interface InviteInfo {
  household_id: string;
  household_name: string;
  expires_at: string;
}

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { refreshHouseholds } = useHousehold();

  const [status, setStatus] = useState<InviteStatus>("loading");
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasFetched = useRef(false);
  const retryCount = useRef(0);
  const maxRetries = 3;

  const inviteCode = params.code as string;

  const fetchInviteInfo = useCallback(async () => {
    if (!inviteCode || hasFetched.current) return;

    hasFetched.current = true;

    const attemptFetch = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/households/invite/${inviteCode}`);
        const data = await response.json();

        if (!response.ok) {
          if (data.code === "EXPIRED") {
            setStatus("expired");
            setErrorMessage(data.error);
          } else if (data.code === "ALREADY_MEMBER") {
            setStatus("already_member");
            setInviteInfo({
              household_id: data.household_id,
              household_name: "",
              expires_at: "",
            });
          } else if (data.code === "INVALID_CODE" || response.status === 404) {
            setStatus("invalid");
            setErrorMessage("This invite link is not valid.");
          } else {
            setStatus("error");
            setErrorMessage(data.error || "An error occurred");
          }
          return;
        }

        setInviteInfo(data);
        setStatus("valid");
        retryCount.current = 0;
      } catch {
        // Retry with exponential backoff for transient network failures
        if (retryCount.current < maxRetries) {
          const delay = Math.pow(2, retryCount.current) * 1000; // 1s, 2s, 4s
          retryCount.current++;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return attemptFetch();
        }
        setStatus("error");
        setErrorMessage("Failed to verify invite link. Please try again.");
      }
    };

    await attemptFetch();
  }, [inviteCode]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchInviteInfo();
    }
  }, [authLoading, user, fetchInviteInfo]);

  const handleJoin = async () => {
    if (!inviteCode || isJoining) return;

    setIsJoining(true);

    try {
      const response = await fetch("/api/households/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: inviteCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          toast.success("You're already a member of this household");
          router.push("/list");
          return;
        }
        throw new Error(data.error || "Failed to join household");
      }

      await refreshHouseholds();
      toast.success(`Welcome to ${data.household?.name || "the household"}!`);
      router.push("/list");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to join household";
      toast.error(message);
      setIsJoining(false);
    }
  };

  // Show login prompt if not authenticated
  if (!authLoading && !user) {
    // Store redirect URL in sessionStorage as backup for OAuth flows
    // that may lose query params during provider redirects
    const redirectUrl = `/join/${inviteCode}`;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("auth_redirect", redirectUrl);
    }

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Join a Household</CardTitle>
            <CardDescription>
              Sign in to join this household with your invite link
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={`/login?redirect=${redirectUrl}`}>
                <LogIn className="mr-2 h-4 w-4" />
                Sign in to continue
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (status === "loading" || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              Verifying invite link...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already a member - redirect
  if (status === "already_member") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <Users className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle>Already a Member</CardTitle>
            <CardDescription>
              You&apos;re already a member of this household
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/list">
                <Home className="mr-2 h-4 w-4" />
                Go to Shopping List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired invite
  if (status === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Users className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invite Expired</CardTitle>
            <CardDescription>
              {errorMessage ||
                "This invite has expired. Ask the household owner for a new link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Go to Login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid invite (404)
  if (status === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Users className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Invite Link</CardTitle>
            <CardDescription>
              {errorMessage ||
                "This invite link is not valid. Please check the link and try again."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Go to Login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Users className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Something Went Wrong</CardTitle>
            <CardDescription>
              {errorMessage ||
                "An error occurred while verifying the invite link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => {
                hasFetched.current = false;
                setStatus("loading");
                fetchInviteInfo();
              }}
              variant="outline"
              className="w-full"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid invite - show join UI
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Join Household</CardTitle>
          <CardDescription>You&apos;ve been invited to join</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-xl font-semibold">{inviteInfo?.household_name}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Click the button below to join this household and start
            collaborating on shopping lists.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleJoin}
            disabled={isJoining}
            className="w-full"
            size="lg"
          >
            {isJoining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <Users className="mr-2 h-4 w-4" />
                Join Household
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
