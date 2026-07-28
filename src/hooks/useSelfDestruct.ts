import { useState, useEffect, useRef } from 'react';
import { SELF_DESTRUCT_SEC } from '../lib/constants';

export function useSelfDestruct(
  transferProgress: number,
  isConnected: boolean,
  onDestruct: () => void,
) {
  const [selfDestructSec, setSelfDestructSec] = useState(0);
  const selfDestructRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (transferProgress >= 100 && isConnected) {
      setSelfDestructSec(SELF_DESTRUCT_SEC);
      selfDestructRef.current = setInterval(() => {
        setSelfDestructSec((prev) => {
          if (prev <= 1) {
            if (selfDestructRef.current) {
              clearInterval(selfDestructRef.current);
              selfDestructRef.current = null;
            }
            onDestruct();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setSelfDestructSec(0);
      if (selfDestructRef.current) {
        clearInterval(selfDestructRef.current);
        selfDestructRef.current = null;
      }
    }

    return () => {
      if (selfDestructRef.current) {
        clearInterval(selfDestructRef.current);
        selfDestructRef.current = null;
      }
    };
  }, [transferProgress, isConnected, onDestruct]);

  return selfDestructSec;
}
