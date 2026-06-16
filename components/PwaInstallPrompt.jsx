/**
 * PwaInstallPrompt — listens for `beforeinstallprompt` and shows a styled,
 * mobile-friendly banner inviting the user to install the quizMDA app.
 * Hebrew: באנר התקנת אפליקציה (PWA).
 */
import React, { useEffect, useState } from 'react';

const DISMISS_KEY = 'pwa_install_dismissed';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed (standalone) → never show.
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (standalone) return;

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch (_) {
      /* ignore */
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!dismissed) setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch (_) {
        /* ignore */
      }
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch (_) {
      /* ignore */
    }
    setDeferredPrompt(null);
    setVisible(false);
  };

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch (_) {
      /* ignore */
    }
  };

  if (!visible) return null;

  return (
    <div role="dialog" aria-label="התקנת אפליקציה" dir="rtl" style={styles.banner}>
      <div style={styles.icon} aria-hidden="true">📲</div>
      <div style={styles.texts}>
        <div style={styles.title}>התקן את אפליקציית quizMDA</div>
        <div style={styles.sub}>גישה מהירה, עבודה גם ללא רשת והתראות חכמות.</div>
      </div>
      <div style={styles.actions}>
        <button type="button" className="btn btn-primary btn-sm" onClick={install}>התקנה</button>
        <button type="button" onClick={dismiss} style={styles.close} aria-label="סגור">✕</button>
      </div>
    </div>
  );
}

const styles = {
  banner: {
    position: 'fixed',
    insetInlineStart: '50%',
    transform: 'translateX(50%)',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--bottomnav-height, 64px) + 12px)',
    zIndex: 3500,
    width: 'min(560px, 92vw)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-3) var(--space-4)',
    background: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    direction: 'rtl',
  },
  icon: { fontSize: 28, flexShrink: 0 },
  texts: { flex: 1, minWidth: 0 },
  title: { fontWeight: 800, color: 'var(--color-text)', fontSize: 'var(--font-size-base)' },
  sub: { color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' },
  actions: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 },
  close: {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)',
    fontSize: 18, lineHeight: 1, padding: 4,
  },
};
