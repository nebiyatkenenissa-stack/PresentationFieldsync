// components/common/UserAvatar.jsx
// Renders a circular profile photo when available, otherwise a fallback
// with the user's initials. Reused across users, reports, alerts & citizens.

import React from 'react';
import { getProfilePhotoUrl } from '../../utils/helpers';

const ROLE_COLORS = {
  manager: '#dbeafe',
  supervisor: '#d1fae5',
  field_officer: '#fef3c7'
};

const ROLE_TEXT_COLORS = {
  manager: '#1e40af',
  supervisor: '#065f37',
  field_officer: '#92400e'
};

function UserAvatar({ user, photo, name, role, size = 36, showInitials = true }) {
  const photoPath = photo || (user && user.profilePhoto) || null;
  const photoUrl = getProfilePhotoUrl(photoPath);
  const label = name || (user && user.name) || '';
  const initials = (label.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('') || '?').toUpperCase();
  const userRole = role || (user && user.role) || '';
  const bg = ROLE_COLORS[userRole] || '#e8edf5';
  const color = ROLE_TEXT_COLORS[userRole] || '#334155';

  return (
    <span
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        overflow: 'hidden',
        background: bg,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${Math.max(10, Math.round(size * 0.4))}px`,
        fontWeight: '600',
        flexShrink: 0,
        userSelect: 'none'
      }}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={label}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : showInitials ? (
        initials
      ) : null}
    </span>
  );
}

export default UserAvatar;
