"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { useHousehold } from "@/components/providers/HouseholdProvider";

import { CompletionStep } from "./CompletionStep";
import { CreateHouseholdStep } from "./CreateHouseholdStep";
import { InviteStep } from "./InviteStep";
import { StoreProfileStep } from "./StoreProfileStep";
import { WelcomeStep } from "./WelcomeStep";

type OnboardingStep =
  | "welcome"
  | "create-household"
  | "invite"
  | "store-profile"
  | "completion";

interface CreatedHousehold {
  id: string;
  name: string;
  invite_code: string;
}

export function OnboardingWizard() {
  const router = useRouter();
  const { createHousehold, refreshHouseholds } = useHousehold();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [createdHousehold, setCreatedHousehold] =
    useState<CreatedHousehold | null>(null);

  const handleWelcomeNext = useCallback(() => {
    setStep("create-household");
  }, []);

  const handleCreateHouseholdBack = useCallback(() => {
    setStep("welcome");
  }, []);

  const handleCreateHousehold = useCallback(
    async (householdName: string) => {
      const household = await createHousehold(householdName);

      if (!household) {
        throw new Error("Failed to create household");
      }

      setCreatedHousehold({
        id: household.id,
        name: household.name,
        invite_code: household.invite_code,
      });

      toast.success(`Household "${householdName}" created!`);
      setStep("invite");
    },
    [createHousehold]
  );

  const handleInviteNext = useCallback(() => {
    setStep("store-profile");
  }, []);

  const handleInviteSkip = useCallback(() => {
    setStep("store-profile");
  }, []);

  const handleStoreProfileNext = useCallback(() => {
    setStep("completion");
  }, []);

  const handleStoreProfileSkip = useCallback(() => {
    setStep("completion");
  }, []);

  const handleComplete = useCallback(async () => {
    await refreshHouseholds();
    router.push("/list");
  }, [refreshHouseholds, router]);

  const renderStep = () => {
    switch (step) {
      case "welcome":
        return <WelcomeStep onNext={handleWelcomeNext} />;

      case "create-household":
        return (
          <CreateHouseholdStep
            onNext={handleCreateHousehold}
            onBack={handleCreateHouseholdBack}
          />
        );

      case "invite":
        if (!createdHousehold) {
          return null; // useEffect will redirect to create-household
        }
        return (
          <InviteStep
            inviteCode={createdHousehold.invite_code}
            householdName={createdHousehold.name}
            onNext={handleInviteNext}
            onSkip={handleInviteSkip}
          />
        );

      case "store-profile":
        if (!createdHousehold) {
          return null; // useEffect will redirect to create-household
        }
        return (
          <StoreProfileStep
            householdId={createdHousehold.id}
            onNext={handleStoreProfileNext}
            onSkip={handleStoreProfileSkip}
          />
        );

      case "completion":
        if (!createdHousehold) {
          return null; // useEffect will redirect to create-household
        }
        return (
          <CompletionStep
            householdName={createdHousehold.name}
            onComplete={handleComplete}
          />
        );

      default:
        return null;
    }
  };

  const stepIndex = [
    "welcome",
    "create-household",
    "invite",
    "store-profile",
    "completion",
  ].indexOf(step);
  const totalSteps = 5;

  return (
    <div className="space-y-8">
      {/* Progress indicator */}
      <div
        className="flex justify-center gap-2"
        role="progressbar"
        aria-valuenow={stepIndex + 1}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
      >
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={`h-2 w-8 rounded-full transition-colors ${
              index <= stepIndex ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Current step */}
      {renderStep()}
    </div>
  );
}
