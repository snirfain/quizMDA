/**
 * Course Setup — shown on first login before user can proceed.
 * User must enter their MDA course number.
 * Hebrew: הגדרת קורס — מופיע בהתחברות ראשונה
 */
import React, { useState } from 'react';
import { showToast } from './Toast';
import { setCurrentUser } from '../utils/auth';
import { ROLE_LABELS } from '../utils/permissions';

export default function CourseSetup({ user, onComplete }) {
  const [courseNumber, setCourseNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCourseInput = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length <= 7) setCourseNumber(raw);
  };

  const isValid = courseNumber.length >= 6 && courseNumber.length <= 7;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) {
      showToast('מספר קורס חייב להכיל 6-7 ספרות', 'error');
      return;
    }
    const val = courseNumber;
    setSaving(true);
    try {
      const res = await fetch('/api/users/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id, course_number: val }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה');
      const updatedUser = { ...user, course_number: val, setup_complete: true };
      setCurrentUser(updatedUser);
      showToast('מספר קורס נשמר בהצלחה', 'success');
      onComplete(updatedUser);
    } catch (err) {
      showToast('שגיאה בשמירה: ' + (err?.message || ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'חניך';

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)', direction: 'rtl',
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', padding: 'clamp(24px, 6vw, 48px) clamp(20px, 5vw, 40px)',
        maxWidth: '440px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center',
        boxSizing: 'border-box',
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #e53935, #b71c1c)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px', margin: '0 auto 20px', boxShadow: '0 6px 24px rgba(229,57,53,0.4)',
        }}>
          ✡
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1a237e', margin: '0 0 8px' }}>
          ברוך הבא, {user?.full_name || 'משתמש'}!
        </h1>
        <p style={{ fontSize: '14px', color: '#666', margin: '0 0 4px' }}>
          דרגה: <strong style={{ color: '#1565c0' }}>{roleLabel}</strong>
        </p>
        <p style={{ fontSize: '15px', color: '#555', margin: '16px 0 28px', lineHeight: 1.6 }}>
          לפני שמתחילים, יש להזין את מספר הקורס שלך במד"א
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: '#333', display: 'block', marginBottom: '6px' }}>
              מספר קורס
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={7}
              value={courseNumber}
              onChange={handleCourseInput}
              placeholder="הזן 6-7 ספרות"
              autoFocus
              style={{
                width: '100%', padding: '14px 16px', fontSize: '22px', fontWeight: 700,
                border: `2px solid ${courseNumber && !isValid ? '#e53935' : '#e0e0e0'}`,
                borderRadius: '12px', textAlign: 'center', letterSpacing: '3px',
                direction: 'ltr', fontFamily: 'inherit', boxSizing: 'border-box',
                outline: 'none', transition: 'border-color 0.2s',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#1565c0'; }}
              onBlur={(e) => { e.target.style.borderColor = courseNumber && !isValid ? '#e53935' : '#e0e0e0'; }}
            />
            {courseNumber && !isValid && (
              <p style={{ fontSize: '12px', color: '#e53935', margin: '4px 0 0', textAlign: 'right' }}>
                מספר קורס חייב להכיל 6-7 ספרות ({courseNumber.length} הוזנו)
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || !isValid}
            style={{
              padding: '14px', fontSize: '16px', fontWeight: 700,
              background: isValid ? 'linear-gradient(135deg, #e53935, #b71c1c)' : '#ccc',
              color: '#fff', border: 'none', borderRadius: '12px', cursor: saving ? 'wait' : 'pointer',
              fontFamily: 'inherit', transition: 'opacity 0.2s',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'שומר...' : 'המשך למערכת'}
          </button>
        </form>
      </div>
    </div>
  );
}
