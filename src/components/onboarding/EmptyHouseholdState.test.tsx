import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmptyHouseholdState } from "./EmptyHouseholdState";

describe("EmptyHouseholdState", () => {
  const defaultProps = {
    onCreateHousehold: vi.fn(),
    onJoinHousehold: vi.fn(),
  };

  it("renders welcome title", () => {
    render(<EmptyHouseholdState {...defaultProps} />);
    expect(screen.getByText("Welcome to Shoppy!")).toBeInTheDocument();
  });

  it("renders encouraging description", () => {
    render(<EmptyHouseholdState {...defaultProps} />);
    expect(
      screen.getByText(/Create or join a household to start sharing/)
    ).toBeInTheDocument();
  });

  it("renders home icon", () => {
    render(<EmptyHouseholdState {...defaultProps} />);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("renders create household button", () => {
    render(<EmptyHouseholdState {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /Create Household/i })
    ).toBeInTheDocument();
  });

  it("renders join household button", () => {
    render(<EmptyHouseholdState {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /Join Household/i })
    ).toBeInTheDocument();
  });

  it("calls onCreateHousehold when create button clicked", async () => {
    const user = userEvent.setup();
    const handleCreate = vi.fn();
    render(
      <EmptyHouseholdState
        onCreateHousehold={handleCreate}
        onJoinHousehold={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: /Create Household/i }));

    expect(handleCreate).toHaveBeenCalledTimes(1);
  });

  it("calls onJoinHousehold when join button clicked", async () => {
    const user = userEvent.setup();
    const handleJoin = vi.fn();
    render(
      <EmptyHouseholdState
        onCreateHousehold={() => {}}
        onJoinHousehold={handleJoin}
      />
    );

    await user.click(screen.getByRole("button", { name: /Join Household/i }));

    expect(handleJoin).toHaveBeenCalledTimes(1);
  });

  it("has accessible icon container", () => {
    render(<EmptyHouseholdState {...defaultProps} />);
    const iconContainer = document
      .querySelector("svg")
      ?.closest('[aria-hidden="true"]');
    expect(iconContainer).toBeInTheDocument();
  });
});
