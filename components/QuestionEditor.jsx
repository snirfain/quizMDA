/**
 * Question Editor Component
 * Create/edit questions
 * Hebrew: עורך שאלות
 */

import React, { useState, useEffect, useMemo } from 'react';
import { entities } from '../config/appConfig';
import Modal from './Modal';
import FormField from './FormField';
import QuestionVersionHistory from './QuestionVersionHistory';
import { showToast } from './Toast';
import { announce } from '../utils/accessibility';
import { validateQuestion } from '../utils/questionValidation';
import { MIN_ATTEMPTS_FOR_RATING } from '../workflows/difficultyEngine';
import { getMediaTypeLabel } from '../workflows/mediaEngine';
import QuestionResolvedMedia from './QuestionResolvedMedia';
import {
  QUESTION_CATEGORIES,
  THINKING_LEVELS,
  TRAINING_LEVELS,
  QUESTION_STATUSES,
  QUESTION_TYPES_UI,
  getSubcategoriesForCategory,
  normalizeQuestionMediaPayload,
} from '../shared/questionBankMetadata.js';

export default function QuestionEditor({ question, hierarchies: _hierarchies, onSave, onCancel }) {
  const isNewQuestion = !question?.id;
  const initialCategory =
    question?.category && QUESTION_CATEGORIES.some((c) => c.value === question.category)
      ? question.category
      : '';

  const [formData, setFormData] = useState({
    category: initialCategory,
    sub_category:
      question?.sub_category && question.sub_category.trim()
        ? question.sub_category.trim()
        : '',
    thinking_level: question?.thinking_level || 'Knowledge',
    training_level: question?.training_level || '',
    question_type: question?.question_type || '',
    question_text: question?.question_text || '',
    media_attachment: question?.media_attachment ?? null,
    media_bank_tag: typeof question?.media_bank_tag === 'string' ? question.media_bank_tag.trim() : question?.media_bank_tag || '',
    correct_answer: question?.correct_answer || '',
    explanation: question?.explanation || '',
    hint: question?.hint || '',
    status: question?.status === 'pending_review' || question?.status === 'suspended' ? 'under_review' : (question?.status || ''),
  });

  const [mediaMode, setMediaMode] = useState(() => {
    if (question?.media_bank_tag && String(question.media_bank_tag).trim()) return 'bank';
    if (question?.media_attachment?.url || question?.media_attachment) return 'static';
    return 'none';
  });

  const [bankTags, setBankTags] = useState([]);

  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const subOptions = useMemo(() => getSubcategoriesForCategory(formData.category), [formData.category]);

  useEffect(() => {
    if (!formData.category) {
      setFormData((prev) => (prev.sub_category ? { ...prev, sub_category: '' } : prev));
      return;
    }
    if (formData.sub_category && !subOptions.includes(formData.sub_category)) {
      setFormData((prev) => ({ ...prev, sub_category: subOptions[0] || '' }));
    }
  }, [formData.category, subOptions, formData.sub_category]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tags = await entities.Media_Bank.distinctTags();
        if (!cancelled) setBankTags(Array.isArray(tags) ? tags : []);
      } catch {
        if (!cancelled) setBankTags([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [options, setOptions] = useState(() => {
    const opts = question?.options;
    if (opts && Array.isArray(opts) && opts.length > 0) {
      if (typeof opts[0] === 'string') return opts.slice();
      return opts.map((opt) => (opt && (opt.label ?? opt.text ?? '')) || '');
    }
    if (typeof opts === 'string') {
      try {
        const parsed = JSON.parse(opts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((opt) => (typeof opt === 'string' ? opt : (opt.label ?? opt.text ?? '')));
        }
      } catch (e) {}
    }
    if (question?.correct_answer) {
      try {
        const ca =
          typeof question.correct_answer === 'string'
            ? JSON.parse(question.correct_answer)
            : question.correct_answer;
        if (ca && Array.isArray(ca.options) && ca.options.length > 0) {
          return ca.options.map((o) => (o && (o.label ?? o.text ?? '')) || '');
        }
      } catch (_) {}
    }
    return ['', ''];
  });

  useEffect(() => {
    if (question?.correct_answer) {
      if (formData.question_type === 'multi_choice') {
        try {
          const parsed =
            typeof question.correct_answer === 'string'
              ? JSON.parse(question.correct_answer)
              : question.correct_answer;
          if (Array.isArray(parsed?.values)) {
            setFormData((prev) => ({ ...prev, correct_answer: parsed.values.map((a) => String(a)) }));
          } else if (Array.isArray(parsed)) {
            setFormData((prev) => ({ ...prev, correct_answer: parsed.map((a) => a.toString()) }));
          }
        } catch (e) {}
      } else if (formData.question_type !== 'open_ended') {
        try {
          const parsed =
            typeof question.correct_answer === 'string'
              ? JSON.parse(question.correct_answer)
              : question.correct_answer;
          if (parsed && parsed.value !== undefined) {
            setFormData((prev) => ({ ...prev, correct_answer: String(parsed.value) }));
            return;
          }
        } catch (e) {}
        setFormData((prev) => ({ ...prev, correct_answer: String(question.correct_answer) }));
      } else {
        try {
          const parsed =
            typeof question.correct_answer === 'string'
              ? JSON.parse(question.correct_answer)
              : question.correct_answer;
          if (parsed && typeof parsed.value === 'string') {
            setFormData((prev) => ({ ...prev, correct_answer: parsed.value }));
            return;
          }
        } catch (e) {}
        setFormData((prev) => ({ ...prev, correct_answer: String(question.correct_answer) }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateForm();
    }, 300);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.question_text,
    formData.question_type,
    formData.correct_answer,
    formData.category,
    formData.sub_category,
    formData.thinking_level,
    formData.training_level,
    options,
  ]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
    if (formData.question_type === 'single_choice') {
      const was = formData.correct_answer;
      if (was === index.toString()) handleChange('correct_answer', '0');
      else if (parseInt(was, 10) > index) handleChange('correct_answer', String(parseInt(was, 10) - 1));
    } else if (Array.isArray(formData.correct_answer)) {
      const next = formData.correct_answer
        .filter((a) => a !== index.toString())
        .map((a) => {
          const n = parseInt(a, 10);
          return n > index ? String(n - 1) : a;
        });
      handleChange('correct_answer', next);
    }
  };

  const validateForm = () => {
    const questionToValidate = {
      ...formData,
      status: formData.status,
      options:
        formData.question_type !== 'open_ended'
          ? options.map((opt, idx) => {
              const text = typeof opt === 'string' ? opt : opt.text || '';
              const isCorrect =
                formData.question_type === 'multi_choice'
                  ? Array.isArray(formData.correct_answer) && formData.correct_answer.includes(idx.toString())
                  : formData.correct_answer === idx.toString();
              return { text, isCorrect };
            })
          : undefined,
    };

    const validation = validateQuestion(questionToValidate);
    const extraErrors = [];
    if (!formData.category) extraErrors.push('יש לבחור פרק');
    if (!formData.sub_category) extraErrors.push('יש לבחור תת־קטגוריה');
    if (!formData.training_level) extraErrors.push('יש לבחור רמת הכשרה');
    if (!formData.question_type) extraErrors.push('יש לבחור סוג שאלה');
    if (!formData.status) extraErrors.push('יש לבחור סטטוס');
    const errors = [...validation.errors, ...extraErrors];
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('יש לתקן שגיאות לפני שמירה', 'error');
      announce('יש שגיאות בטופס', 'assertive');
      return;
    }

    setIsSaving(true);

    try {
      let preparedOptions;
      if (formData.question_type !== 'open_ended') {
        preparedOptions = options.map((opt, idx) => {
          const text = typeof opt === 'string' ? opt : opt.text || '';
          return {
            text,
            isCorrect:
              formData.question_type === 'multi_choice'
                ? Array.isArray(formData.correct_answer) && formData.correct_answer.includes(idx.toString())
                : formData.correct_answer === idx.toString(),
          };
        });
      }

      const optionsForCorrect = preparedOptions
        ? preparedOptions.map((opt, idx) => ({
            value: String(idx),
            label: typeof opt.text === 'string' ? opt.text : opt.text?.text ?? '',
          }))
        : [];
      const correctAnswerPayload =
        formData.question_type === 'open_ended'
          ? formData.correct_answer
          : formData.question_type === 'multi_choice'
            ? JSON.stringify({
                values: (formData.correct_answer || []).map(String),
                options: optionsForCorrect,
              })
            : JSON.stringify({
                value: String(formData.correct_answer ?? '0'),
                options: optionsForCorrect,
              });

      let mediaFields = {};
      if (mediaMode === 'none') {
        mediaFields = { media_attachment: null, media_bank_tag: null };
      } else if (mediaMode === 'bank') {
        const tm = (formData.media_bank_tag || '').trim();
        mediaFields = { media_attachment: null, media_bank_tag: tm || null };
      } else {
        let att = formData.media_attachment;
        if (att?.url?.startsWith?.('blob:') && att.file) {
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
          media_attachment: att ? { url: att.url, type: att.type, name: att.name } : question?.media_attachment || null,
          media_bank_tag: null,
        };
      }

      const m = normalizeQuestionMediaPayload({ ...formData, ...mediaFields });
      const questionData = {
        ...formData,
        ...m,
        options: preparedOptions ? JSON.stringify(preparedOptions) : undefined,
        correct_answer: correctAnswerPayload,
      };

      if (question?.id) {
        await entities.Question_Bank.update(question.id, questionData);
        showToast('שאלה עודכנה בהצלחה', 'success');
        announce('שאלה עודכנה בהצלחה');
      } else {
        const created = await entities.Question_Bank.create({
          ...questionData,
          thinking_level: 'Knowledge',
        });
        const createdId = created?.id;
        if (createdId) {
          try {
            const r = await fetch(`/api/questions/${createdId}/classify-thinking-level`, {
              method: 'POST',
            });
            if (r.ok) {
              const cls = await r.json();
              showToast(`רמת החשיבה נקבעה אוטומטית: ${cls.thinking_level}`, 'success');
            }
          } catch (_) {}
        }
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
        <div style={styles.gridRow2} role="group" aria-label="פרק ותת־קטגוריה">
          <FormField
            compact
            label="פרק"
            name="category"
            type="select"
            value={formData.category}
            onChange={(e) => handleChange('category', e.target.value)}
            required
          >
            <option value="">בחר פרק...</option>
            {QUESTION_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </FormField>
          <FormField
            compact
            label="תת־קטגוריה"
            name="sub_category"
            type="select"
            value={formData.sub_category}
            onChange={(e) => handleChange('sub_category', e.target.value)}
            required
            disabled={!formData.category}
          >
            <option value="">בחר תת־קטגוריה...</option>
            {subOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FormField>
        </div>

        <div style={styles.gridRow3} role="group" aria-label="רמת חשיבה, הכשרה וסוג שאלה">
          <FormField
            compact
            label="רמת חשיבה"
            name="thinking_level"
            type="select"
            value={formData.thinking_level}
            onChange={(e) => handleChange('thinking_level', e.target.value)}
            required
            disabled={isNewQuestion}
            helpText={isNewQuestion ? 'נקבע אוטומטית אחרי שמירה (אפשר לערוך בעריכה חוזרת)' : undefined}
          >
            {THINKING_LEVELS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </FormField>
          <FormField
            compact
            label="רמת הכשרה"
            name="training_level"
            type="select"
            value={formData.training_level}
            onChange={(e) => handleChange('training_level', e.target.value)}
            required
          >
            <option value="">בחר רמת הכשרה...</option>
            {TRAINING_LEVELS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </FormField>
          <FormField
            compact
            label="סוג שאלה"
            name="question_type"
            type="select"
            value={formData.question_type}
            onChange={(e) => handleChange('question_type', e.target.value)}
            required
          >
            <option value="">בחר סוג שאלה...</option>
            {QUESTION_TYPES_UI.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </FormField>
        </div>

        <FormField
          marginBottom={10}
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
              const isChecked =
                formData.question_type === 'single_choice'
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
                        const newAnswers = isChecked ? current.filter((a) => a !== index.toString()) : [...current, index.toString()];
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
                  <button type="button" onClick={() => handleRemoveOption(index)} disabled={options.length <= 2} style={styles.removeOptionBtn} title="הסר אפשרות" aria-label={`הסר אפשרות ${index + 1}`}>
                    🗑️
                  </button>
                </div>
              );
            })}
            <button type="button" onClick={handleAddOption} disabled={options.length >= 10} style={styles.addOptionBtn}>
              + הוסף מסיח
            </button>
          </div>
        )}

        {formData.question_type === 'true_false' && (
          <div style={styles.optionsSection}>
            <label style={styles.label}>תשובה נכונה:</label>
            <div style={styles.radioGroup}>
              <label style={styles.radioLabel}>
                <input type="radio" name="correct_answer" value="true" checked={formData.correct_answer === 'true'} onChange={(e) => handleChange('correct_answer', e.target.value)} />
                נכון
              </label>
              <label style={styles.radioLabel}>
                <input type="radio" name="correct_answer" value="false" checked={formData.correct_answer === 'false'} onChange={(e) => handleChange('correct_answer', e.target.value)} />
                לא נכון
              </label>
            </div>
          </div>
        )}

        {formData.question_type === 'open_ended' && (
          <FormField marginBottom={10} label="תשובה נכונה (אופציונלי)" name="correct_answer" type="textarea" value={formData.correct_answer} onChange={(e) => handleChange('correct_answer', e.target.value)} helpText="תשובה מומלצת או מילות מפתח" rows={3} />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={styles.sectionLabel}>סטטיסטיקה (קריאה בלבד)</label>
          {(() => {
            const attempts = question?.total_attempts ?? 0;
            const rate = question?.success_rate;
            return (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: '8px 12px',
                  background: '#F8F8F8',
                  borderRadius: '8px',
                  border: '1px solid #E0E0E0',
                  fontSize: '13px',
                  color: '#555',
                }}
              >
                <span>
                  ניסיונות: {attempts}
                  {rate != null && attempts > 0 ? ` · אחוז הצלחה: ${rate}%` : ''}
                </span>
                {attempts >= MIN_ATTEMPTS_FOR_RATING && rate != null && rate < 50 && (
                  <span style={{ color: '#C62828' }}>מתחת ל-50% הצלחה לאחר {MIN_ATTEMPTS_FOR_RATING} ניסיונות — שאלה פעילה עשויה לעבור אוטומטית ל&quot;בבדיקה&quot;.</span>
                )}
              </div>
            );
          })()}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={styles.sectionLabel}>מדיה לשאלה</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'none', label: '✗ ללא מדיה' },
              { id: 'static', label: '📎 קובץ סטטי' },
              { id: 'bank', label: '🗃️ מהמאגר (תג)' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setMediaMode(opt.id);
                  if (opt.id === 'none') {
                    handleChange('media_attachment', null);
                    handleChange('media_bank_tag', '');
                  }
                  if (opt.id === 'static') handleChange('media_bank_tag', '');
                  if (opt.id === 'bank') handleChange('media_attachment', null);
                }}
                style={{
                  padding: '6px 16px',
                  border: '1.5px solid',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  borderColor: mediaMode === opt.id ? '#CC0000' : '#ccc',
                  background: mediaMode === opt.id ? '#FFF0F0' : '#fafafa',
                  color: mediaMode === opt.id ? '#CC0000' : '#555',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {mediaMode === 'bank' && (
              <>
                <label htmlFor="q-bank-media-tag" style={{ fontSize: '13px', color: '#555' }}>
                  תג מאגר מדיה (יוצג פריט פעיל אקראי עם אותו תג)
                </label>
                <input
                  id="q-bank-media-tag"
                  type="text"
                  list="question-editor-bank-tags"
                  value={formData.media_bank_tag}
                  onChange={(e) => handleChange('media_bank_tag', e.target.value)}
                  placeholder="לדוגמה: ECG / פציעות"
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                />
                <datalist id="question-editor-bank-tags">
                  {bankTags.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </>
            )}
            {mediaMode === 'static' && (
            <input
              type="file"
              accept="image/*,video/*,audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  handleChange('media_attachment', { file, url, type: file.type.split('/')[0], name: file.name });
                }
              }}
              style={{ fontSize: '13px' }}
            />
            )}
            {formData.media_attachment?.url && (
              <div style={{ marginTop: '6px' }}>
                {formData.media_attachment.type === 'video' ? (
                  <video src={formData.media_attachment.url} controls style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '220px' }} />
                ) : formData.media_attachment.type === 'audio' ? (
                  <audio src={formData.media_attachment.url} controls style={{ width: '100%' }} />
                ) : (
                  <img src={formData.media_attachment.url} alt="תצוגה מקדימה" style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '220px', objectFit: 'contain' }} />
                )}
                <span style={{ fontSize: '12px', color: '#777' }}>
                  {getMediaTypeLabel(formData.media_attachment.type)} · {formData.media_attachment.name}
                </span>
              </div>
            )}
            {!formData.media_attachment?.url && question?.media_attachment?.url && (
              <div style={{ marginTop: '6px' }}>
                <img src={question.media_attachment.url} alt="קובץ מצורף קיים" style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '220px', objectFit: 'contain' }} />
                <p style={{ fontSize: '12px', color: '#777', margin: '4px 0 0' }}>קובץ קיים — בחר חדש להחלפה</p>
              </div>
            )}
          </div>
        </div>

        <FormField marginBottom={10} label="רמז (אופציונלי)" name="hint" type="text" value={formData.hint} onChange={(e) => handleChange('hint', e.target.value)} />

        <FormField marginBottom={10} label="הסבר (אופציונלי)" name="explanation" type="textarea" value={formData.explanation} onChange={(e) => handleChange('explanation', e.target.value)} rows={3} helpText="הסבר למה התשובה נכונה" />

        <FormField marginBottom={10} label="סטטוס" name="status" type="select" value={formData.status} onChange={(e) => handleChange('status', e.target.value)}>
          <option value="">בחר סטטוס...</option>
          {QUESTION_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </FormField>

        {validationErrors.length > 0 && (
          <div style={styles.errorsSection} role="alert">
            <h4 style={styles.errorsTitle}>שגיאות שצריך לתקן:</h4>
            <ul style={styles.errorsList}>
              {validationErrors.map((error, index) => (
                <li key={index} style={styles.errorItem}>
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={styles.previewSection}>
          <button type="button" onClick={() => setShowPreview(!showPreview)} style={styles.previewButton} aria-label="תצוגה מקדימה">
            {showPreview ? 'הסתר תצוגה מקדימה' : 'תצוגה מקדימה'}
          </button>
        </div>

        {showPreview && (
          <div style={styles.previewContainer}>
            <h4 style={styles.previewTitle}>תצוגה מקדימה:</h4>
            <div style={styles.previewContent}>
              <p style={styles.previewQuestion}>{formData.question_text || '(לא הוזן טקסט)'}</p>
              <QuestionResolvedMedia
                question={{
                  id: `preview-editor-${question?.id ?? 'new'}-${mediaMode}`,
                  media_attachment: mediaMode === 'static' ? formData.media_attachment : null,
                  media_bank_tag: mediaMode === 'bank' ? formData.media_bank_tag : null,
                }}
                containerStyle={{ marginBottom: '12px' }}
              />
              {(formData.question_type === 'single_choice' || formData.question_type === 'multi_choice') && (
                <div style={styles.previewOptions}>
                  {options.map((opt, idx) => {
                    const text = typeof opt === 'string' ? opt : opt.text || '';
                    const isCorrect =
                      formData.question_type === 'multi_choice'
                        ? Array.isArray(formData.correct_answer) && formData.correct_answer.includes(idx.toString())
                        : formData.correct_answer === idx.toString();
                    return (
                      <div
                        key={idx}
                        style={{
                          ...styles.previewOption,
                          ...(isCorrect ? styles.previewOptionCorrect : {}),
                        }}
                      >
                        {text || `(אופציה ${idx + 1} ריקה)`}
                        {isCorrect && <span style={styles.correctMark}> ✓</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              {formData.question_type === 'true_false' && (
                <div style={styles.previewOptions}>
                  <div style={{ ...styles.previewOption, ...(formData.correct_answer === 'true' ? styles.previewOptionCorrect : {}) }}>
                    נכון {formData.correct_answer === 'true' && <span style={styles.correctMark}> ✓</span>}
                  </div>
                  <div style={{ ...styles.previewOption, ...(formData.correct_answer === 'false' ? styles.previewOptionCorrect : {}) }}>
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
            <button type="button" onClick={() => setShowVersionHistory(true)} style={styles.historyButton} aria-label="היסטוריית גרסאות">
              היסטוריית גרסאות
            </button>
          )}
          <button type="button" onClick={onCancel} style={styles.cancelButton} aria-label="ביטול">
            ביטול
          </button>
          <button
            type="submit"
            style={{
              ...styles.saveButton,
              ...(validationErrors.length > 0 ? styles.saveButtonDisabled : {}),
            }}
            disabled={isSaving || validationErrors.length > 0}
            aria-label="שמור שאלה"
          >
            {isSaving ? 'שומר...' : 'שמור'}
          </button>
        </div>

        {showVersionHistory && question?.id && (
          <Modal isOpen={true} onClose={() => setShowVersionHistory(false)} title="היסטוריית גרסאות" size="lg">
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
    gap: '11px',
  },
  gridRow2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '8px 12px',
    alignItems: 'start',
    width: '100%',
  },
  gridRow3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px 12px',
    alignItems: 'start',
    width: '100%',
  },
  sectionLabel: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#1a1a1a',
    marginBottom: '2px',
  },
  optionsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#212121',
    marginBottom: '6px',
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  radio: {
    margin: 0,
    cursor: 'pointer',
  },
  optionInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    direction: 'rtl',
  },
  removeOptionBtn: {
    padding: '6px 10px',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
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
    fontSize: '14px',
  },
  radioGroup: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '12px',
    flexWrap: 'wrap',
    paddingTop: '4px',
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
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#FFFFFF',
    color: '#212121',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
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
  },
  saveButtonDisabled: {
    backgroundColor: '#9E9E9E',
  },
  errorsSection: {
    backgroundColor: '#ffebee',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #ef5350',
  },
  errorsTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: '8px',
  },
  errorsList: {
    marginRight: '20px',
    listStyle: 'disc',
  },
  errorItem: {
    fontSize: '14px',
    color: '#c62828',
    marginBottom: '8px',
  },
  previewSection: {
    marginTop: '8px',
  },
  previewButton: {
    padding: '8px 16px',
    backgroundColor: '#f5f5f5',
    color: '#212121',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  previewContainer: {
    backgroundColor: '#f9f9f9',
    padding: '12px 14px',
    borderRadius: '8px',
    marginTop: '10px',
    border: '1px solid #e0e0e0',
  },
  previewTitle: {
    fontSize: '15px',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#212121',
  },
  previewContent: {
    direction: 'rtl',
  },
  previewQuestion: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#212121',
    lineHeight: 1.6,
  },
  previewOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
  },
  previewOption: {
    padding: '12px',
    backgroundColor: '#FFFFFF',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
    fontSize: '14px',
    color: '#212121',
  },
  previewOptionCorrect: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
    fontWeight: 'bold',
  },
  correctMark: {
    color: '#2e7d32',
    fontSize: '16px',
  },
  previewExplanation: {
    padding: '12px',
    backgroundColor: '#e3f2fd',
    borderRadius: '4px',
    fontSize: '14px',
    color: '#212121',
    marginTop: '16px',
  },
};
