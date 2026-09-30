// hooks/useIsMobile.js
// True when the viewport is at mobile widths (<= 768px). Re-renders on resize so
// inline-style layout (grids, padding, chart heights) can adapt on the fly.

import { useEffect, useState } from 'react';

const QUERY = '(max-width: 768px)';

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}