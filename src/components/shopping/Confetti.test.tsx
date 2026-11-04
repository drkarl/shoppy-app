import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Confetti } from "./Confetti";

describe("Confetti", () => {
  it("does not render when isActive is false", () => {
    render(<Confetti isActive={false} />);

    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();
  });

  it("renders confetti particles when isActive is true", () => {
    render(<Confetti isActive={true} />);

    expect(screen.getByTestId("confetti")).toBeInTheDocument();
  });

  it("is hidden from screen readers", () => {
    render(<Confetti isActive={true} />);

    const confetti = screen.getByTestId("confetti");
    expect(confetti).toHaveAttribute("aria-hidden", "true");
  });

  it("renders multiple confetti particles", () => {
    render(<Confetti isActive={true} />);

    const confetti = screen.getByTestId("confetti");
    // Should have multiple children (confetti particles)
    expect(confetti.children.length).toBeGreaterThan(10);
  });

  it("calls onComplete after animation finishes", async () => {
    vi.useFakeTimers();

    const onComplete = vi.fn();
    render(<Confetti isActive={true} onComplete={onComplete} />);

    expect(onComplete).not.toHaveBeenCalled();

    // Fast-forward past the animation duration (2500ms)
    await act(async () => {
      vi.advanceTimersByTime(2600);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("removes confetti after animation completes", async () => {
    vi.useFakeTimers();

    render(<Confetti isActive={true} />);

    expect(screen.getByTestId("confetti")).toBeInTheDocument();

    // Fast-forward past the animation duration
    await act(async () => {
      vi.advanceTimersByTime(2600);
    });

    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("does not trigger new animation when already active", () => {
    const { rerender } = render(<Confetti isActive={true} />);

    const confetti1 = screen.getByTestId("confetti");
    const initialChildCount = confetti1.children.length;

    // Re-render with same isActive=true
    rerender(<Confetti isActive={true} />);

    const confetti2 = screen.getByTestId("confetti");
    // Particles should remain the same (not regenerated)
    expect(confetti2.children.length).toBe(initialChildCount);
  });

  it("has pointer-events-none to not block interactions", () => {
    render(<Confetti isActive={true} />);

    const confetti = screen.getByTestId("confetti");
    expect(confetti).toHaveClass("pointer-events-none");
  });
});
