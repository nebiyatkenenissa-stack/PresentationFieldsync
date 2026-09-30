// components/common/GpsCapture.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { getCurrentGps } from '../../utils/gps';

const GpsCapture = ({ onCoords, autoCapture = true, compact = false }) => {
  const [state, setState] = useState('idle'); // idle | getting | ok | error
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState('');

  const capture = useCallback(async () => {
    setState('getting');
    setError('');
    const result = await getCurrentGps(compact ? 6000 : 10000);
    if (result.success) {
      setCoords(result);
      setState('ok');
    } else {
      setError(result.error);
      setState('error');
      setCoords(null);
    }
    if (onCoords) {
      onCoords(result.success ? result : null);
    }
  }, [onCoords, compact]);

  useEffect(() => {
    if (autoCapture) {
      capture();
    }
  }, []);

  const statusStyle = {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    border: '1px solid #d1d5db',
    background: '#f9fafb'
  };

  const buttonStyle = {
    padding: '3px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    border: '1px solid #d1d5db',
    background: '#ffffff',
    color: '#374151',
    cursor: 'pointer'
  };

  return (
    <div style={statusStyle}>
      {state === 'idle' && (
        <>
          <span>📍</span>
          <span style={{ color: '#6b7280' }}>GPS not started</span>
          <button type="button" style={buttonStyle} onClick={capture}>Capture</button>
        </>
      )}
      {state === 'getting' && (
        <>
          <span>📡</span>
          <span style={{ color: '#6b7280' }}>Getting GPS location…</span>
        </>
      )}
      {state === 'ok' && (
        <>
          <span>📍</span>
          <span style={{ color: '#065f37', fontWeight: '500' }}>
            GPS captured: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
            {coords.accuracy ? ` (±${coords.accuracy}m)` : ''}
          </span>
          {coords.networkEstimate ? (
            <span style={{ color: '#b91c1c', fontWeight: '600' }}>
              ⚠️ This is a network estimate, not a real GPS fix — the map location is probably WRONG. Move to an open
              area, ensure precise location is ON, and recapture.
            </span>
          ) : coords.lowAccuracy ? (
            <span style={{ color: '#b45309', fontWeight: '500' }}>
              ⚠️ Low accuracy fix (±{coords.accuracy}m) — map may not match your exact position. Recapture if possible.
            </span>
          ) : null}
          <a
            href={`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#2563eb',
              fontSize: '11px',
              fontWeight: '600',
              textDecoration: 'underline'
            }}
          >
            View on map
          </a>
          <button type="button" style={buttonStyle} onClick={capture}>Recapture</button>
        </>
      )}
      {state === 'error' && (
        <>
          <span>⚠️</span>
          <span style={{ color: '#dc2626' }}>{error}</span>
          <button type="button" style={buttonStyle} onClick={capture}>Retry</button>
        </>
      )}
    </div>
  );
};

export default GpsCapture;
