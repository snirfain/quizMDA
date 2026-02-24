/**
 * Help Page
 * FAQ, user guide, and support
 * Hebrew: עמוד עזרה
 */

import React, { useState } from 'react';
import SearchBar from '../components/SearchBar';

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState(new Set());

  const faq = [
    {
      category: 'תחילת עבודה',
      questions: [
        {
          q: 'איך מתחילים לתרגל?',
          a: 'לחץ על "תרגול" בתפריט הראשי. המערכת תציג לך שאלות בהתאם לרמה שלך.'
        },
        {
          q: 'איך בוחרים נושא ספציפי?',
          a: 'במסך התרגול, לחץ על "סינון נושאים" ובחר קטגוריה או נושא.'
        }
      ]
    },
    {
      category: 'התקדמות',
      questions: [
        {
          q: 'איך רואים את ההתקדמות שלי?',
          a: 'לחץ על "התקדמות" בתפריט. שם תראה סטטיסטיקות מפורטות.'
        },
        {
          q: 'מה זה רצף ימים?',
          a: 'רצף ימים הוא מספר הימים הרצופים שבהם תרגלת במערכת.'
        }
      ]
    },
    {
      category: 'שאלות פתוחות',
      questions: [
        {
          q: 'איך עונים על שאלות פתוחות?',
          a: 'הקלד את תשובתך בתיבה. המערכת תשלח את התשובה לבוט לבדיקה.'
        }
      ]
    }
  ];

  const keyboardShortcuts = [
    { key: 'Esc', description: 'סגור חלון/תפריט' },
    { key: 'Tab', description: 'נווט קדימה' },
    { key: 'Shift+Tab', description: 'נווט אחורה' },
    { key: 'Enter/Space', description: 'הפעל כפתור' },
    { key: '/', description: 'פוקוס על חיפוש' }
  ];

  const toggleSection = (category) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedSections(newExpanded);
  };

  const filteredFaq = faq.map(category => ({
    ...category,
    questions: category.questions.filter(q => 
      q.q.includes(searchQuery) || q.a.includes(searchQuery)
    )
  })).filter(category => category.questions.length > 0);

  return (
    <div>
      <div style={styles.container}>
        <h1 style={styles.title}>עזרה ותמיכה</h1>

        <div style={styles.searchSection}>
          <SearchBar
            onSearch={setSearchQuery}
            placeholder="חפש בעזרה..."
          />
        </div>

        <div style={styles.content}>
          <section style={styles.section} aria-labelledby="faq-heading">
            <h2 id="faq-heading" style={styles.sectionTitle}>
              שאלות נפוצות
            </h2>
            
            {filteredFaq.map((category, catIndex) => (
              <div key={catIndex} style={styles.category}>
                <button
                  style={styles.categoryHeader}
                  onClick={() => toggleSection(category.category)}
                  aria-expanded={expandedSections.has(category.category)}
                  aria-controls={`category-${catIndex}`}
                >
                  <span>{category.category}</span>
                  <span aria-hidden="true">
                    {expandedSections.has(category.category) ? '▼' : '▶'}
                  </span>
                </button>
                
                {expandedSections.has(category.category) && (
                  <div id={`category-${catIndex}`} style={styles.questions}>
                    {category.questions.map((item, qIndex) => (
                      <div key={qIndex} style={styles.questionItem}>
                        <h3 style={styles.question}>{item.q}</h3>
                        <p style={styles.answer}>{item.a}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>

          <section style={styles.section} aria-labelledby="shortcuts-heading">
            <h2 id="shortcuts-heading" style={styles.sectionTitle}>
              קיצורי מקלדת
            </h2>
            <div style={styles.shortcutsList}>
              {keyboardShortcuts.map((shortcut, index) => (
                <div key={index} style={styles.shortcutItem}>
                  <kbd style={styles.key}>{shortcut.key}</kbd>
                  <span style={styles.shortcutDesc}>{shortcut.description}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={styles.section} aria-labelledby="contact-heading">
            <h2 id="contact-heading" style={styles.sectionTitle}>
              יצירת קשר
            </h2>
            <p style={styles.contactText}>
              לשאלות נוספות או בעיות טכניות, אנא פנה למנהל המערכת.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px'
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '30px',
    color: '#212121'
  },
  searchSection: {
    marginBottom: '40px'
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '30px'
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#212121'
  },
  category: {
    marginBottom: '16px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  categoryHeader: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#f5f5f5',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    textAlign: 'right',
    '&:hover': {
      backgroundColor: '#eeeeee'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '-2px'
    }
  },
  questions: {
    padding: '16px'
  },
  questionItem: {
    marginBottom: '20px',
    paddingBottom: '20px',
    borderBottom: '1px solid #f5f5f5',
    '&:last-child': {
      borderBottom: 'none',
      marginBottom: 0,
      paddingBottom: 0
    }
  },
  question: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#212121'
  },
  answer: {
    fontSize: '14px',
    lineHeight: 1.6,
    color: '#757575'
  },
  shortcutsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  shortcutItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px'
  },
  key: {
    padding: '4px 8px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    minWidth: '60px',
    textAlign: 'center'
  },
  shortcutDesc: {
    fontSize: '14px',
    color: '#212121'
  },
  contactText: {
    fontSize: '14px',
    lineHeight: 1.6,
    color: '#757575'
  }
};
