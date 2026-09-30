// hooks/useRegions.js
// Loads the real Ethiopia region list from the backend and keeps it in state.
// Falls back to the local copy in utils/regions.js when the API is offline.

import { useState, useEffect } from 'react';
import { loadRegions, fallbackRegionList } from '../utils/regions';

export default function useRegions() {
  const [regions, setRegions] = useState(fallbackRegionList);

  useEffect(() => {
    let cancelled = false;
    loadRegions()
      .then(list => {
        if (!cancelled && list && list.length) setRegions(list);
      })
      .catch(() => {
        if (!cancelled) setRegions(fallbackRegionList());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return regions;
}
