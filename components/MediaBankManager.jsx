/**
 * Media Bank Manager
 *
 * Admin/Instructor page for managing the media bank:
 *   • Browse & create tags
 *   • Upload image/video/audio items per tag
 *   • View per-item stats (attempts, success rate, difficulty)
 *   • Suspend, restore, or delete items
 *
 * Hebrew: ניהול מאגר המדיה
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { entities } from '../config/appConfig';
import { showToast } from './Toast';
import LoadingSpinner from './LoadingSpinner';
import {
  getMediaDifficultyDisplay,
  getMediaStatusDisplay,
  getMediaTypeLabel,
  MEDIA_MIN_ATTEMPTS,
  MEDIA_STATUS_ACTIVE,
  MEDIA_STATUS_SUSPENDED,
  MEDIA_STATUS_PENDING,
} from '../workflows/mediaEngine';

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export default function MediaBankManager() {
  const [tags, setTags]             = useState([]);   // all distinct tags
  const [selectedTag, setSelectedTag] = useState(null);
  const [items, setItems]           = useState([]);
  const [isLoading, setLoading]     = useState(false);
  const [isUploading, setUploading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTag, setNewTag]         = useState('');

  // New item form state
  const [draft, setDraft] = useState({
    name: '', tag: '', media_type: 'image', url: '', description: ''
  });
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // ── Load tags ────────────────────────────────────────────
  const loadTags = async () => {
    const allTags = await entities.Media_Bank.distinctTags();
    setTags(allTags);
  };

  useEffect(() => { loadTags(); }, []);

  // ── Load items for selected tag ──────────────────────────
  const loadItems = useCallback(async (tag, status = 'all') => {
    setLoading(true);
    try {
      const query = { tag };
      if (status !== 'all') query.status = status;
      const result = await entities.Media_Bank.find(query, { sort: { createdAt: 1 } });
      setItems(result);
    } catch (e) {
      showToast('שגיאה בטעינת פריטים', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTag) loadItems(selectedTag, filterStatus);
  }, [selectedTag, filterStatus, loadItems]);

  // ── File pick → create object URL ──────────────────────
  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video') ? 'video'
               : file.type.startsWith('audio') ? 'audio'
               : 'image';
    setPreviewUrl(url);
    setDraft(d => ({ ...d, url, media_type: type, name: d.name || file.name }));
  };

  // ── Save new item ────────────────────────────────────────
  const handleAddItem = async () => {
    const tag = (draft.tag || selectedTag || '').trim();
    if (!tag)          { showToast('חובה להזין תג', 'error'); return; }
    if (!draft.url)    { showToast('חובה להעלות קובץ', 'error'); return; }
    if (!draft.name.trim()) { showToast('חובה להזין שם לפריט', 'error'); return; }

    setUploading(true);
    try {
      await entities.Media_Bank.create({ ...draft, tag });
      showToast(`פריט "${draft.name}" נוסף בהצלחה`, 'success');
      setDraft({ name: '', tag: selectedTag || '', media_type: 'image', url: '', description: '' });
      setPreviewUrl('');
      setShowAddForm(false);
      await loadTags();
      if (tag === selectedTag || !selectedTag) {
        setSelectedTag(tag);
        await loadItems(tag, filterStatus);
      }
    } catch (e) {
      showToast('שגיאה בהוספת פריט', 'error');
    } finally {
      setUploading(false);
    }
  };

  // ── Status actions ───────────────────────────────────────
  const handleAction = async (item, action) => {
    let update = {};
    if (action === 'suspend') {
      update = { status: MEDIA_STATUS_SUSPENDED, suspended_reason: 'הושעה ידנית', suspended_at: new Date().toISOString() };
    } else if (action === 'restore') {
      update = { status: MEDIA_STATUS_ACTIVE, suspended_reason: null, suspended_at: null };
    } else if (action === 'pending') {
      update = { status: MEDIA_STATUS_PENDING };
    } else if (action === 'delete') {
      if (!window.confirm(`מחק את "${item.name}"?`)) return;
      await entities.Media_Bank.delete(item.id);
      showToast('פריט נמחק', 'success');
      await loadItems(selectedTag, filterStatus);
      await loadTags();
      return;
    }
    await entities.Media_Bank.update(item.id, update);
    showToast('עודכן', 'success');
    await loadItems(selectedTag, filterStatus);
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div style={s.container}>
      <h2 style={s.pageTitle}>🗃️ מאגר המדיה</h2>
      <p style={s.subtitle}>
        העלה תמונות, וידאו ואודיו מסווגים לפי תג. שאלות יכולות לשלוף פריט אקראי מתג בכל הצגה.
        כל פריט נמדד בנפרד — פריטים עם ביצועים נמוכים מושעים אוטומטית.
      </p>

      <div style={s.layout}>
        {/* ── Left column: tag list ── */}
        <aside style={s.sidebar}>
          <div style={s.sidebarHeader}>
            <span style={{ fontWeight: 700, fontSize: '15px' }}>תגים</span>
            <button style={s.addTagBtn} onClick={() => { setShowAddForm(true); setDraft(d => ({ ...d, tag: '' })); }}>
              + הוסף
            </button>
          </div>
          {tags.length === 0 && (
            <p style={{ fontSize: '13px', color: '#999', padding: '12px 16px' }}>אין תגים עדיין</p>
          )}
          {tags.map(tag => (
            <button
              key={tag}
              style={{ ...s.tagBtn, ...(selectedTag === tag ? s.tagBtnActive : {}) }}
              onClick={() => { setSelectedTag(tag); setDraft(d => ({ ...d, tag })); }}
            >
              {tag}
            </button>
          ))}

          {/* Quick new tag input */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid #eee', marginTop: '8px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="תג חדש…"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                style={{ ...s.input, flex: 1, fontSize: '13px' }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newTag.trim()) {
                    const t = newTag.trim();
                    setNewTag('');
                    setSelectedTag(t);
                    setDraft(d => ({ ...d, tag: t }));
                    setShowAddForm(true);
                  }
                }}
              />
              <button
                style={{ ...s.btn, padding: '6px 10px', fontSize: '13px' }}
                onClick={() => {
                  if (!newTag.trim()) return;
                  const t = newTag.trim();
                  setNewTag('');
                  setSelectedTag(t);
                  setDraft(d => ({ ...d, tag: t }));
                  setShowAddForm(true);
                }}
              >צור</button>
            </div>
          </div>
        </aside>

        {/* ── Main area ── */}
        <main style={s.main}>
          {!selectedTag && (
            <div style={s.emptyState}>
              <p>בחר תג משמאל או צור תג חדש כדי להתחיל</p>
            </div>
          )}

          {selectedTag && (
            <>
              <div style={s.mainHeader}>
                <h3 style={{ margin: 0, fontSize: '18px' }}>{selectedTag}</h3>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Status filter */}
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    style={{ ...s.input, fontSize: '13px', padding: '6px 10px' }}
                  >
                    <option value="all">כל הסטטוסים</option>
                    <option value="active">פעיל</option>
                    <option value="suspended">מושעה</option>
                    <option value="pending_review">ממתין לבדיקה</option>
                  </select>
                  <button style={s.btn} onClick={() => { setShowAddForm(v => !v); setDraft(d => ({ ...d, tag: selectedTag })); }}>
                    {showAddForm ? '✕ סגור' : '+ הוסף פריט'}
                  </button>
                </div>
              </div>

              {/* ── Add item form ── */}
              {showAddForm && (
                <div style={s.addForm}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '15px' }}>הוסף פריט חדש</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={s.formRow}>
                      <label style={s.formLabel}>שם הפריט *</label>
                      <input
                        type="text"
                        value={draft.name}
                        onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                        placeholder='לדוגמא: PSVT פס קצב #3'
                        style={s.input}
                      />
                    </div>
                    <div style={s.formRow}>
                      <label style={s.formLabel}>תג *</label>
                      <input
                        type="text"
                        value={draft.tag || selectedTag}
                        onChange={e => setDraft(d => ({ ...d, tag: e.target.value }))}
                        style={{ ...s.input, direction: 'ltr', textAlign: 'left' }}
                      />
                    </div>
                    <div style={s.formRow}>
                      <label style={s.formLabel}>סוג מדיה</label>
                      <select
                        value={draft.media_type}
                        onChange={e => setDraft(d => ({ ...d, media_type: e.target.value }))}
                        style={s.input}
                      >
                        <option value="image">🖼️ תמונה</option>
                        <option value="video">🎥 וידאו</option>
                        <option value="audio">🔊 אודיו</option>
                      </select>
                    </div>
                    <div style={s.formRow}>
                      <label style={s.formLabel}>קובץ *</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={
                            draft.media_type === 'video' ? 'video/*'
                            : draft.media_type === 'audio' ? 'audio/*'
                            : 'image/*'
                          }
                          onChange={handleFilePick}
                          style={{ fontSize: '13px' }}
                        />
                        {previewUrl && draft.media_type === 'image' && (
                          <img src={previewUrl} alt="תצוגה מקדימה" style={{ maxHeight: '160px', borderRadius: '8px', objectFit: 'contain', background: '#f0f0f0' }} />
                        )}
                        {previewUrl && draft.media_type === 'video' && (
                          <video src={previewUrl} controls style={{ maxHeight: '160px', borderRadius: '8px' }} />
                        )}
                        {previewUrl && draft.media_type === 'audio' && (
                          <audio src={previewUrl} controls style={{ width: '100%' }} />
                        )}
                        {/* Alternatively, enter a URL directly */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#999' }}>או הזן URL:</span>
                          <input
                            type="url"
                            placeholder="https://..."
                            value={draft.url?.startsWith('blob:') ? '' : draft.url}
                            onChange={e => { setDraft(d => ({ ...d, url: e.target.value })); setPreviewUrl(e.target.value); }}
                            style={{ ...s.input, flex: 1, fontSize: '12px', direction: 'ltr', textAlign: 'left' }}
                          />
                        </div>
                      </div>
                    </div>
                    <div style={s.formRow}>
                      <label style={s.formLabel}>תיאור (אופציונלי)</label>
                      <input
                        type="text"
                        value={draft.description}
                        onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                        placeholder='לדוגמא: PSVT עם QRS צר וקצב 180 לדקה'
                        style={s.input}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button style={s.btn} onClick={handleAddItem} disabled={isUploading}>
                        {isUploading ? <><LoadingSpinner size="sm" /> מוסיף...</> : '💾 שמור פריט'}
                      </button>
                      <button style={s.btnGhost} onClick={() => setShowAddForm(false)}>ביטול</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Item grid ── */}
              {isLoading && <div style={{ textAlign: 'center', padding: '40px' }}><LoadingSpinner size="md" /></div>}

              {!isLoading && items.length === 0 && (
                <div style={s.emptyState}>
                  <p>אין פריטים בתג "{selectedTag}"</p>
                  <button style={s.btn} onClick={() => setShowAddForm(true)}>+ הוסף פריט ראשון</button>
                </div>
              )}

              {!isLoading && items.length > 0 && (
                <div style={s.grid}>
                  {items.map(item => (
                    <MediaItemCard
                      key={item.id}
                      item={item}
                      onAction={handleAction}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Media Item Card
// ─────────────────────────────────────────────────────────────

function MediaItemCard({ item, onAction }) {
  const statusD     = getMediaStatusDisplay(item.status);
  const diffD       = getMediaDifficultyDisplay(item.difficulty_level);
  const typeLabel   = getMediaTypeLabel(item.media_type);
  const successRate = item.success_rate != null ? `${item.success_rate}%` : '—';
  const rated       = (item.total_attempts ?? 0) >= MEDIA_MIN_ATTEMPTS;
  const [imgError, setImgError] = useState(false);

  return (
    <div style={{
      ...s.card,
      borderColor: item.status === MEDIA_STATUS_SUSPENDED ? '#FFCDD2'
                 : item.status === MEDIA_STATUS_PENDING   ? '#FFE0B2'
                 : '#E0E0E0',
    }}>
      {/* Thumbnail */}
      <div style={s.thumb}>
        {item.media_type === 'video' && (
          <video src={item.url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} muted />
        )}
        {item.media_type === 'audio' && (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E3F2FD', borderRadius: '6px' }}>
            <span style={{ fontSize: '32px' }}>🔊</span>
          </div>
        )}
        {item.media_type === 'image' && !imgError && (
          <img
            src={item.url}
            alt={item.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }}
            onError={() => setImgError(true)}
          />
        )}
        {item.media_type === 'image' && imgError && (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: '6px' }}>
            <span style={{ fontSize: '28px' }}>🖼️</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.3 }}>{item.name}</div>
        {item.description && (
          <div style={{ fontSize: '12px', color: '#777', lineHeight: 1.4 }}>{item.description}</div>
        )}

        {/* Badges row */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
          <span style={{ ...s.badge, color: statusD.color, background: statusD.bg }}>{statusD.label}</span>
          <span style={{ ...s.badge, color: '#555', background: '#f5f5f5' }}>{typeLabel}</span>
          {rated && (
            <span style={{ ...s.badge, color: diffD.color, background: diffD.bg, border: `1px solid ${diffD.border}` }}>
              {diffD.label}
            </span>
          )}
        </div>

        {/* Stats */}
        <div style={{ fontSize: '12px', color: '#888', display: 'flex', gap: '12px' }}>
          <span>ניסיונות: {item.total_attempts ?? 0}</span>
          <span>הצלחה: {successRate}</span>
          {!rated && (item.total_attempts ?? 0) > 0 && (
            <span style={{ color: '#aaa' }}>({MEDIA_MIN_ATTEMPTS - (item.total_attempts ?? 0)} נוספים לדירוג)</span>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
          {item.status === MEDIA_STATUS_ACTIVE && (
            <button style={s.actionBtn('orange')} onClick={() => onAction(item, 'suspend')}>השעה</button>
          )}
          {item.status === MEDIA_STATUS_SUSPENDED && (
            <button style={s.actionBtn('green')} onClick={() => onAction(item, 'restore')}>שחזר</button>
          )}
          {item.status === MEDIA_STATUS_SUSPENDED && (
            <button style={s.actionBtn('blue')} onClick={() => onAction(item, 'pending')}>לבדיקה</button>
          )}
          <button style={s.actionBtn('red')} onClick={() => onAction(item, 'delete')}>מחק</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const s = {
  container: {
    direction: 'rtl', padding: '24px', maxWidth: '1200px', margin: '0 auto',
    fontFamily: "'Heebo', 'Assistant', Arial, sans-serif",
  },
  pageTitle: { fontSize: '26px', fontWeight: 800, color: '#1a1a2e', marginBottom: '6px' },
  subtitle:  { fontSize: '14px', color: '#78909c', marginBottom: '24px', lineHeight: 1.6 },

  layout: { display: 'flex', gap: '24px', alignItems: 'flex-start' },

  sidebar: {
    width: '200px', flexShrink: 0, background: '#fff',
    border: '1px solid #e0e0e0', borderRadius: '12px',
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '12px 14px', background: '#f5f5f5',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: '1px solid #e0e0e0',
  },
  addTagBtn: {
    background: '#CC0000', color: '#fff', border: 'none', borderRadius: '8px',
    padding: '4px 10px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
  },
  tagBtn: {
    display: 'block', width: '100%', padding: '10px 16px', border: 'none',
    background: 'transparent', textAlign: 'right', cursor: 'pointer',
    fontSize: '14px', borderBottom: '1px solid #f0f0f0', fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  tagBtnActive: { background: '#FFF0F0', color: '#CC0000', fontWeight: 700 },

  main: { flex: 1, minWidth: 0 },
  mainHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '16px', flexWrap: 'wrap', gap: '10px',
  },

  addForm: {
    background: '#F9F9FF', border: '1.5px solid #e0e0e0',
    borderRadius: '12px', padding: '20px', marginBottom: '20px',
  },
  formRow: { display: 'flex', flexDirection: 'column', gap: '4px' },
  formLabel: { fontSize: '13px', fontWeight: 600, color: '#333' },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '16px',
  },
  card: {
    background: '#fff', border: '1.5px solid #E0E0E0',
    borderRadius: '12px', overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    display: 'flex', flexDirection: 'column',
  },
  thumb: {
    width: '100%', height: '140px',
    background: '#f0f0f0', overflow: 'hidden',
  },
  badge: {
    fontSize: '11px', fontWeight: 600, padding: '2px 8px',
    borderRadius: '10px', display: 'inline-block',
  },
  actionBtn: (color) => ({
    padding: '4px 10px', border: 'none', borderRadius: '6px',
    fontSize: '12px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
    background: color === 'red' ? '#FFEBEE' : color === 'green' ? '#E8F5E9' : color === 'orange' ? '#FFF3E0' : '#E3F2FD',
    color: color === 'red' ? '#C62828' : color === 'green' ? '#2E7D32' : color === 'orange' ? '#E65100' : '#1565C0',
  }),
  btn: {
    background: '#CC0000', color: '#fff', border: 'none', borderRadius: '8px',
    padding: '9px 18px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px',
  },
  btnGhost: {
    background: 'transparent', color: '#666', border: '1.5px solid #ccc',
    borderRadius: '8px', padding: '9px 18px', fontSize: '14px', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  input: {
    padding: '9px 12px', border: '1.5px solid #e0e0e0', borderRadius: '8px',
    fontSize: '14px', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
    background: '#fafafa',
  },
  emptyState: {
    textAlign: 'center', padding: '60px 20px', color: '#999', fontSize: '15px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
  },
};
