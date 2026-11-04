import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InviteStep } from "./InviteStep";

describe("InviteStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, "location", {
      value: { origin: "http://localhost:3000" },
      writable: true,
    });

    Object.defineProperty(navigator, "share", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it("renders invite step with correct content", () => {
    render(
      <InviteStep
        inviteCode="abc123"
        householdName="Test Household"
        onNext={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText("Invite Your Partner")).toBeInTheDocument();
    expect(
      screen.getByText(/Share this link to invite others to Test Household/)
    ).toBeInTheDocument();
  });

  it("displays invite URL", () => {
    render(
      <InviteStep
        inviteCode="abc123"
        householdName="Test Household"
        onNext={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Invite Link")).toHaveValue(
      "http://localhost:3000/join/abc123"
    );
  });

  it("has copy button for invite link", () => {
    render(
      <InviteStep
        inviteCode="abc123"
        householdName="Test Household"
        onNext={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Copy invite link")).toBeInTheDocument();
  });

  it("calls onSkip when Skip is clicked", async () => {
    const onSkip = vi.fn();
    const user = userEvent.setup();

    render(
      <InviteStep
        inviteCode="abc123"
        householdName="Test Household"
        onNext={vi.fn()}
        onSkip={onSkip}
      />
    );

    await user.click(screen.getByRole("button", { name: /skip for now/i }));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("calls onNext when Continue is clicked", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();

    render(
      <InviteStep
        inviteCode="abc123"
        householdName="Test Household"
        onNext={onNext}
        onSkip={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("uses Web Share API when available", async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: mockShare,
      writable: true,
      configurable: true,
    });

    const onNext = vi.fn();
    const user = userEvent.setup();

    render(
      <InviteStep
        inviteCode="abc123"
        householdName="My Family"
        onNext={onNext}
        onSkip={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /share invite link/i })
    );

    expect(mockShare).toHaveBeenCalledWith({
      title: "Join My Family on Shoppy",
      text: 'Join my household "My Family" on Shoppy!',
      url: "http://localhost:3000/join/abc123",
    });

    await waitFor(() => {
      expect(onNext).toHaveBeenCalled();
    });
  });

  it("shows expiry info text", () => {
    render(
      <InviteStep
        inviteCode="abc123"
        householdName="Test Household"
        onNext={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText(/This link expires in 7 days/)).toBeInTheDocument();
  });
});
