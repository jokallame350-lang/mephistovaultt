import React, { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  className?: string;
}

export const AnimatedCounter = React.memo(function AnimatedCounter({
  value,
  className,
}: AnimatedCounterProps) {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (node) {
      const rawText = node.textContent || '0';
      const startVal = parseFloat(rawText.replace(/[^0-9.]/g, '')) || 0;
      const controls = animate(startVal, value, {
        duration: 0.4,
        ease: 'easeOut',
        onUpdate(v) {
          node.textContent = Math.round(v).toString() + '%';
        },
      });
      return () => controls.stop();
    }
  }, [value]);

  return <span ref={nodeRef} className={className}>{value}%</span>;
});

export default AnimatedCounter;
