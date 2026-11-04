import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceWorkerRegistration } from "./ServiceWorkerRegistration";

describe("ServiceWorkerRegistration", () => {
  const mockRegister = vi.fn();
  let originalServiceWorker: ServiceWorkerContainer | undefined;

  beforeEach(() => {
    mockRegister.mockReset();
    mockRegister.mockResolvedValue({});
    originalServiceWorker = navigator.serviceWorker;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original serviceWorker
    Object.defineProperty(navigator, "serviceWorker", {
      value: originalServiceWorker,
      writable: true,
      configurable: true,
    });
  });

  it("registers service worker when supported", () => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: mockRegister },
      writable: true,
      configurable: true,
    });

    render(<ServiceWorkerRegistration />);

    expect(mockRegister).toHaveBeenCalledWith("/sw.js");
  });

  it("does not throw when service worker is not supported", () => {
    // Delete serviceWorker to simulate unsupported environment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).serviceWorker;

    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow();
  });

  it("renders nothing", () => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: mockRegister },
      writable: true,
      configurable: true,
    });

    const { container } = render(<ServiceWorkerRegistration />);

    expect(container.innerHTML).toBe("");
  });

  it("logs error when registration fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const registrationError = new Error("Registration failed");
    mockRegister.mockRejectedValue(registrationError);

    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: mockRegister },
      writable: true,
      configurable: true,
    });

    render(<ServiceWorkerRegistration />);

    // Wait for the promise rejection to be handled
    await vi.waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Service Worker registration failed:",
        registrationError
      );
    });

    consoleErrorSpy.mockRestore();
  });
});
