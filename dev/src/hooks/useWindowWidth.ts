import { useState, useEffect } from 'react';

const BREAKPOINT = 768;

export function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

export function useIsDesktop() {
  return useWindowWidth() >= BREAKPOINT;
}
