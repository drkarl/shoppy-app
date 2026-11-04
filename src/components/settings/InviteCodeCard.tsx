"use client";

import { Check, Copy, Loader2, RefreshCw, Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InviteDetails {
  invite_code: string;
  invite_expires_at: string;
  household_name: string;
  is_owner: boolean;
}

export function InviteCodeCard() {
  const { currentHousehold, userRole, refreshHouseholds } = useHousehold();

  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasFetched = useRef(false);
  const previousHouseholdId = useRef<string | null>(null);

  const fetchInviteDetails = useCallback(async () => {
    if (!currentHousehold?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/households/${currentHousehold.id}/invite`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch invite details");
      }

      setInviteDetails(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load invite details";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentHousehold?.id]);

  useEffect(() => {
    // Reset fetch flag when household changes
    if (currentHousehold?.id !== previousHouseholdId.current) {
      hasFetched.current = false;
      previousHouseholdId.current = currentHousehold?.id || null;
    }

    if (currentHousehold?.id && !hasFetched.current) {
      hasFetched.current = true;
      fetchInviteDetails();
    }
  }, [currentHousehold?.id, fetchInviteDetails]);

  const inviteUrl = inviteDetails
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${inviteDetails.invite_code}`
    : "";

  const handleCopy = async () => {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Invite link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleShare = async () => {
    if (!inviteUrl || !inviteDetails) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${inviteDetails.household_name} on Shoppy`,
          text: `Join my household "${inviteDetails.household_name}" on Shoppy!`,
          url: inviteUrl,
        });
      } catch (err) {
        // User cancelled or share failed, fall back to copy
        if ((err as Error).name !== "AbortError") {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  const handleRegenerate = async () => {
    if (!currentHousehold?.id || isRegenerating) return;

    setIsRegenerating(true);

    try {
      const response = await fetch(
        `/api/households/${currentHousehold.id}/invite`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to regenerate invite code");
      }

      setInviteDetails((prev) =>
        prev
          ? {
              ...prev,
              invite_code: data.invite_code,
              invite_expires_at: data.invite_expires_at,
            }
          : null
      );

      await refreshHouseholds();
      toast.success("Invite link regenerated. The old link is now invalid.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to regenerate invite code";
      toast.error(message);
    } finally {
      setIsRegenerating(false);
    }
  };

  const formatExpiryDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isExpired = inviteDetails
    ? new Date(inviteDetails.invite_expires_at) < new Date()
    : false;

  const isOwner = userRole === "owner";

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invite Link</CardTitle>
          <CardDescription>Share this link to invite others</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            onClick={() => {
              hasFetched.current = false;
              fetchInviteDetails();
            }}
          >
            Try Again
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite Link</CardTitle>
        <CardDescription>
          Share this link to invite others to{" "}
          {inviteDetails?.household_name || "your household"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invite-url">Invite URL</Label>
          <div className="flex gap-2">
            <Input
              id="invite-url"
              value={inviteUrl}
              readOnly
              className="font-mono text-sm"
              aria-label="Invite URL"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              aria-label="Copy invite link"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {isExpired ? (
              <span className="text-destructive">Expired</span>
            ) : (
              <>
                Expires{" "}
                {formatExpiryDate(inviteDetails?.invite_expires_at || "")}
              </>
            )}
          </span>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button onClick={handleShare} className="flex-1">
          <Share2 className="mr-2 h-4 w-4" />
          Share Link
        </Button>
        {isOwner && (
          <Button
            variant="outline"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            aria-label="Regenerate invite link"
          >
            {isRegenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
