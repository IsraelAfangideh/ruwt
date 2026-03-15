import { useState, useEffect, useRef } from 'react';

const BREAKPOINT = 768;
const DEBOUNCE_MS = 150;

export function useWindowWidth() {
  /* istanbul ignore next -- @preserve */
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const h = () => {
      /* istanbul ignore next -- @preserve */
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setW(window.innerWidth), DEBOUNCE_MS);
    };
    window.addEventListener('resize', h);
    return () => {
      window.removeEventListener('resize', h);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
  return w;
}

export function useIsDesktop() {
  return useWindowWidth() >= BREAKPOINT;
}
