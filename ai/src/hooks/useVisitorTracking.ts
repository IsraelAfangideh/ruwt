import { useEffect } from 'react';
import { trackVisit } from '@/lib/marketing/tracking';

export function useVisitorTracking(path: string) {
  useEffect(() => {
    void trackVisit(path);
  }, [path]);
}
