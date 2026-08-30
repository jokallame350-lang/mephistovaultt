import { useEffect, useCallback, useRef } from 'react';
import { clearKeyCache } from '../lib/encryption';

interface UsePanicKeyProps {
  onPanic?: () => void;
}

export function usePanicKey({ onPanic }: UsePanicKeyProps = {}) {
  const escCountRef = useRef(0);
  const escTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerPanic = useCallback(() => {
    try {
      // 1. Wipe all sensitive crypto caches
      clearKeyCache();

      // 2. Clear session/local state
      try {
        sessionStorage.clear();
      } catch {
        // ignore
      }

      // 3. Clear PWA share cache
      if ('caches' in window) {
        caches.delete('mephistovault-shares').catch(() => {});
      }

      // 4. Custom app panic hook
      if (onPanic) {
        onPanic();
      }

      // 5. Anti-forensic redirect: immediately replace history with an innocent search page
      window.location.replace('https://www.google.com');
    } catch {
      window.location.href = 'https://www.google.com';
    }
  }, [onPanic]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shortcut 1: Alt + P or Ctrl + Alt + X
      if ((e.altKey && (e.key === 'p' || e.key === 'P')) || (e.ctrlKey && e.altKey && (e.key === 'x' || e.key === 'X'))) {
        e.preventDefault();
        triggerPanic();
        return;
      }

      // Shortcut 2: Triple Escape within 1.2 seconds
      if (e.key === 'Escape') {
        escCountRef.current += 1;

        if (escTimerRef.current) {
          clearTimeout(escTimerRef.current);
        }

        if (escCountRef.current >= 3) {
          escCountRef.current = 0;
          e.preventDefault();
          triggerPanic();
          return;
        }

        escTimerRef.current = setTimeout(() => {
          escCountRef.current = 0;
        }, 1200);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (escTimerRef.current) clearTimeout(escTimerRef.current);
    };
  }, [triggerPanic]);

  return { triggerPanic };
}

export default usePanicKey;
