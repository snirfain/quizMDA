/**
 * Question Import Hub — a single page that hosts every way to bring questions
 * into the bank, as tabs. Replaces the separate standalone pages so users have
 * one clear "ייבוא שאלות" destination instead of many near-identical screens.
 *
 * Tabs:
 *   - manual  : paste text / upload Word·PDF / CSV·JSON·Excel  (QuestionImport)
 *   - chapter : generate questions from a book chapter with AI (ChapterQuestionGenerator)
 *   - file    : ingest a question file with AI tagging          (AiFileIngest)
 */

import React, { useState, Suspense } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { navigateTo } from '../utils/router';

const QuestionImport = React.lazy(() => import('./QuestionImport'));
const ChapterQuestionGenerator = React.lazy(() => import('./ChapterQuestionGenerator'));
const AiFileIngest = React.lazy(() => import('./AiFileIngest'));

const TABS = [
  { id: 'manual', label: 'ייבוא ידני', sub: 'טקסט · Word · PDF · CSV/JSON' },
  { id: 'chapter', label: 'יצירת שאלות מפרק (AI)', sub: 'הדבקת פרק → שאלות' },
  { id: 'file', label: 'קליטת קובץ (AI)', sub: 'XLSX/CSV עם תיוג אוטומטי' },
];

export default function QuestionImportHub({ initialTab = 'manual' }) {
  const [activeTab, setActiveTab] = useState(
    TABS.some((t) => t.id === initialTab) ? initialTab : 'manual'
  );

  return (
    <div style={styles.page} dir="rtl">
      <header style={styles.header}>
        <h1 style={styles.title}>ייבוא שאלות</h1>
        <p style={styles.subtitle}>
          כל דרכי הייבוא במקום אחד — בחרו לשונית לפי מקור השאלות. אפשר לערוך ולאשר כל שאלה לפני שמירה.
        </p>
      </header>

      <div style={styles.tabs} role="tablist" aria-label="סוגי ייבוא">
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(t.id)}
              style={{ ...styles.tab, ...(active ? styles.tabActive : {}) }}
            >
              <span style={styles.tabLabel}>{t.label}</span>
              <span style={styles.tabSub}>{t.sub}</span>
            </button>
          );
        })}
      </div>

      <div style={styles.panel}>
        <Suspense fallback={<LoadingSpinner message="טוען…" />}>
          {activeTab === 'manual' && (
            <QuestionImport onImportComplete={(results) => {
              if (results?.successful > 0) navigateTo('/instructor/questions');
            }} />
          )}
          {activeTab === 'chapter' && <ChapterQuestionGenerator />}
          {activeTab === 'file' && <AiFileIngest />}
        </Suspense>
      </div>
    </div>
  );
}

const styles = {
  page: { maxWidth: 1200, margin: '0 auto', padding: '8px 0 24px', color: 'var(--color-text)' },
  header: { marginBottom: 16 },
  title: { fontSize: 26, fontWeight: 800, margin: 0 },
  subtitle: { color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.6, fontSize: 14 },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '2px solid var(--color-border)', marginBottom: 20 },
  tab: {
    display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start',
    padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
    borderBottom: '3px solid transparent', marginBottom: '-2px', fontFamily: 'inherit',
    color: 'var(--color-text-muted)', textAlign: 'right',
  },
  tabActive: { color: 'var(--mda-red)', borderBottomColor: 'var(--mda-red)' },
  tabLabel: { fontSize: 15, fontWeight: 700 },
  tabSub: { fontSize: 11, opacity: 0.8 },
  panel: { minHeight: 300 },
};
