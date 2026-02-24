/**
 * Question Editor Component
 * Create/edit questions
 * Hebrew: עורך שאלות
 */

import React, { useState, useEffect } from 'react';
import { entities } from '../config/appConfig';
import Modal from './Modal';
import FormField from './FormField';
import QuestionVersionHistory from './QuestionVersionHistory';
import { showToast } from './Toast';
import { announce } from '../utils/accessibility';
import { validateQuestion } from '../utils/questionValidation';
import { getDifficultyDisplay, MIN_ATTEMPTS_FOR_RATING } from '../workflows/difficultyEngine';
import { getMediaTypeLabel, pickRandomMedia } from '../workflows/mediaEngine';

export default function QuestionEditor({ question, hierarchies, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    hierarchy_id:    question?.hierarchy_id    || '',
    question_type:   question?.question_type   || 'single_choice',
    question_text:   question?.question_text   || '',
    media_attachment: null,
    media_bank_tag:  question?.media_bank_tag  || '',
    difficulty_level: question?.difficulty_level || null,
    correct_answer:  question?.correct_answer  || '',
    explanation:     question?.explanation     || '',
    hint:            question?.hint            || '',
    tags:            question?.tags            || [],
    status:          question?.status          || 'active'
  });
  // 'none' | 'static' | 'bank'
  const [mediaMode, setMediaMode] = useState(() => {
    if (question?.media_bank_tag) return 'bank';
    if (question?.media_attachment) return 'static';
    return 'none';
  });
  const [mediaPreviewCount, setMediaPreviewCount] = useState(null);
  const [newTag, setNewTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMediaItem, setPreviewMediaItem] = useState(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [options, setOptions] = useState(() => {
    if (question?.options) {
      if (typeof question.options === 'string') {
        try {
          const parsed = JSON.parse(question.options);
          return parsed.map(opt => typeof opt === 'string' ? opt : (opt.text || opt.label || ''));
        } catch (e) {
          return ['', ''];
        }
      }
      return question.options.map(opt => typeof opt === 'string' ? opt : (opt.text || opt.label || ''));
    }
    // Import from AI stores options inside correct_answer JSON
    if (question?.correct_answer) {
      try {
        const ca = typeof question.correct_answer === 'string'
          ? JSON.parse(question.correct_answer)
          : question.correct_answer;
        if (ca && Array.isArray(ca.options) && ca.options.length > 0) {
          return ca.options.map(o => o.label ?? o.text ?? '');
        }
      } catch (_) {}
    }
    return ['', ''];
  });

  // Initialize correct_answer on mount (and from correct_answer JSON when no separate options)
  useEffect(() => {
    if (question?.correct_answer) {
      if (formData.question_type === 'multi_choice') {
        try {
          const parsed = typeof question.correct_answer === 'string'
            ? JSON.parse(question.correct_answer)
            : question.correct_answer;
          if (Array.isArray(parsed?.values)) {
            setFormData(prev => ({ ...prev, correct_answer: parsed.values.map(a => String(a)) }));
          } else if (Array.isArray(parsed)) {
            setFormData(prev => ({ ...prev, correct_answer: parsed.map(a => a.toString()) }));
          }
        } catch (e) {}
      } else if (formData.question_type !== 'open_ended') {
        try {
          const parsed = typeof question.correct_answer === 'string'
            ? JSON.parse(question.correct_answer)
            : question.correct_answer;
          if (parsed && (parsed.value !== undefined || parsed.value === null)) {
            setFormData(prev => ({ ...prev, correct_answer: String(parsed.value) }));
            return;
          }
        } catch (e) {}
        setFormData(prev => ({ ...prev, correct_answer: question.correct_answer.toString() }));
      } else {
        try {
          const parsed = typeof question.correct_answer === 'string'
            ? JSON.parse(question.correct_answer)
            : question.correct_answer;
          if (parsed && typeof parsed.value === 'string') {
            setFormData(prev => ({ ...prev, correct_answer: parsed.value }));
            return;
          }
        } catch (e) {}
        setFormData(prev => ({ ...prev, correct_answer: question.correct_answer.toString() }));
      }
    }
  }, []); // Only run on mount

  // Validate on change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateForm();
    }, 300);
    
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.question_text, formData.question_type, formData.correct_answer, formData.difficulty_level, formData.hierarchy_id, options]);

  // Fetch count of available media items for the chosen bank tag
  useEffect(() => {
    if (mediaMode !== 'bank' || !formData.media_bank_tag?.trim()) {
      setMediaPreviewCount(null);
      return;
    }
    let cancelled = false;
    entities.Media_Bank.find({ tag: formData.media_bank_tag.trim(), status: 'active' })
      .then(items => { if (!cancelled) setMediaPreviewCount(items.length); })
      .catch(() => { if (!cancelled) setMediaPreviewCount(null); });
    return () => { cancelled = true; };
  }, [mediaMode, formData.media_bank_tag]);

  // When preview is open and media is from bank, fetch one sample to show
  useEffect(() => {
    if (!showPreview || mediaMode !== 'bank' || !formData.media_bank_tag?.trim()) {
      setPreviewMediaItem(null);
      return;
    }
    let cancelled = false;
    pickRandomMedia(formData.media_bank_tag.trim()).then(item => {
      if (!cancelled && item) setPreviewMediaItem(item);
      else if (!cancelled) setPreviewMediaItem(null);
    }).catch(() => { if (!cancelled) setPreviewMediaItem(null); });
    return () => { cancelled = true; };
  }, [showPreview, mediaMode, formData.media_bank_tag]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleAddOption = () => {
    if (options.length >= 10) return;
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 2) return;
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    // Adjust correct_answer: if single, reindex; if multi, remove index and reindex
    if (formData.question_type === 'single_choice') {
      const was = formData.correct_answer;
      if (was === index.toString()) handleChange('correct_answer', '0');
      else if (parseInt(was, 10) > index) handleChange('correct_answer', String(parseInt(was, 10) - 1));
    } else if (Array.isArray(formData.correct_answer)) {
      const next = formData.correct_answer
        .filter(a => a !== index.toString())
        .map(a => { const n = parseInt(a, 10); return n > index ? String(n - 1) : a; });
      handleChange('correct_answer', next);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const validateForm = () => {
    const questionToValidate = {
      ...formData,
      options: formData.question_type !== 'open_ended' 
        ? options.map((opt, idx) => {
            const text = typeof opt === 'string' ? opt : opt.text || '';
            const isCorrect = formData.question_type === 'multi_choice'
              ? (Array.isArray(formData.correct_answer) && formData.correct_answer.includes(idx.toString()))
              : formData.correct_answer === idx.toString();
            return { text, isCorrect };
          })
        : undefined
    };

    const validation = validateQuestion(questionToValidate);
    setValidationErrors(validation.errors);
    return validation.isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate before submit
    if (!validateForm()) {
      showToast('יש לתקן שגיאות לפני שמירה', 'error');
      announce('יש שגיאות בטופס', 'assertive');
      return;
    }

    setIsSaving(true);

    try {
      // Prepare options for choice questions
      let preparedOptions = undefined;
      if (formData.question_type !== 'open_ended') {
        preparedOptions = options.map((opt, idx) => {
          const text = typeof opt === 'string' ? opt : opt.text || '';
          return {
            text: text,
            isCorrect: formData.question_type === 'multi_choice'
              ? (Array.isArray(formData.correct_answer) && formData.correct_answer.includes(idx.toString()))
              : formData.correct_answer === idx.toString()
          };
        });
      }

      const optionsForCorrect = preparedOptions
        ? preparedOptions.map((opt, idx) => ({
            value: String(idx),
            label: typeof opt.text === 'string' ? opt.text : opt.text?.text ?? ''
          }))
        : [];
      const correctAnswerPayload =
        formData.question_type === 'open_ended'
          ? formData.correct_answer
          : formData.question_type === 'multi_choice'
          ? JSON.stringify({
              values: (formData.correct_answer || []).map(String),
              options: optionsForCorrect
            })
          : JSON.stringify({
              value: String(formData.correct_answer ?? '0'),
              options: optionsForCorrect
            });

      // Sanitise media fields before saving
      // - When mediaMode is 'none', clear both media fields
      // - When mediaMode is 'static', keep attachment URL, clear tag
      // - When mediaMode is 'bank', keep tag, clear attachment
      let mediaFields = {};
      if (mediaMode === 'none') {
        mediaFields = { media_attachment: null, media_bank_tag: '' };
      } else if (mediaMode === 'static') {
        let att = formData.media_attachment;
        if (att?.url?.startsWith?.('blob:') && att.file) {
          // Upload to Cloudinary before saving (blob URLs don't persist)
          const formDataUpload = new FormData();
          formDataUpload.append('file', att.file);
          const uploadRes = await fetch('/api/upload-media', { method: 'POST', body: formDataUpload });
          if (!uploadRes.ok) {
            const errData = await uploadRes.json().catch(() => ({}));
            throw new Error(errData.error || errData.details || 'העלאת המדיה נכשלה');
          }
          const { url: cloudinaryUrl } = await uploadRes.json();
          att = { url: cloudinaryUrl, type: att.type, name: att.name };
        }
        mediaFields = {
          media_attachment: att ? { url: att.url, type: att.type, name: att.name } : (question?.media_attachment || null),
          media_bank_tag: '',
        };
      } else {
        mediaFields = { media_attachment: null, media_bank_tag: formData.media_bank_tag?.trim() || '' };
      }

      const questionData = {
        ...formData,
        ...mediaFields,
        options: preparedOptions ? JSON.stringify(preparedOptions) : undefined,
        correct_answer: correctAnswerPayload
      };

      if (question?.id) {
        // Update existing
        await entities.Question_Bank.update(question.id, questionData);
        showToast('שאלה עודכנה בהצלחה', 'success');
        announce('שאלה עודכנה בהצלחה');
      } else {
        // Create new
        await entities.Question_Bank.create(questionData);
        showToast('שאלה נוצרה בהצלחה', 'success');
        announce('שאלה נוצרה בהצלחה');
      }

      onSave();
    } catch (error) {
      console.error('Error saving question:', error);
      showToast('שגיאה בשמירת שאלה', 'error');
      announce('שגיאה בשמירת שאלה', 'assertive');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title={question?.id ? 'עריכת שאלה' : 'יצירת שאלה חדשה'}
      size="lg"
      ariaLabel={question?.id ? 'עריכת שאלה' : 'יצירת שאלה חדשה'}
    >
      <form onSubmit={handleSubmit} style={styles.form}>
        <FormField
          label="היררכיית תוכן"
          name="hierarchy_id"
          type="select"
          value={formData.hierarchy_id}
          onChange={(e) => handleChange('hierarchy_id', e.target.value)}
          required
        >
          <option value="">בחר נושא</option>
          {hierarchies.map(h => (
            <option key={h.id} value={h.id}>
              {h.category_name} - {h.topic_name}
            </option>
          ))}
        </FormField>

        <FormField
          label="סוג שאלה"
          name="question_type"
          type="select"
          value={formData.question_type}
          onChange={(e) => handleChange('question_type', e.target.value)}
          required
        >
          <option value="single_choice">בחירה יחידה</option>
          <option value="multi_choice">בחירה מרובה</option>
          <option value="true_false">נכון/לא נכון</option>
          <option value="open_ended">שאלה פתוחה</option>
        </FormField>

        <FormField
          label="טקסט השאלה"
          name="question_text"
          type="textarea"
          value={formData.question_text}
          onChange={(e) => handleChange('question_text', e.target.value)}
          required
          rows={4}
        />

        {(formData.question_type === 'single_choice' || formData.question_type === 'multi_choice') && (
          <div style={styles.optionsSection}>
            <label style={styles.label}>אפשרויות תשובה (מסיחים):</label>
            {options.map((option, index) => {
              const optionText = typeof option === 'string' ? option : option.text || '';
              const isChecked = formData.question_type === 'single_choice'
                ? formData.correct_answer === index.toString()
                : Array.isArray(formData.correct_answer) && formData.correct_answer.includes(index.toString());
              
              return (
                <div key={index} style={styles.optionRow}>
                  <input
                    type={formData.question_type === 'single_choice' ? 'radio' : 'checkbox'}
                    name={formData.question_type === 'single_choice' ? 'correct_answer' : `correct_answer_${index}`}
                    checked={isChecked}
                    onChange={() => {
                      if (formData.question_type === 'single_choice') {
                        handleChange('correct_answer', index.toString());
                      } else {
                        const current = Array.isArray(formData.correct_answer) ? formData.correct_answer : [];
                        const newAnswers = isChecked
                          ? current.filter(a => a !== index.toString())
                          : [...current, index.toString()];
                        handleChange('correct_answer', newAnswers);
                      }
                    }}
                    style={styles.radio}
                    aria-label={`תשובה נכונה ${index + 1}`}
                  />
                  <input
                    type="text"
                    value={optionText}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`מסיח ${index + 1}`}
                    style={styles.optionInput}
                    aria-label={`אפשרות תשובה ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    disabled={options.length <= 2}
                    style={styles.removeOptionBtn}
                    title="הסר אפשרות"
                    aria-label={`הסר אפשרות ${index + 1}`}
                  >
                    🗑️
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={handleAddOption}
              disabled={options.length >= 10}
              style={styles.addOptionBtn}
            >
              + הוסף מסיח
            </button>
          </div>
        )}

        {formData.question_type === 'true_false' && (
          <div style={styles.optionsSection}>
            <label style={styles.label}>תשובה נכונה:</label>
            <div style={styles.radioGroup}>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  name="correct_answer"
                  value="true"
                  checked={formData.correct_answer === 'true'}
                  onChange={(e) => handleChange('correct_answer', e.target.value)}
                />
                נכון
              </label>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  name="correct_answer"
                  value="false"
                  checked={formData.correct_answer === 'false'}
                  onChange={(e) => handleChange('correct_answer', e.target.value)}
                />
                לא נכון
              </label>
            </div>
          </div>
        )}

        {formData.question_type === 'open_ended' && (
          <FormField
            label="תשובה נכונה (אופציונלי)"
            name="correct_answer"
            type="textarea"
            value={formData.correct_answer}
            onChange={(e) => handleChange('correct_answer', e.target.value)}
            helpText="תשובה מומלצת או מילות מפתח"
            rows={3}
          />
        )}

        {/* Difficulty — read-only, calculated automatically from answers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A1A' }}>
            רמת קושי
          </label>
          {(() => {
            const d = getDifficultyDisplay(question?.difficulty_level);
            const attempts = question?.total_attempts ?? 0;
            const rate = question?.success_rate;
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', background: '#F8F8F8',
                borderRadius: '8px', border: '1px solid #E0E0E0',
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '3px 12px', borderRadius: '12px', fontSize: '14px',
                  fontWeight: 700, color: d.color, background: d.bg,
                  border: `1px solid ${d.border}`,
                }}>
                  {d.label}
                </span>
                <span style={{ fontSize: '13px', color: '#666' }}>
                  {attempts < MIN_ATTEMPTS_FOR_RATING
                    ? `מחושב אוטומטי לאחר ${MIN_ATTEMPTS_FOR_RATING} תשובות (${attempts} עד כה)`
                    : rate != null
                      ? `${rate}% מענה נכון · ${attempts} ניסיונות`
                      : `${attempts} ניסיונות`}
                </span>
              </div>
            );
          })()}
          <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
            קל = 95–100% · בינוני = 80–94% · קשה = 70–79% · מתחת ל-70% → הושעה לבדיקת מנהלים
          </p>
        </div>

        {/* ── Media Section ───────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A1A' }}>
            מדיה לשאלה
          </label>

          {/* Mode selector */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'none',   label: '✗ ללא מדיה' },
              { id: 'static', label: '📎 קובץ סטטי' },
              { id: 'bank',   label: '🗃️ ממאגר המדיה' },
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setMediaMode(opt.id);
                  if (opt.id !== 'bank')   handleChange('media_bank_tag', '');
                  if (opt.id !== 'static') handleChange('media_attachment', null);
                }}
                style={{
                  padding: '6px 16px', border: '1.5px solid',
                  borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit',
                  borderColor: mediaMode === opt.id ? '#CC0000' : '#ccc',
                  background:  mediaMode === opt.id ? '#FFF0F0' : '#fafafa',
                  color:       mediaMode === opt.id ? '#CC0000' : '#555',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Static file upload */}
          {mediaMode === 'static' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                type="file"
                accept="image/*,video/*,audio/*"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    handleChange('media_attachment', { file, url, type: file.type.split('/')[0], name: file.name });
                  }
                }}
                style={{ fontSize: '13px' }}
              />
              {formData.media_attachment?.url && (
                <div style={{ marginTop: '6px' }}>
                  {formData.media_attachment.type === 'video'
                    ? <video src={formData.media_attachment.url} controls style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '220px' }} />
                    : formData.media_attachment.type === 'audio'
                    ? <audio src={formData.media_attachment.url} controls style={{ width: '100%' }} />
                    : <img src={formData.media_attachment.url} alt="תצוגה מקדימה" style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '220px', objectFit: 'contain' }} />
                  }
                  <span style={{ fontSize: '12px', color: '#777' }}>
                    {getMediaTypeLabel(formData.media_attachment.type)} · {formData.media_attachment.name}
                  </span>
                </div>
              )}
              {/* Existing attachment from saved question */}
              {!formData.media_attachment && question?.media_attachment?.url && (
                <div style={{ marginTop: '6px' }}>
                  <img src={question.media_attachment.url} alt="קובץ מצורף קיים" style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '220px', objectFit: 'contain' }} />
                  <p style={{ fontSize: '12px', color: '#777', margin: '4px 0 0' }}>קובץ קיים — בחר חדש להחלפה</p>
                </div>
              )}
            </div>
          )}

          {/* Media bank tag */}
          {mediaMode === 'bank' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                type="text"
                placeholder='לדוגמא: PSVT, AFib, VTach'
                value={formData.media_bank_tag}
                onChange={e => handleChange('media_bank_tag', e.target.value)}
                style={{
                  padding: '9px 12px', border: '1.5px solid #e0e0e0', borderRadius: '8px',
                  fontSize: '14px', fontFamily: 'inherit', direction: 'ltr', textAlign: 'left',
                }}
              />
              {mediaPreviewCount !== null && (
                <span style={{
                  fontSize: '12px', fontWeight: 600,
                  color: mediaPreviewCount > 0 ? '#2E7D32' : '#C62828',
                }}>
                  {mediaPreviewCount > 0
                    ? `✅ נמצאו ${mediaPreviewCount} פריטים פעילים בתג זה — כל הצגה תשלוף פריט אקראי`
                    : '⚠️ אין פריטים פעילים בתג זה. הוסף פריטים במאגר המדיה.'}
                </span>
              )}
              <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
                המערכת תשלוף תמונה / וידאו / אודיו אקראי בכל הצגת השאלה.
                כל פריט נמדד בנפרד סטטיסטית.
                ניהול הפריטים: <strong>מאגר המדיה</strong> בתפריט.
              </p>
            </div>
          )}
        </div>

        <FormField
          label="רמז (אופציונלי)"
          name="hint"
          type="text"
          value={formData.hint}
          onChange={(e) => handleChange('hint', e.target.value)}
        />

        <FormField
          label="הסבר (אופציונלי)"
          name="explanation"
          type="textarea"
          value={formData.explanation}
          onChange={(e) => handleChange('explanation', e.target.value)}
          rows={3}
          helpText="הסבר למה התשובה נכונה"
        />

        <div style={styles.tagsSection}>
          <label style={styles.label}>תגיות:</label>
          <div style={styles.tagsInput}>
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="הוסף תגית"
              style={styles.tagInput}
              aria-label="הוסף תגית"
            />
            <button
              type="button"
              onClick={handleAddTag}
              style={styles.addTagButton}
              aria-label="הוסף תגית"
            >
              הוסף
            </button>
          </div>
          <div style={styles.tagsList}>
            {formData.tags.map((tag, index) => (
              <span key={index} style={styles.tag}>
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  style={styles.removeTagButton}
                  aria-label={`הסר תגית ${tag}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>

        <FormField
          label="סטטוס"
          name="status"
          type="select"
          value={formData.status}
          onChange={(e) => handleChange('status', e.target.value)}
        >
          <option value="draft">טיוטה</option>
          <option value="pending_review">ממתין לבקרה</option>
          <option value="active">פעיל</option>
        </FormField>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div style={styles.errorsSection} role="alert">
            <h4 style={styles.errorsTitle}>שגיאות שצריך לתקן:</h4>
            <ul style={styles.errorsList}>
              {validationErrors.map((error, index) => (
                <li key={index} style={styles.errorItem}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview Button */}
        <div style={styles.previewSection}>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            style={styles.previewButton}
            aria-label="תצוגה מקדימה"
          >
            {showPreview ? 'הסתר תצוגה מקדימה' : 'תצוגה מקדימה'}
          </button>
        </div>

        {/* Preview */}
        {showPreview && (
          <div style={styles.previewContainer}>
            <h4 style={styles.previewTitle}>תצוגה מקדימה:</h4>
            <div style={styles.previewContent}>
              <p style={styles.previewQuestion}>{formData.question_text || '(לא הוזן טקסט)'}</p>
              {/* Media in preview: static file or one sample from media bank */}
              {(mediaMode === 'static' && formData.media_attachment?.url) && (
                <div style={{ marginBottom: '12px' }}>
                  {formData.media_attachment.type === 'video'
                    ? <video src={formData.media_attachment.url} controls style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '220px' }} />
                    : formData.media_attachment.type === 'audio'
                    ? <audio src={formData.media_attachment.url} controls style={{ width: '100%' }} />
                    : <img src={formData.media_attachment.url} alt="תצוגה מקדימה" style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '220px', objectFit: 'contain' }} />}
                </div>
              )}
              {mediaMode === 'bank' && formData.media_bank_tag?.trim() && (
                <div style={{ marginBottom: '12px' }}>
                  {previewMediaItem?.url ? (
                    <>
                      {(!previewMediaItem.media_type || previewMediaItem.media_type === 'image') && (
                        <img src={previewMediaItem.url} alt="מדיה לשאלה" style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '220px', objectFit: 'contain' }} />
                      )}
                      {previewMediaItem.media_type === 'video' && (
                        <video src={previewMediaItem.url} controls style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '220px' }} />
                      )}
                      {previewMediaItem.media_type === 'audio' && (
                        <audio src={previewMediaItem.url} controls style={{ width: '100%' }} />
                      )}
                    </>
                  ) : (
                    <div style={{ padding: '24px', background: '#f5f5f5', borderRadius: '8px', color: '#666', fontSize: '14px' }}>
                      מדיה ממאגר (תג: {formData.media_bank_tag}) — {mediaPreviewCount ? `נטען דוגמה מתוך ${mediaPreviewCount} פריטים` : 'טוען...'}
                    </div>
                  )}
                </div>
              )}
              {(formData.question_type === 'single_choice' || formData.question_type === 'multi_choice') && (
                <div style={styles.previewOptions}>
                  {options.map((opt, idx) => {
                    const text = typeof opt === 'string' ? opt : opt.text || '';
                    const isCorrect = formData.question_type === 'multi_choice'
                      ? (Array.isArray(formData.correct_answer) && formData.correct_answer.includes(idx.toString()))
                      : formData.correct_answer === idx.toString();
                    return (
                      <div key={idx} style={{
                        ...styles.previewOption,
                        ...(isCorrect ? styles.previewOptionCorrect : {})
                      }}>
                        {text || `(אופציה ${idx + 1} ריקה)`}
                        {isCorrect && <span style={styles.correctMark}> ✓</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              {formData.question_type === 'true_false' && (
                <div style={styles.previewOptions}>
                  <div style={{
                    ...styles.previewOption,
                    ...(formData.correct_answer === 'true' ? styles.previewOptionCorrect : {})
                  }}>
                    נכון {formData.correct_answer === 'true' && <span style={styles.correctMark}> ✓</span>}
                  </div>
                  <div style={{
                    ...styles.previewOption,
                    ...(formData.correct_answer === 'false' ? styles.previewOptionCorrect : {})
                  }}>
                    לא נכון {formData.correct_answer === 'false' && <span style={styles.correctMark}> ✓</span>}
                  </div>
                </div>
              )}
              {formData.explanation && (
                <div style={styles.previewExplanation}>
                  <strong>הסבר:</strong> {formData.explanation}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={styles.actions}>
          {question?.id && (
            <button
              type="button"
              onClick={() => setShowVersionHistory(true)}
              style={styles.historyButton}
              aria-label="היסטוריית גרסאות"
            >
              היסטוריית גרסאות
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            style={styles.cancelButton}
            aria-label="ביטול"
          >
            ביטול
          </button>
          <button
            type="submit"
            style={{
              ...styles.saveButton,
              ...(validationErrors.length > 0 ? styles.saveButtonDisabled : {})
            }}
            disabled={isSaving || validationErrors.length > 0}
            aria-label="שמור שאלה"
          >
            {isSaving ? 'שומר...' : 'שמור'}
          </button>
        </div>
        
        {/* Version History Modal */}
        {showVersionHistory && question?.id && (
          <Modal
            isOpen={true}
            onClose={() => setShowVersionHistory(false)}
            title="היסטוריית גרסאות"
            size="lg"
          >
            <QuestionVersionHistory
              questionId={question.id}
              onVersionRestored={() => {
                setShowVersionHistory(false);
                if (onSave) onSave();
              }}
            />
          </Modal>
        )}
      </form>
    </Modal>
  );
}

const styles = {
  form: {
    direction: 'rtl',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  optionsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#212121',
    marginBottom: '8px'
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  radio: {
    margin: 0,
    cursor: 'pointer'
  },
  optionInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    direction: 'rtl'
  },
  removeOptionBtn: {
    padding: '6px 10px',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '14px'
  },
  addOptionBtn: {
    alignSelf: 'flex-start',
    padding: '8px 16px',
    border: '1px dashed #CC0000',
    borderRadius: '8px',
    background: '#e3f2fd',
    color: '#1976d2',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '14px'
  },
  radioGroup: {
    display: 'flex',
    gap: '20px'
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  tagsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  tagsInput: {
    display: 'flex',
    gap: '8px'
  },
  tagInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    direction: 'rtl'
  },
  addTagButton: {
    padding: '8px 16px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    '&:hover': {
      backgroundColor: '#A50000'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  tagsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  tag: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: '#e3f2fd',
    color: '#A50000',
    borderRadius: '12px',
    fontSize: '12px'
  },
  removeTagButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#A50000',
    cursor: 'pointer',
    padding: 0,
    fontSize: '14px',
    '&:hover': {
      color: '#0d47a1'
    }
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px',
    flexWrap: 'wrap'
  },
  historyButton: {
    padding: '10px 20px',
    backgroundColor: '#757575',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    marginRight: 'auto',
    '&:hover': {
      backgroundColor: '#616161'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#FFFFFF',
    color: '#212121',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    '&:hover': {
      backgroundColor: '#f5f5f5'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    '&:hover:not(:disabled)': {
      backgroundColor: '#A50000'
    },
    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  saveButtonDisabled: {
    backgroundColor: '#9E9E9E',
    '&:hover': {
      backgroundColor: '#9E9E9E'
    }
  },
  errorsSection: {
    backgroundColor: '#ffebee',
    padding: '16px',
    borderRadius: '4px',
    border: '1px solid #ef5350'
  },
  errorsTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: '12px'
  },
  errorsList: {
    marginRight: '20px',
    listStyle: 'disc'
  },
  errorItem: {
    fontSize: '14px',
    color: '#c62828',
    marginBottom: '8px'
  },
  previewSection: {
    marginTop: '20px'
  },
  previewButton: {
    padding: '8px 16px',
    backgroundColor: '#f5f5f5',
    color: '#212121',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    '&:hover': {
      backgroundColor: '#e0e0e0'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  previewContainer: {
    backgroundColor: '#f9f9f9',
    padding: '20px',
    borderRadius: '8px',
    marginTop: '16px',
    border: '1px solid #e0e0e0'
  },
  previewTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#212121'
  },
  previewContent: {
    direction: 'rtl'
  },
  previewQuestion: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#212121',
    lineHeight: 1.6
  },
  previewOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px'
  },
  previewOption: {
    padding: '12px',
    backgroundColor: '#FFFFFF',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
    fontSize: '14px',
    color: '#212121'
  },
  previewOptionCorrect: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
    fontWeight: 'bold'
  },
  correctMark: {
    color: '#2e7d32',
    fontSize: '16px'
  },
  previewExplanation: {
    padding: '12px',
    backgroundColor: '#e3f2fd',
    borderRadius: '4px',
    fontSize: '14px',
    color: '#212121',
    marginTop: '16px'
  }
};
