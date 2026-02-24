/**
 * Smart Question Parser — supports a wide variety of exam formats.
 * Hebrew: מנתח שאלות חכם
 *
 * Numbered format (parseTextQuestions):
 *   Question start: 1. 1) (1) 1- 1 . שאלה 1 Question 1
 *   Options: א. ב. א) - א • א  a. b.  1. 2. (in options context)
 *   Meta: תשובה נכונה: א / התשובה: 2, רמז:, הסבר:
 *
 * Unnumbered / DOCX (parseUnnumberedBlocks):
 *   Blocks separated by blank lines; question line + 2–8 option lines (no prefix).
 *   Optional last line: תשובה נכונה: א. True/false when options are נכון/לא נכון.
 */

const HEBREW_LETTER_TO_IDX = { א: 0, ב: 1, ג: 2, ד: 3, ה: 4, ו: 5, ז: 6, ח: 7, ט: 8, י: 9 };
const ENG_LETTER_TO_IDX    = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 };

// Regexes — diverse formats for max compatibility
/** Question start: 1. 1) (1) 1- 1 . שאלה 1 Question 1 */
const RE_QUESTION_ANY = /^(?:\d+[.)]\s*|\(\s*\d+\s*\)\s*|\d+\s*[.\-]\s*|\d+\s+\.\s*|שאלה\s*\d*\s*|question\s*\d*\s*)(.+)$/i;
const RE_QUESTION_START = /^(\d+)[.)]\s+(.+)/; // legacy + primary
const RE_HEBREW_OPTION = /^[•\-*\s]*([אבגדהוזחטי])[.)\-\s]\s*(.*)/;  // "א. אופציה" "א) " "- א " "• א."
const RE_ENG_OPTION = /^[•\-*\s]*([a-fA-F])[.)\-\s]\s*(.*)/i;
const RE_NUM_OPTION = /^[•\-*\s]*([1-9])[.)\-\s]\s*(.*)/;  // "1. option" in options context
const RE_CORRECT_ANSWER = /^(תשובה\s*נכונה?|תשובות?\s*נכונות?|התשובה(?:\s*הנכונה\s*היא)?|answer|correct\s*answer)[:\s]*(.*)$/i;
const RE_TRUE_FALSE_IN_Q = /\(\s*(נכון|לא\s*נכון|true|false)\s*\)/i;
const RE_MULTI_INDICATOR = /\(בחר\s+(את\s+)?(כל|[23])|multiple|select\s+all/i;
const RE_HINT = /^(רמז|hint)[:\s]+(.+)/i;
const RE_EXPLANATION = /^(הסבר|explanation)[:\s]+(.+)/i;

/**
 * Split raw text into blocks — one block per question.
 * Recognises: 1. 1) (1) 1- 1 . שאלה 1 Question 1
 */
function splitIntoBlocks(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const blocks = [];
  let current = [];

  for (const line of lines) {
    const isNewQ = RE_QUESTION_ANY.test(line) || RE_QUESTION_START.test(line);
    if (isNewQ && current.length > 0) {
      blocks.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current);

  if (blocks.length === 1 && !RE_QUESTION_ANY.test(blocks[0][0]) && !RE_QUESTION_START.test(blocks[0][0])) {
    return [lines];
  }

  return blocks;
}

/**
 * Parse a single block of lines into a question object
 */
function parseBlock(lines) {
  const q = {
    question_text: '',
    question_type: 'open_ended',
    options: [],          // [{text, label}]
    _correct_raw: '',     // raw correct answer text (resolved later)
    hint: '',
    explanation: '',
    difficulty_level: 5,
    status: 'active',
    tags: [],
  };

  let questionTextLines = [];
  let inOptions = false;
  let isMultiHinted = false;

  for (const line of lines) {
    // Question number/prefix — support 1. 1) (1) 1- 1 . שאלה 1
    const qStart = line.match(RE_QUESTION_START);
    const qAny = line.match(RE_QUESTION_ANY);
    if (qStart) {
      questionTextLines.push(qStart[2]);
      if (RE_MULTI_INDICATOR.test(qStart[2])) isMultiHinted = true;
      continue;
    }
    if (qAny && qAny[1]) {
      questionTextLines.push(qAny[1]);
      if (RE_MULTI_INDICATOR.test(qAny[1])) isMultiHinted = true;
      continue;
    }

    // Correct answer marker (תשובה נכונה: א / התשובה הנכונה היא: ... when value on same line)
    const correctMatch = line.match(RE_CORRECT_ANSWER);
    if (correctMatch) {
      const raw = (correctMatch[2] || '').trim();
      if (raw) q._correct_raw = raw;
      continue;
    }

    // Hint
    const hintMatch = line.match(RE_HINT);
    if (hintMatch) { q.hint = hintMatch[2].trim(); continue; }

    // Explanation
    const explMatch = line.match(RE_EXPLANATION);
    if (explMatch) { q.explanation = explMatch[2].trim(); continue; }

    // Hebrew option
    const hebrewOpt = line.match(RE_HEBREW_OPTION);
    if (hebrewOpt) {
      inOptions = true;
      q.options.push({ text: hebrewOpt[2].trim(), label: hebrewOpt[1] });
      continue;
    }

    // English option
    const engOpt = line.match(RE_ENG_OPTION);
    if (engOpt) {
      inOptions = true;
      q.options.push({ text: engOpt[2].trim(), label: engOpt[1].toLowerCase() });
      continue;
    }

    // Numbered option — only inside an options context to avoid confusing with question numbers
    if (inOptions) {
      const numOpt = line.match(RE_NUM_OPTION);
      if (numOpt) {
        q.options.push({ text: numOpt[2].trim(), label: numOpt[1] });
        continue;
      }
    }

    // Multi indicator in standalone line
    if (RE_MULTI_INDICATOR.test(line)) { isMultiHinted = true; continue; }

    // Not an option — append to question text (if we haven't entered options yet)
    if (!inOptions) {
      questionTextLines.push(line);
    }
  }

  q.question_text = questionTextLines.join(' ').trim();

  // Determine question type
  if (q.options.length >= 2) {
    const multiMarker = isMultiHinted ||
      (q._correct_raw && /[,،וגם]/.test(q._correct_raw));
    q.question_type = multiMarker ? 'multi_choice' : 'single_choice';
  } else if (RE_TRUE_FALSE_IN_Q.test(q.question_text) ||
             /^(נכון|לא\s*נכון|true|false)$/i.test(q._correct_raw)) {
    q.question_type = 'true_false';
  }

  // Build structured correct_answer JSON
  q.correct_answer = buildCorrectAnswer(q._correct_raw, q.options, q.question_type);
  delete q._correct_raw;

  return q;
}

/**
 * Convert raw answer text into the app's correct_answer JSON format
 */
function buildCorrectAnswer(rawAnswer, options, type) {
  if (type === 'true_false') {
    const isTrue = /^(נכון|true|כן|yes|1)$/i.test(rawAnswer.trim());
    return JSON.stringify({ value: isTrue ? 'true' : 'false' });
  }

  if (type === 'single_choice' || type === 'multi_choice') {
    const optionObjects = options.map((o, i) => ({ value: String(i), label: o.text }));

    if (type === 'multi_choice') {
      // Parse comma/slash/ו separated answers
      const parts = rawAnswer.split(/[,،+\s/וגם]+/).map(p => p.trim()).filter(Boolean);
      const values = parts.map(p => resolveOptionIndex(p, options)).filter(v => v !== null);
      return JSON.stringify({ values: values.length ? values : ['0'], options: optionObjects });
    }

    // Single choice
    const idx = resolveOptionIndex(rawAnswer, options);
    return JSON.stringify({ value: idx !== null ? String(idx) : '0', options: optionObjects });
  }

  // Open ended
  return JSON.stringify({ value: rawAnswer });
}

/**
 * Resolve a text answer reference (letter/number/text) to an option index.
 * Supports: א ב ג, א' ב', a b c, 1 2 3 (1-indexed), and partial text match.
 */
function resolveOptionIndex(answer, options) {
  const a = answer.trim().replace(/['׳]/g, ''); // normalize geresh

  const hebrewLetter = a.match(/^([אבגדהוזחטי])/);
  if (hebrewLetter) {
    const idx = HEBREW_LETTER_TO_IDX[hebrewLetter[1]];
    return idx !== undefined ? idx : null;
  }

  const engLetter = a.match(/^([a-fA-F])/);
  if (engLetter) {
    const idx = ENG_LETTER_TO_IDX[engLetter[1].toLowerCase()];
    return idx !== undefined ? idx : null;
  }

  const num = a.match(/^(\d+)/);
  if (num) {
    const n = parseInt(num[1]);
    return n >= 1 && n <= options.length ? n - 1 : null;
  }

  const textIdx = options.findIndex(o => {
    const ot = (o.text || '').trim();
    return ot && (ot.includes(a) || a.includes(ot) || ot.slice(0, 30) === a.slice(0, 30));
  });
  return textIdx >= 0 ? textIdx : null;
}

const HEBREW_OPTION_LABELS = 'אבגדהוזחטי';
const MAX_OPTIONS_UNNUMBERED = 8;
const TRUE_FALSE_OPTIONS = [
  /^נכון\s*$/i, /^לא\s*נכון\s*$/i, /^true\s*$/i, /^false\s*$/i,
  /^כן\s*$/i, /^לא\s*$/i,
];

/**
 * When there are no paragraph breaks, split dense text by "new question" boundaries
 * so we don't merge many questions into one. Matches: "תשובות א+ג נכונות", "מיהו...", "נקראת...", etc.
 * Works even when text is one long run-on paragraph (no newlines).
 * @param {string} text
 * @returns {string[]} segments (each ideally one question + options)
 */
function splitByQuestionBoundaries(text) {
  if (!text || text.length < 200) return [text].filter(Boolean);

  // After "תשובות א + ג נכונות" the next sentence is a new question — insert boundary
  const withBreaks = text.replace(
    /(תשובות?\s*[אבגד]\s*\+[^\n.]{0,25}נכונות)\s+/gi,
    (m) => m + '\n\n'
  );

  // New-question starters: at start, after newline, after space, or after period+space (". מיהו")
  // Expanded for Master / Final_Master_Questions_Full style docs (medical exam phrases)
  const questionStartRe = /(?:^|[\n\s]|\.\s+)(מיהו|איזה|מה\s|איזו|הנך|נקראת|נחשב|הערכת|ביצוע|מבין|ערכת|קוצב|הפרמטר|לחץ\s*דם\s*קבוע|מתקיים|סמן|מהי|מהם|הגדר|בהתאם|באיזה|במקרה|חולה|פצוע|טיפול|סימן|תסמין|בדיקה|מתן|מינון|הנחיה|המלצה)\s*/gi;
  const indices = [];
  let match;
  while ((match = questionStartRe.exec(withBreaks)) !== null) {
    const startOfWord = match[0].indexOf(match[1]);
    const startPos = startOfWord >= 0 ? match.index + startOfWord : match.index;
    if (indices[indices.length - 1] !== startPos) indices.push(startPos);
  }
  if (indices.length > 0 && indices[0] !== 0) indices.unshift(0);
  const segments = [];
  for (let j = 0; j < indices.length; j++) {
    const seg = withBreaks.slice(indices[j], indices[j + 1] || withBreaks.length).trim();
    if (seg.length > 10) segments.push(seg);
  }

  if (segments.length >= 2) return segments;
  return [text.trim()].filter(Boolean);
}


/**
 * Strip optional bullet/dash at start of a line (for option text).
 */
function stripOptionPrefix(line) {
  return (line || '').replace(/^[•\-*]\s*/, '').trim();
}

/**
 * Check if two option texts look like true/false.
 */
function looksLikeTrueFalse(opts) {
  if (!opts || opts.length !== 2) return false;
  const a = stripOptionPrefix(opts[0]).trim();
  const b = stripOptionPrefix(opts[1]).trim();
  return TRUE_FALSE_OPTIONS.some(r => r.test(a)) && TRUE_FALSE_OPTIONS.some(r => r.test(b));
}

/**
 * Parse DOCX-style text with no "1." numbering.
 * Supports: one question per paragraph block; mammoth one-line-per-para; answer key line; true/false.
 * @param {string} text - Raw text (e.g. from mammoth extractRawText)
 * @returns {Array} - Question objects { question_text, options, correct_answer, question_type, ... }
 */
export function parseUnnumberedBlocks(text) {
  if (!text || !text.trim()) return [];

  let blocks = text.split(/\n\n+/).map(b => b.trim()).filter(b => b.length > 0);

  // When text is long, split by question boundaries so we don't merge many questions into one.
  if (text.length > 800) {
    const segments = splitByQuestionBoundaries(text);
    if (segments.length >= 2) blocks = segments;
  }

  const questions = [];

  function looksLikeQuestion(line) {
    if (!line || line.length < 10) return false;
    if (/^(מבחן|שאלות למבחן|חלק עיוני|שלב|תשובות?)\s/i.test(line)) return false;
    return line.length > 35 || line.includes('?') || /[\u05D0-\u05FF]{20,}/.test(line);
  }

  function looksLikeOption(line) {
    if (!line || line.length > 250) return false;
    if (/^(שאלה|תשובה\s*נכונה|התשובה|תשובות?)\s*[\d:]/i.test(line)) return false;
    return true;
  }

  /** Parse "תשובה נכונה: א" / "התשובה: 2" from last line; return { rawAnswer, optionLinesWithoutLast }. */
  function takeAnswerFromBlock(lines) {
    if (lines.length < 2) return { rawAnswer: '', optionLines: lines };
    const last = lines[lines.length - 1];
    const correctMatch = last.match(RE_CORRECT_ANSWER);
    if (correctMatch) {
      return { rawAnswer: correctMatch[2].trim(), optionLines: lines.slice(0, -1) };
    }
    return { rawAnswer: '', optionLines: lines };
  }

  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    const linesInBlock = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const first = linesInBlock[0];

    // Single-line blocks: question then next blocks = options (mammoth one-line-per-para)
    if (linesInBlock.length === 1) {
      if (!looksLikeQuestion(first)) {
        i++;
        continue;
      }
      if (/^(מבחן|שאלות למבחן|חלק עיוני)/i.test(first) && first.length < 60) {
        i++;
        continue;
      }
      const optionLines = [];
      let j = i + 1;
      while (j < blocks.length && optionLines.length < MAX_OPTIONS_UNNUMBERED) {
        const nextBlock = blocks[j];
        const nextLine = nextBlock.split('\n').map(l => l.trim()).filter(Boolean)[0];
        if (!nextLine) break;
        if (looksLikeQuestion(nextLine)) break;
        if (!looksLikeOption(nextLine)) break;
        optionLines.push(nextLine);
        j++;
      }
      const { rawAnswer, optionLines: finalOptionLines } = takeAnswerFromBlock(optionLines);
      if (finalOptionLines.length >= 2) {
        const optionTexts = finalOptionLines.map(stripOptionPrefix);
        const options = optionTexts.map((text, idx) => ({
          text,
          label: HEBREW_OPTION_LABELS[idx] ?? String(idx + 1),
        }));
        const isTrueFalse = looksLikeTrueFalse(optionTexts);
        const qType = isTrueFalse ? 'true_false' : 'single_choice';
        questions.push({
          question_text: first,
          question_type: qType,
          options,
          correct_answer: buildCorrectAnswer(rawAnswer, options, qType),
          hint: '',
          explanation: '',
          difficulty_level: 5,
          status: 'active',
          tags: [],
        });
        i = j;
        continue;
      }
      if (first.length > 25) {
        questions.push({
          question_text: first,
          question_type: 'open_ended',
          options: [],
          correct_answer: JSON.stringify({ value: '' }),
          hint: '',
          explanation: '',
          difficulty_level: 5,
          status: 'active',
          tags: [],
        });
      }
      i++;
      continue;
    }

    // Multi-line block: first line = question, rest = options (2–MAX), optional last line = answer key
    if (linesInBlock.length >= 3 && linesInBlock.length <= 14) {
      const qFirst = linesInBlock[0];
      if (/^תשובות?(\s*נכונות?)?\s*:?\s*$/i.test(qFirst)) {
        i++;
        continue;
      }
      const rest = linesInBlock.slice(1);
      const { rawAnswer, optionLines: optionLinesRaw } = takeAnswerFromBlock(rest);
      const optionTexts = optionLinesRaw.map(stripOptionPrefix);
      if (optionTexts.length >= 2) {
        const options = optionTexts.map((text, idx) => ({
          text,
          label: HEBREW_OPTION_LABELS[idx] ?? String(idx + 1),
        }));
        const isTrueFalse = looksLikeTrueFalse(optionTexts);
        const qType = isTrueFalse ? 'true_false' : 'single_choice';
        questions.push({
          question_text: qFirst,
          question_type: qType,
          options,
          correct_answer: buildCorrectAnswer(rawAnswer, options, qType),
          hint: '',
          explanation: '',
          difficulty_level: 5,
          status: 'active',
          tags: [],
        });
      } else if (qFirst.length > 20 && !/^(מבחן|שאלות)/i.test(qFirst)) {
        questions.push({
          question_text: qFirst,
          question_type: 'open_ended',
          options: [],
          correct_answer: JSON.stringify({ value: '' }),
          hint: '',
          explanation: '',
          difficulty_level: 5,
          status: 'active',
          tags: [],
        });
      }
    } else if (linesInBlock.length >= 1 && first.length > 20 && !/^(מבחן|שאלות)/i.test(first)) {
      questions.push({
        question_text: first,
        question_type: 'open_ended',
        options: [],
        correct_answer: JSON.stringify({ value: '' }),
        hint: '',
        explanation: '',
        difficulty_level: 5,
        status: 'active',
        tags: [],
      });
    }
    i++;
  }

  return questions;
}

/**
 * Main export — parse free text into an array of question objects
 * @param {string} text - Raw text containing questions
 * @returns {Array} - Array of question objects ready for preview/import
 */
/** First block is often exam title (e.g. "מבחן מסכם קרדיולוגיה-ק. פרמדיק אסה\"ר") — skip it. */
function isExamTitleLine(line) {
  if (!line || line.length > 120) return false;
  return /מבחן\s*מסכם|אסה"ר|פרמדיק\s*אסה|שאלות\s*למבחן\s*מסכם/i.test(line);
}

export function parseTextQuestions(text) {
  if (!text || !text.trim()) return [];

  const blocks = splitIntoBlocks(text);
  const questions = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.length === 0) continue;
    if (i === 0 && block[0] && isExamTitleLine(block[0].trim())) continue;
    try {
      const q = parseBlock(block);
      if (q.question_text && q.question_text.length > 3) {
        questions.push(q);
      }
    } catch (e) {
      console.warn('questionParser: failed to parse block', block, e);
    }
  }

  return questions;
}

/**
 * Get display label for question type
 */
export function getTypeLabel(type) {
  return {
    single_choice: 'בחירה יחידה',
    multi_choice: 'בחירה מרובה',
    true_false: 'נכון/לא נכון',
    open_ended: 'פתוחה',
  }[type] || type;
}

/**
 * Get type badge color
 */
export function getTypeColor(type) {
  return {
    single_choice: '#1976d2',
    multi_choice: '#7b1fa2',
    true_false: '#388e3c',
    open_ended: '#f57c00',
  }[type] || '#757575';
}
