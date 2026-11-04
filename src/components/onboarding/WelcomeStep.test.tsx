import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WelcomeStep } from "./WelcomeStep";

describe("WelcomeStep", () => {
  it("renders welcome message and description", () => {
    render(<WelcomeStep onNext={vi.fn()} />);

    expect(screen.getByText("Welcome to Shoppy!")).toBeInTheDocument();
    expect(
      screen.getByText("Your collaborative smart shopping list")
    ).toBeInTheDocument();
  });

  it("displays onboarding steps explanation", () => {
    render(<WelcomeStep onNext={vi.fn()} />);

    expect(screen.getByText(/Create a household/)).toBeInTheDocument();
    expect(screen.getByText(/Add items/)).toBeInTheDocument();
    expect(screen.getByText(/Shop together/)).toBeInTheDocument();
  });

  it("calls onNext when Get Started is clicked", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();

    render(<WelcomeStep onNext={onNext} />);

    await user.click(screen.getByRole("button", { name: /get started/i }));

    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
