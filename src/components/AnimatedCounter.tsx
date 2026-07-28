import { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  className?: string;
}

export function AnimatedCounter({ value, className }: AnimatedCounterProps) {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (node) {
      const controls = animate(parseInt(node.textContent || '0'), value, {
        duration: 0.5,
        onUpdate(v) {
          node.textContent = Math.round(v).toString() + '%';
        },
      });
      return () => controls.stop();
    }
  }, [value]);

  return <span ref={nodeRef} className={className}>{value}%</span>;
}
export default AnimatedCounter;
