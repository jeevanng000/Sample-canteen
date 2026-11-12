import {
  buildOrderReadyPushPayload,
  type CanteenOrder,
} from './canteenLogic';

export type BrowserPushPermissionState =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

/**
 * Returns the current browser Notification API permission status.
 */
export function getBrowserPushPermission(): BrowserPushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const perm = window.Notification.permission;
  if (perm === 'granted' || perm === 'denied' || perm === 'default') {
    return perm;
  }
  return 'default';
}

/**
 * Requests browser push notification permission from the student.
 */
export async function requestBrowserPushPermission(): Promise<BrowserPushPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await window.Notification.requestPermission();
    if (result === 'granted' || result === 'denied' || result === 'default') {
      return result;
    }
    return getBrowserPushPermission();
  } catch {
    return getBrowserPushPermission();
  }
}

/**
 * Plays a pleasant 2-tone canteen counter bell chime using the Web Audio API
 * and triggers device vibration when an order transitions to 'ready'.
 */
export function triggerOrderReadyAlert(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([250, 120, 350]);
    }
  } catch {
    // Ignore vibration errors on unsupported desktop browsers
  }

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First bell note (E5 - 659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.45);

    // Second bell note (A5 - 880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.18);
    gain2.gain.setValueAtTime(0.3, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.85);
  } catch {
    // AudioContext blocked until user gesture; safe to ignore
  }
}

/**
 * Dispatches a real browser/ServiceWorker Push Notification and plays the counter bell
 * when a student's order status changes from 'preparing' to 'ready' for collection.
 */
export async function sendOrderReadyBrowserPushNotification(
  order: Pick<
    CanteenOrder,
    'id' | 'tokenNumber' | 'items' | 'orderType' | 'tableNumber' | 'slotTime'
  >
): Promise<boolean> {
  // Always chime & vibrate
  triggerOrderReadyAlert();

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (window.Notification.permission !== 'granted') {
    return false;
  }

  const payload = buildOrderReadyPushPayload(order);

  // 1. Prefer ServiceWorkerRegistration.showNotification for PWA & mobile background push support
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(payload.title, {
          body: payload.body,
          icon: payload.icon,
          badge: payload.badge,
          tag: payload.tag,
          requireInteraction: payload.requireInteraction,
          data: payload.data,
        });
        return true;
      }
    }
  } catch {
    // Fall back to standard window.Notification below
  }

  // 2. Fallback to standard Web Notification API
  try {
    const notification = new window.Notification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      requireInteraction: payload.requireInteraction,
      data: payload.data,
    });

    notification.onclick = () => {
      try {
        window.focus();
        window.location.hash = '#orders';
        notification.close();
      } catch {
        // ignore
      }
    };

    return true;
  } catch {
    return false;
  }
}
