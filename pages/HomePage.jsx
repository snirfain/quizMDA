/**
 * Home Page / Landing Page — Google sign-in only
 * Hebrew: מסך בית - נחיתה ראשית
 */

import React, { useState, useEffect } from 'react';
import { setCurrentUser, getCurrentUser } from '../utils/auth';
import { navigateTo } from '../utils/router';
import GoogleSignIn from '../components/GoogleSignIn';

const FEATURES = [
  { icon: '🎯', title: 'תרגול אדפטיבי', desc: 'המערכת לומדת מהטעויות שלך ומתאימה את רמת הקושי אוטומטית' },
  { icon: '📊', title: 'מעקב התקדמות', desc: 'גרפים וסטטיסטיקות שמראים בדיוק היכן אתה עומד' },
  { icon: '📋', title: 'תוכניות לימוד', desc: 'תוכניות מובנות שמובילות אותך שלב אחר שלב לשליטה מלאה' },
  { icon: '📝', title: 'בחינה מדומה', desc: 'תרגל בתנאי בחינה אמיתיים ובקרי ביצועים לאחר מכן' },
  { icon: '🏆', title: 'הישגים ודירוג', desc: 'צבור נקודות, פתח תגים ועלה בטבלת המובילים' },
  { icon: '🔖', title: 'סימניות והערות', desc: 'שמור שאלות חשובות לחזרה מהירה בכל זמן' },
];

const STATS = [
  { value: '500+', label: 'שאלות במאגר' },
  { value: '12+', label: 'נושאי לימוד' },
  { value: '3', label: 'רמות הרשאה' },
  { value: '100%', label: 'בעברית' },
];

function redirect(user) {
  const path = { trainee: '/practice', instructor: '/instructor', admin: '/manager' }[user.role] || '/practice';
  navigateTo(path);
}

export default function HomePage() {
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);

  useEffect(() => {
    checkExistingSession();
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const checkExistingSession = async () => {
    const user = await getCurrentUser();
    if (user) redirect(user);
  };

  const handleGoogleSuccess = (user) => {
    setCurrentUser(user);
    window.dispatchEvent(new CustomEvent('userUpdated', { detail: user }));
    redirect(user);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      minHeight: 'calc(100vh - 64px)',
      direction: 'rtl',
    }}>

      {/* Hero panel */}
      <div style={{
        flex: isMobile ? 'none' : '1 1 60%',
        background: 'linear-gradient(145deg, #0a1628 0%, #1b2d55 50%, #1e3a7a 100%)',
        padding: isMobile ? '36px 24px 40px' : '56px 52px',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '28px' : '40px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '350px', height: '350px', borderRadius: '50%', background: 'rgba(100,181,246,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-80px', right: '30%', width: '260px', height: '260px', borderRadius: '50%', background: 'rgba(229,57,53,0.08)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '64px', height: '64px', background: 'linear-gradient(135deg, #e53935, #b71c1c)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', boxShadow: '0 6px 24px rgba(229,57,53,0.45)', flexShrink: 0 }}>✡</div>
          <div>
            <div style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '1px', lineHeight: '1' }}>מד"א</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginTop: '4px', letterSpacing: '0.5px' }}>Magen David Adom</div>
          </div>
        </div>

        <div>
          <h1 style={{ fontSize: isMobile ? '26px' : '40px', fontWeight: '800', lineHeight: '1.25', marginBottom: '16px', color: 'white' }}>
            מערכת למידה ותרגול<br />
            <span style={{ color: '#64b5f6' }}>חכמה ואדפטיבית</span>
          </h1>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.72)', lineHeight: '1.75', maxWidth: '480px', margin: 0 }}>
            פלטפורמה דיגיטלית מתקדמת שמלווה את אנשי מד"א לאורך כל תהליך ההכשרה —
            מתרגול יומיומי ועד בחינות סיום.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {STATS.map(stat => (
            <div key={stat.label} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '14px', padding: '14px 20px', minWidth: '85px', textAlign: 'center', backdropFilter: 'blur(4px)' }}>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#64b5f6' }}>{stat.value}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '14px', padding: '16px' }}>
                <div style={{ fontSize: '22px', flexShrink: 0, marginTop: '1px' }}>{f.icon}</div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '5px' }}>{f.title}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.58)', lineHeight: '1.55' }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isMobile && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '8px 14px', fontSize: '13px' }}>
                <span>{f.icon}</span>
                <span style={{ fontWeight: '600' }}>{f.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Login panel — Google only */}
      <div style={{ flex: isMobile ? 'none' : '0 0 400px', background: '#f4f6fb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '40px 20px 48px' : '40px 32px' }}>
        <div style={{ width: '100%', maxWidth: '360px', background: 'white', borderRadius: '24px', padding: isMobile ? '36px 28px' : '44px 40px', boxShadow: '0 8px 48px rgba(0,0,0,0.11)' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #1565c0, #42a5f5)', borderRadius: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 4px 16px rgba(33,150,243,0.35)', marginBottom: '16px' }}>🔐</div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#1a1a2e', margin: '0 0 6px' }}>התחברות למערכת</h2>
            <p style={{ fontSize: '14px', color: '#9e9e9e', margin: 0 }}>ברוכים הבאים 👋</p>
          </div>

          {error && (
            <div role="alert" style={{ padding: '12px 16px', background: '#ffebee', color: '#c62828', borderRadius: '10px', fontSize: '14px', textAlign: 'center', borderRight: '4px solid #e53935', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          <GoogleSignIn onSuccess={handleGoogleSuccess} onError={setError} />

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <a href="/help" style={{ color: '#78909c', textDecoration: 'none', fontSize: '13px' }} onMouseOver={e => { e.target.style.color = '#CC0000'; }} onMouseOut={e => { e.target.style.color = '#78909c'; }}>
              צריך עזרה? 💬
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
