"use client";

import { CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CompletionStepProps {
  householdName: string;
  onComplete: () => void;
}

export function CompletionStep({
  householdName,
  onComplete,
}: CompletionStepProps) {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
          <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <CardTitle className="text-2xl">You&apos;re All Set!</CardTitle>
        <CardDescription className="text-base">
          {householdName} is ready to use
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">
            Here&apos;s what you can do next:
          </p>
          <ul className="list-inside list-disc space-y-2">
            <li>Add items to your shopping list</li>
            <li>Invite family members from Settings</li>
            <li>Create store profiles for smarter shopping</li>
          </ul>
        </div>
        <Button onClick={onComplete} className="w-full" size="lg">
          Start Shopping
        </Button>
      </CardContent>
    </Card>
  );
}
