import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CreateHouseholdStep } from "./CreateHouseholdStep";

describe("CreateHouseholdStep", () => {
  it("renders household creation form", () => {
    render(<CreateHouseholdStep onNext={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText("Create Your Household")).toBeInTheDocument();
    expect(screen.getByLabelText("Household Name")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create household/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("calls onBack when Back button is clicked", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();

    render(<CreateHouseholdStep onNext={vi.fn()} onBack={onBack} />);

    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("disables Create button when input is empty", () => {
    render(<CreateHouseholdStep onNext={vi.fn()} onBack={vi.fn()} />);

    const createButton = screen.getByRole("button", {
      name: /create household/i,
    });
    expect(createButton).toBeDisabled();
  });

  it("enables Create button when input has value", async () => {
    const user = userEvent.setup();

    render(<CreateHouseholdStep onNext={vi.fn()} onBack={vi.fn()} />);

    await user.type(screen.getByLabelText("Household Name"), "My Family");

    const createButton = screen.getByRole("button", {
      name: /create household/i,
    });
    expect(createButton).toBeEnabled();
  });

  it("calls onNext with household name when form is submitted", async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<CreateHouseholdStep onNext={onNext} onBack={vi.fn()} />);

    await user.type(screen.getByLabelText("Household Name"), "Smith Family");
    await user.click(screen.getByRole("button", { name: /create household/i }));

    expect(onNext).toHaveBeenCalledWith("Smith Family");
  });

  it("trims whitespace from household name", async () => {
    const onNext = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<CreateHouseholdStep onNext={onNext} onBack={vi.fn()} />);

    await user.type(
      screen.getByLabelText("Household Name"),
      "  My Household  "
    );
    await user.click(screen.getByRole("button", { name: /create household/i }));

    expect(onNext).toHaveBeenCalledWith("My Household");
  });

  it("shows loading state while creating", async () => {
    const onNext = vi.fn(
      (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 100))
    );
    const user = userEvent.setup();

    render(<CreateHouseholdStep onNext={onNext} onBack={vi.fn()} />);

    await user.type(screen.getByLabelText("Household Name"), "Test");
    await user.click(screen.getByRole("button", { name: /create household/i }));

    expect(screen.getByText("Creating...")).toBeInTheDocument();
    expect(screen.getByLabelText("Household Name")).toBeDisabled();
  });

  it("enforces max length via HTML attribute", () => {
    render(<CreateHouseholdStep onNext={vi.fn()} onBack={vi.fn()} />);

    const input = screen.getByLabelText("Household Name");
    expect(input).toHaveAttribute("maxLength", "50");
  });

  it("shows error when creation fails", async () => {
    const onNext = vi.fn().mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();

    render(<CreateHouseholdStep onNext={onNext} onBack={vi.fn()} />);

    await user.type(screen.getByLabelText("Household Name"), "Test");
    await user.click(screen.getByRole("button", { name: /create household/i }));

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });
});
