import React, { useEffect, useRef } from 'react';

interface AnimatedCounterProps {
  value: number;
  className?: string;
}

export const AnimatedCounter = React.memo(function AnimatedCounter({
  value,
  className,
}: AnimatedCounterProps) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const currentValRef = useRef<number>(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const targetVal = Math.round(value);
    const startVal = currentValRef.current;
    const diff = targetVal - startVal;

    // Fast-path: immediate update on small delta or boundary values to eliminate animation overhead
    if (Math.abs(diff) <= 1 || targetVal === 100 || targetVal === 0) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      currentValRef.current = targetVal;
      node.textContent = `${targetVal}%`;
      return;
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const startTime = performance.now();
    const duration = 200; // Fast 200ms lerp

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + diff * ease);
      currentValRef.current = current;
      if (node) {
        node.textContent = `${current}%`;
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        currentValRef.current = targetVal;
        if (node) {
          node.textContent = `${targetVal}%`;
        }
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return <span ref={nodeRef} className={className}>{value}%</span>;
});

export default AnimatedCounter;
