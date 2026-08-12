// components/common/LocationCascade.jsx
// Reusable cascading location selector: country -> region -> zone -> woreda -> kebele -> community
// Calls onChange({ country, region, zone, woreda, kebele, community }) where each value is
// { id, name } or null. Pre-seed with `initial` (e.g. from the user's assigned location).

import React, { useState, useEffect } from 'react';
import LocationSelect from './LocationSelect';

const LEVELS = ['country', 'region', 'zone', 'woreda', 'kebele', 'community'];

const OTHER = 'OTHER';

const normalize = (value) => {
  if (!value) return null;
  if (typeof value === 'number' || typeof value === 'string') {
    if (value === OTHER) return { id: OTHER, name: null };
    return { id: Number(value), name: null };
  }
  const id = value.id === OTHER ? OTHER : Number(value.id);
  return { id, name: value.name || null };
};

const initialKeyFor = (initial) =>
  LEVELS.map((l) => (initial[l] ? (initial[l].id ?? initial[l]) : '')).join('-');

function LocationCascade({ initial = {}, onChange, disabled, requiredLevels = ['region'], labels = {}, style, lockLevels = [] }) {
  const [ids, setIds] = useState(() => {
    const out = {};
    LEVELS.forEach((l) => { const v = normalize(initial[l]); if (v) out[l] = v; });
    return out;
  });

  const initialKey = initialKeyFor(initial);

  // Re-seed only when the selected ids change (not on object identity), so the
  // parent's onChange -> setState round-trip does not cause an infinite loop.
  useEffect(() => {
    const out = {};
    LEVELS.forEach((l) => { const v = normalize(initial[l]); if (v) out[l] = v; });
    setIds(out);
  }, [initialKey]);

  // Resolve names for pre-selected ids once their option lists arrive.
  const handleLoaded = (level, opts) => {
    setIds((prev) => {
      const sel = prev[level];
      if (!sel || !sel.id || sel.name) return prev;
      const found = opts.find((o) => Number(o.id) === sel.id);
      if (!found) return prev;
      return { ...prev, [level]: { id: sel.id, name: found.name } };
    });
  };

  const handleSelect = (level, id, name) => {
    const next = { ...ids };
    if (id) {
      next[level] = { id, name };
    } else {
      next[level] = null;
    }
    const idx = LEVELS.indexOf(level);
    for (let i = idx + 1; i < LEVELS.length; i++) next[LEVELS[i]] = null;
    setIds(next);
  };

  // Report the full selection (including resolved names) to the parent.
  useEffect(() => {
    onChange({
      country: ids.country,
      region: ids.region,
      zone: ids.zone,
      woreda: ids.woreda,
      kebele: ids.kebele,
      community: ids.community
    });
  }, [ids]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', ...style }}>
      {LEVELS.map((level, idx) => {
        const parentId = idx === 0 ? null : (ids[LEVELS[idx - 1]]?.id || null);
        const sel = ids[level]?.id || null;
        const isRequired = requiredLevels.includes(level);
        const isLocked = lockLevels.includes(level);
        return (
          <LocationSelect
            key={level}
            level={level}
            parentId={parentId}
            selectedValue={sel}
            onSelect={handleSelect}
            onLoaded={handleLoaded}
            disabled={disabled || isLocked || (idx > 0 && !parentId)}
            required={isRequired}
            label={labels[level]}
          />
        );
      })}
    </div>
  );
}

export default LocationCascade;
