"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useHousehold } from "@/components/providers/HouseholdProvider";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { currentHousehold, isLoading: householdLoading } = useHousehold();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Redirect to list if user already has a household
  useEffect(() => {
    if (!authLoading && !householdLoading && user && currentHousehold) {
      router.push("/list");
    }
  }, [authLoading, householdLoading, user, currentHousehold, router]);

  // Show nothing while loading or redirecting
  if (authLoading || householdLoading || !user) {
    return null;
  }

  // Show nothing if user already has a household (will redirect)
  if (currentHousehold) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <OnboardingWizard />
      </main>
    </div>
  );
}
