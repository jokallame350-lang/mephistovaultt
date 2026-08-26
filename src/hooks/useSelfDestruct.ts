import { useState, useEffect, useRef } from 'react';
import { SELF_DESTRUCT_SEC } from '../lib/constants';

export function useSelfDestruct(
  transferProgress: number,
  isConnected: boolean,
  onDestruct: () => void,
) {
  const [selfDestructSec, setSelfDestructSec] = useState(0);
  const selfDestructRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDestructRef = useRef(onDestruct);

  useEffect(() => {
    onDestructRef.current = onDestruct;
  }, [onDestruct]);

  useEffect(() => {
    if (transferProgress >= 100 && isConnected) {
      const initTimer = setTimeout(() => {
        setSelfDestructSec(SELF_DESTRUCT_SEC);
      }, 0);

      const interval = setInterval(() => {
        setSelfDestructSec((prev) => {
          if (prev <= 1) {
            if (selfDestructRef.current) {
              clearInterval(selfDestructRef.current);
              selfDestructRef.current = null;
            }
            onDestructRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      selfDestructRef.current = interval;

      return () => {
        clearTimeout(initTimer);
        if (selfDestructRef.current) {
          clearInterval(selfDestructRef.current);
          selfDestructRef.current = null;
        }
      };
    } else {
      const resetTimer = setTimeout(() => {
        setSelfDestructSec(0);
      }, 0);
      if (selfDestructRef.current) {
        clearInterval(selfDestructRef.current);
        selfDestructRef.current = null;
      }
      return () => clearTimeout(resetTimer);
    }
  }, [transferProgress, isConnected]);

  return selfDestructSec;
}
