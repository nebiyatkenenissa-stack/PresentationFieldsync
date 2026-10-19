// components/common/UserAvatar.jsx
// Renders a circular profile photo when available, otherwise the bundled
// default avatar. Reused across users, reports, alerts & citizens.

import React, { useEffect, useState } from 'react';
import { DEFAULT_AVATAR_URL, getProfilePhotoUrl } from '../../utils/helpers';

function UserAvatar({ user, photo, name, size = 36 }) {
  // Prefer the explicit photo prop, then camelCase profilePhoto, then the raw
  // server field profile_photo (some components feed un-normalised server rows).
  const photoPath = photo || (user && (user.profilePhoto || user.profile_photo)) || null;
  const cachedPhoto = user && user.profilePhotoCache ? user.profilePhotoCache : null;
  const label = name || (user && user.name) || '';

  // Ordered chain of sources to try. The server path comes first, then the
  // cached base64 kept for when uploads do not survive a cold start, then the
  // bundled default avatar. Every step is guarded by `failedSrc` so a broken
  // image can never be left on screen: a URL that 404s advances to the next
  // candidate, and the default avatar is the guaranteed terminal state.
  const sources = [
    getProfilePhotoUrl(photoPath),
    cachedPhoto,
    DEFAULT_AVATAR_URL
  ].filter(Boolean);

  const [failedSrc, setFailedSrc] = useState(null);
  const src = sources.find(s => s !== failedSrc) || DEFAULT_AVATAR_URL;

  // A recycled row can point at a different user, so reset the failure latch
  // whenever the candidate chain changes.
  useEffect(() => {
    setFailedSrc(null);
  }, [photoPath, cachedPhoto]);

  return (
    <span
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        overflow: 'hidden',
        background: '#e8edf5',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        userSelect: 'none'
      }}
    >
      <img
        src={src}
        alt={label}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={() => setFailedSrc(src)}
      />
    </span>
  );
}

export default UserAvatar;
