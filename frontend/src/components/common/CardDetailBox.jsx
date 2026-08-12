// components/common/CardDetailBox.jsx
// Attractive detail box opened when a KPI / stat card is clicked.
// `card` = { label, icon, color, value, render } where render() returns JSX.

import React from 'react';

function CardDetailBox({ card, onClose }) {
  if (!card) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(3px)',
      WebkitBackdropFilter: 'blur(3px)',
      zIndex: 1100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      animation: 'fieldsyncFadeIn 0.18s ease'
    }} onClick={onClose}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '640px',
        maxHeight: '82vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 70px rgba(0,0,0,0.4)'
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header with big value */}
        <div style={{
          padding: '22px 24px',
          background: `linear-gradient(135deg, ${card.color}, ${card.color}99 60%, ${card.color}55)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            background: 'rgba(255,255,255,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '26px',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            {card.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', opacity: 0.85, fontWeight: '500' }}>{card.label}</div>
            <div style={{ fontSize: '34px', fontWeight: '800', lineHeight: 1.1, marginTop: '2px' }}>{card.value}</div>
          </div>
          <button
            onClick={onClose}
            title="Close"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              border: 'none',
              color: 'white',
              fontSize: '16px',
              cursor: 'pointer',
              lineHeight: 1,
              flexShrink: 0
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{
          padding: '18px 20px 20px',
          overflowY: 'auto',
          color: '#1a202c',
          fontSize: '13px'
        }}>
          {card.render()}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
          background: '#f8fafc'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 26px',
              borderRadius: '99px',
              border: 'none',
              background: `linear-gradient(135deg, ${card.color}, ${card.color}cc)`,
              color: 'white',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >Close</button>
        </div>
      </div>

      <style>{`
        @keyframes fieldsyncFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default CardDetailBox;
