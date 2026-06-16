/**
 * Web Push client helpers — opt-in subscribe/unsubscribe using the existing
 * service worker. No external libraries.
 * Hebrew: עזרי צד-לקוח להתראות פוש (Opt-in בלבד).
 */

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Convert a base64url VAPID public key to the Uint8Array the API expects. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function getRegistration() {
  // Ensure the SW is registered before subscribing.
  if (navigator.serviceWorker.controller) return navigator.serviceWorker.ready;
  try {
    await navigator.serviceWorker.register('/serviceWorker.js');
  } catch (_) {
    /* may already be registered */
  }
  return navigator.serviceWorker.ready;
}

/**
 * Subscribe this browser to push and persist it server-side (opt-in).
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function subscribeToPush() {
  if (!isPushSupported()) return { ok: false, reason: 'הדפדפן אינו תומך בהתראות' };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'ההרשאה להתראות נדחתה' };

    const keyRes = await fetch('/api/notifications/vapid-public-key', { cache: 'no-store' });
    if (!keyRes.ok) return { ok: false, reason: 'התראות אינן מוגדרות בשרת' };
    const { publicKey } = await keyRes.json();
    if (!publicKey) return { ok: false, reason: 'מפתח התראות חסר' };

    const reg = await getRegistration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const res = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), opted_in: true }),
    });
    if (!res.ok) {
      const ed = await res.json().catch(() => ({}));
      return { ok: false, reason: ed.error || 'רישום ההתראות נכשל' };
    }
    return { ok: true };
  } catch (err) {
    console.error('subscribeToPush error:', err);
    return { ok: false, reason: err?.message || 'שגיאה ברישום ההתראות' };
  }
}

/** Unsubscribe this browser and remove it server-side. */
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return { ok: true };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => {});
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
    return { ok: true };
  } catch (err) {
    console.error('unsubscribeFromPush error:', err);
    return { ok: false, reason: err?.message };
  }
}
