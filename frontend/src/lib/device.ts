'use client';

const DEVICE_ID_KEY = 'mychats_device_id';
const DEVICE_LABEL_KEY = 'mychats_device_label';

/**
 * Returns or generates a persistent unique Device ID for this browser / client.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'server_session';
  }

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId || deviceId.trim() === '') {
    // Generate unique random device identity
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      deviceId = `dev_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    } else {
      deviceId = `dev_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
    }
    localStorage.setItem(DEVICE_ID_KEY, deviceId);

    // Also persist in cookie for SSR and cross-request fallback
    try {
      document.cookie = `${DEVICE_ID_KEY}=${deviceId}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // ignore
    }
  }

  return deviceId;
}

/**
 * Returns or automatically detects a friendly device label based on the user agent.
 */
export function getDeviceLabel(): string {
  if (typeof window === 'undefined') {
    return 'Default Device';
  }

  const storedLabel = localStorage.getItem(DEVICE_LABEL_KEY);
  if (storedLabel && storedLabel.trim()) {
    return storedLabel.trim();
  }

  // Automatic platform detection
  let platform = '💻 Device';
  try {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) {
      platform = '📱 iOS Device';
    } else if (/Android/i.test(ua)) {
      platform = '📱 Android Device';
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
      platform = '💻 Mac';
    } else if (/Windows NT/i.test(ua)) {
      platform = '💻 Windows PC';
    } else if (/Linux/i.test(ua)) {
      platform = '💻 Linux PC';
    }
  } catch {
    platform = '💻 Device';
  }

  const defaultLabel = `${platform} (${getOrCreateDeviceId().slice(-4)})`;
  localStorage.setItem(DEVICE_LABEL_KEY, defaultLabel);
  return defaultLabel;
}

/**
 * Allows the user to update their local device label.
 */
export function setDeviceLabel(newLabel: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = newLabel.trim();
  if (trimmed) {
    localStorage.setItem(DEVICE_LABEL_KEY, trimmed);
    window.dispatchEvent(new CustomEvent('mychats:device-changed', { detail: { label: trimmed } }));
  }
}
