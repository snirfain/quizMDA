/**
 * Data Import/Export Workflow
 * General data import/export functionality
 * Hebrew: ייבוא וייצוא נתונים כללי
 */

import * as XLSX from 'xlsx';
import { entities } from '../config/appConfig';
import { validateQuestion } from '../utils/questionValidation';
import { applyQuestionImportDefaults } from './questionImport.js';

/**
 * Export questions to various formats
 * @param {string} format - Export format: 'csv', 'json', 'excel'
 * @param {Object} filters - Filters to apply
 * @returns {Promise<Blob>} Exported data as Blob
 */
export async function exportQuestions(format, filters = {}) {
  try {
    // Get questions based on filters
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.category) query.category = filters.category;
    if (filters.questionType) query.question_type = filters.questionType;

    const questions = await entities.Question_Bank.find(query);

    switch (format) {
      case 'csv':
        return exportToCSV(questions);
      case 'json':
        return exportToJSON(questions);
      case 'excel':
        return exportToExcel(questions);
      default:
        throw new Error(`פורמט לא נתמך: ${format}`);
    }
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}

/**
 * Export to CSV format
 */
function exportToCSV(questions) {
  if (questions.length === 0) {
    throw new Error('אין שאלות לייצוא');
  }

  const headers = [
    'ID',
    'category',
    'sub_category',
    'thinking_level',
    'training_level',
    'medical_levels',
    'Question Type',
    'case_name',
    'Question Text',
    'Options',
    'Correct Answer',
    'Status',
    'has_media',
    'media_bank_tag',
    'rolling_case',
    'Hint',
    'Explanation',
    'Attempts',
    'Success',
    'Success rate',
    'Created At',
    'Updated At',
  ];

  const rows = questions.map((q) => [
    q.id || '',
    q.category || '',
    q.sub_category || '',
    q.thinking_level || '',
    q.training_level || '',
    Array.isArray(q.medical_levels) ? q.medical_levels.join('|') : '',
    q.question_type || '',
    q.case_name || '',
    (q.question_text || '').replace(/"/g, '""'),
    q.options ? JSON.stringify(q.options) : '',
    q.correct_answer || '',
    q.status || '',
    q.has_media ? '1' : '0',
    q.media_bank_tag ?? '',
    q.rolling_case ? JSON.stringify(q.rolling_case) : '',
    q.hint || '',
    q.explanation || '',
    typeof q.total_attempts === 'number' ? q.total_attempts : '',
    typeof q.total_success === 'number' ? q.total_success : '',
    typeof q.success_rate === 'number' ? q.success_rate : '',
    q.createdAt ? new Date(q.createdAt).toISOString() : '',
    q.updatedAt ? new Date(q.updatedAt).toISOString() : '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  return blob;
}

/**
 * Export to JSON format
 */
function exportToJSON(questions) {
  const jsonContent = JSON.stringify(questions, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  return blob;
}

/**
 * Export to Excel format (.xlsx) with all question fields
 */
function exportToExcel(questions) {
  if (questions.length === 0) throw new Error('אין שאלות לייצוא');
  const safe = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  const headers = [
    'ID',
    'קטגוריה',
    'תת־קטגוריה',
    'רמת חשיבה',
    'הכשרה',
    'רמות רפואיות',
    'סוג שאלה',
    'שם מקרה',
    'טקסט השאלה',
    'אפשרויות',
    'תשובה נכונה',
    'הסבר',
    'רמז',
    'סטטוס',
    'מדיה',
    'קובץ מדיה',
    'תג מאגר מדיה',
    'rolling_case',
    'ניסיונות',
    'הצלחות',
    'אחוז הצלחה',
    'נוצר',
    'עודכן',
  ];
  const rows = questions.map((q) => [
    safe(q.id),
    safe(q.category),
    safe(q.sub_category),
    safe(q.thinking_level),
    safe(q.training_level),
    Array.isArray(q.medical_levels) ? q.medical_levels.join('|') : '',
    safe(q.question_type),
    safe(q.case_name),
    safe(q.question_text),
    Array.isArray(q.options) ? q.options.map((o) => `${o.value};${o.label || ''}`).join(' | ') : '',
    safe(q.correct_answer),
    safe(q.explanation),
    safe(q.hint),
    safe(q.status),
    q.has_media ? 'כן' : 'לא',
    safe(q.media_attachment),
    safe(q.media_bank_tag),
    safe(q.rolling_case),
    typeof q.total_attempts === 'number' ? q.total_attempts : '',
    typeof q.total_success === 'number' ? q.total_success : '',
    typeof q.success_rate === 'number' ? q.success_rate : '',
    q.createdAt ? new Date(q.createdAt).toISOString() : '',
    q.updatedAt ? new Date(q.updatedAt).toISOString() : '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'שאלות');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Import questions from file
 * @param {File} file - File to import
 * @param {string} format - File format: 'csv', 'json'
 * @returns {Promise<Object>} Import results
 */
export async function importQuestionsFromFile(file, format) {
  try {
    const fileContent = await readFileContent(file);
    
    let questions = [];
    if (format === 'csv') {
      const { parseCSV } = await import('./questionImport');
      questions = parseCSV(fileContent);
    } else if (format === 'json') {
      const { parseJSON } = await import('./questionImport');
      questions = parseJSON(fileContent);
    } else {
      throw new Error(`פורמט לא נתמך: ${format}`);
    }

    // Validate all questions
    const validationResults = await validateImportData(questions);

    if (validationResults.errors.length > 0) {
      return {
        success: false,
        successful: 0,
        failed: questions.length,
        errors: validationResults.errors
      };
    }

    // Import valid questions
    const importResults = await bulkImportQuestions(validationResults.valid);

    return {
      success: true,
      successful: importResults.successful,
      failed: importResults.failed,
      errors: importResults.errors
    };
  } catch (error) {
    console.error('Import error:', error);
    throw error;
  }
}

/**
 * Validate import data
 * @param {Array} questions - Questions to validate
 * @returns {Promise<Object>} Validation results
 */
export async function validateImportData(questions) {
  const valid = [];
  const errors = [];

  for (let i = 0; i < questions.length; i++) {
    const normalized = applyQuestionImportDefaults(questions[i], {});
    const { isValid, errors: qErrors } = validateQuestion(normalized);

    if (isValid) {
      valid.push(normalized);
    } else {
      errors.push({
        row: i + 1,
        question: normalized.question_text || 'לא מוגדר',
        errors: qErrors,
      });
    }
  }

  return { valid, errors };
}

/**
 * Bulk import questions
 * @param {Array} questions - Valid questions to import
 * @returns {Promise<Object>} Import results
 */
async function bulkImportQuestions(questions) {
  let successful = 0;
  let failed = 0;
  const errors = [];

  for (const question of questions) {
    try {
      // Check if question already exists (by text or ID)
      const existing = await entities.Question_Bank.findOne({
        $or: [
          { id: question.id },
          { question_text: question.question_text }
        ]
      });

      if (existing) {
        // Update existing question
        await entities.Question_Bank.update(existing.id, {
          ...question,
          updatedAt: new Date()
        });
      } else {
        // Create new question
        await entities.Question_Bank.create({
          ...question,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      successful++;
    } catch (error) {
      failed++;
      errors.push({
        question: question.question_text || 'לא מוגדר',
        error: error.message
      });
    }
  }

  return { successful, failed, errors };
}

/**
 * Read file content as text
 */
function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

/**
 * Export user activity data
 * @param {Object} filters - Filters to apply
 * @returns {Promise<Blob>} Exported data
 */
export async function exportActivityData(filters = {}) {
  try {
    const query = {};
    if (filters.userId) query.user_id = filters.userId;
    if (filters.startDate) query.timestamp = { $gte: new Date(filters.startDate) };
    if (filters.endDate) {
      query.timestamp = {
        ...query.timestamp,
        $lte: new Date(filters.endDate)
      };
    }

    const activities = await entities.Activity_Log.find(query);

    const jsonContent = JSON.stringify(activities, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    return blob;
  } catch (error) {
    console.error('Export activity error:', error);
    throw error;
  }
}

/**
 * Export statistics data
 * @param {Object} filters - Filters to apply
 * @returns {Promise<Blob>} Exported data
 */
export async function exportStatisticsData(filters = {}) {
  try {
    // This would aggregate statistics data
    // For now, return empty blob
    const data = {
      timestamp: new Date().toISOString(),
      filters,
      statistics: {}
    };

    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    return blob;
  } catch (error) {
    console.error('Export statistics error:', error);
    throw error;
  }
}
