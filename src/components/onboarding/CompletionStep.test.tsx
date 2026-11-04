import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CompletionStep } from "./CompletionStep";

describe("CompletionStep", () => {
  it("renders completion message with household name", () => {
    render(
      <CompletionStep householdName="Smith Family" onComplete={vi.fn()} />
    );

    expect(screen.getByText("You're All Set!")).toBeInTheDocument();
    expect(
      screen.getByText("Smith Family is ready to use")
    ).toBeInTheDocument();
  });

  it("displays next steps suggestions", () => {
    render(
      <CompletionStep householdName="Test Household" onComplete={vi.fn()} />
    );

    expect(
      screen.getByText(/Add items to your shopping list/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Invite family members from Settings/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Create store profiles for smarter shopping/)
    ).toBeInTheDocument();
  });

  it("calls onComplete when Start Shopping is clicked", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();

    render(
      <CompletionStep householdName="Test Household" onComplete={onComplete} />
    );

    await user.click(screen.getByRole("button", { name: /start shopping/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
