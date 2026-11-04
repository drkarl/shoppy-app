"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const CONFETTI_COLORS = [
  "bg-red-500",
  "bg-yellow-500",
  "bg-green-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-orange-500",
];

const PARTICLE_COUNT = 50;
const ANIMATION_DURATION_MS = 2500;

interface ConfettiParticle {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
}

function generateParticles(): ConfettiParticle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.5 + Math.random() * 1,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: 6 + Math.random() * 6,
  }));
}

interface ConfettiProps {
  isActive: boolean;
  onComplete?: () => void;
}

export function Confetti({ isActive, onComplete }: ConfettiProps) {
  const [isVisible, setIsVisible] = useState(false);
  const triggerCountRef = useRef(0);
  const prevActiveRef = useRef(false);

  // Track when isActive transitions from false to true
  if (isActive && !prevActiveRef.current) {
    triggerCountRef.current += 1;
  }
  prevActiveRef.current = isActive;

  // Generate particles only when triggered
  // Intentionally including triggerCountRef.current to force particle regeneration
  // on each new trigger (false -> true transition), which is why we disable the
  // exhaustive-deps rule here - the ref value IS a meaningful dependency
  const particles = useMemo(() => {
    if (!isActive) return [];
    void triggerCountRef.current;
    return generateParticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, triggerCountRef.current]);

  // Handle visibility and cleanup timer
  useEffect(() => {
    if (!isActive) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);

    // Clean up after animation completes
    const timeout = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, ANIMATION_DURATION_MS);

    return () => clearTimeout(timeout);
  }, [isActive, onComplete]);

  if (!isVisible || particles.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden="true"
      data-testid="confetti"
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={`absolute rounded-sm ${particle.color} animate-confetti`}
          style={{
            left: `${particle.left}%`,
            width: particle.size,
            height: particle.size,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
