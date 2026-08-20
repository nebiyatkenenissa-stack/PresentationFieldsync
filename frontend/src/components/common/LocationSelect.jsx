// components/common/LocationSelect.jsx
// Controlled cascading location dropdown: country -> region -> zone -> woreda -> kebele -> community
// - country:   GET /api/locations/level/country
// - community: GET /api/locations/communities?kebele_id=...
// - others:    GET /api/locations/children/:parentId

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiBase } from '../../services/database';

const fetchJSON = async (url, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

const resolveSelected = (selectedValue) => {
  if (selectedValue && typeof selectedValue === 'object') {
    return { id: selectedValue.id, name: selectedValue.name || null };
  }
  return { id: selectedValue || null, name: null };
};

function LocationSelect({ level, parentId, selectedValue, onSelect, disabled, required, label, onLoaded }) {
  const { t } = useTranslation();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const selected = resolveSelected(selectedValue);
  const effectiveDisabled = disabled || loading;

  const displayLabel = label || t(`location.${level}`, { defaultValue: level.charAt(0).toUpperCase() + level.slice(1) });
  const placeholder = t('location.select', { level: displayLabel });
  const loadingText = t('location.loading', { level: displayLabel });
  const errorText = t('location.error', { level: displayLabel });

  const API_BASE_URL = getApiBase();

  const buildUrl = useCallback(() => {
    if (level === 'country') {
      return `${API_BASE_URL}/locations/level/country`;
    }
    if (!parentId) return null;
    if (level === 'community') {
      return `${API_BASE_URL}/locations/communities?kebele_id=${parentId}`;
    }
    return `${API_BASE_URL}/locations/children/${parentId}`;
  }, [API_BASE_URL, level, parentId]);

  useEffect(() => {
    const url = buildUrl();

    if (!url) {
      setOptions([]);
      setError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchJSON(url)
      .then((data) => {
        if (!cancelled) {
          const list = Array.isArray(data) ? data : [];
          setOptions(list);
          if (onLoaded) onLoaded(level, list);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOptions([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [buildUrl]);

  const selectStyle = {
    padding: '8px 12px',
    border: '1px solid var(--fs-border, #d1d5db)',
    borderRadius: '6px',
    fontSize: '14px',
    background: effectiveDisabled ? 'var(--fs-surface-2, #f3f4f6)' : 'var(--fs-input-bg, white)',
    color: 'var(--fs-ink, #14213d)'
  };

  const handleSelectChange = (e) => {
    const value = e.target.value;
    const id = value ? Number(value) : null;
    const opt = options.find((o) => Number(o.id) === id);
    onSelect(level, id, id ? (opt?.name || null) : null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--fs-ink, #374151)' }}>
        {displayLabel} {required ? '*' : ''}
      </label>
      <select
        value={selected.id || ''}
        onChange={handleSelectChange}
        disabled={effectiveDisabled}
        style={selectStyle}
      >
        <option value="">
          {loading ? loadingText : placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.name}
          </option>
        ))}
        {!loading && error && (
          <option value="" disabled>
            {errorText}
          </option>
        )}
      </select>
    </div>
  );
}

export default LocationSelect;
