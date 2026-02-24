# API Documentation
## תיעוד API

## Backend Functions

### Suspension Logic

#### `checkAndSuspendQuestion(questionId)`

Recalculates statistics and suspends question if thresholds are met.

**Parameters:**
- `questionId` (string): ID of the question to check

**Returns:**
```javascript
{
  suspended: boolean,
  successRate: number,
  totalAttempts: number
}
```

**Usage:**
```javascript
import { checkAndSuspendQuestion } from './workflows/suspensionLogic';

const result = await checkAndSuspendQuestion('question-123');
```

---

### Adaptive Practice Engine

#### `getAdaptiveQuestions(userId, hierarchyFilters)`

Gets questions prioritized by mistakes and new material.

**Parameters:**
- `userId` (string): User ID
- `hierarchyFilters` (object, optional): `{ category_name?, topic_name? }`

**Returns:**
```javascript
{
  questions: Array<Question>,
  stats: {
    mistakes: number,
    new: number,
    review: number,
    total: number
  }
}
```

**Usage:**
```javascript
import { getAdaptiveQuestions } from './workflows/adaptivePracticeEngine';

const result = await getAdaptiveQuestions('user-123', {
  category_name: 'חירום רפואי'
});
```

#### `getNextPracticeQuestion(userId, hierarchyFilters)`

Gets the next question for practice (highest priority).

**Parameters:**
- `userId` (string): User ID
- `hierarchyFilters` (object, optional): Filter options

**Returns:**
- `Question` object or `null` if no questions available

#### `getPracticeSession(userId, count, hierarchyFilters)`

Gets a practice session with multiple questions.

**Parameters:**
- `userId` (string): User ID
- `count` (number, default: 10): Number of questions
- `hierarchyFilters` (object, optional): Filter options

**Returns:**
```javascript
{
  questions: Array<Question>,
  stats: { mistakes, new, review, total }
}
```

---

### Open-Ended Validation

#### `validateOpenEndedAnswer(questionId, userAnswerText)`

Sends answer to external bot for validation.

**Parameters:**
- `questionId` (string): Question ID
- `userAnswerText` (string): User's answer

**Returns:**
```javascript
{
  success: boolean,
  bot_feedback: string,
  score: number | null,
  suggestions: Array<string>
}
```

**Usage:**
```javascript
import { validateOpenEndedAnswer } from './workflows/openEndedValidation';

const result = await validateOpenEndedAnswer('q-123', 'תשובת המשתמש');
```

#### `saveOpenEndedAnswer(userId, questionId, userAnswerText, selfAssessment)`

Saves open-ended answer with bot feedback.

**Parameters:**
- `userId` (string): User ID
- `questionId` (string): Question ID
- `userAnswerText` (string): User's answer
- `selfAssessment` (boolean, default: false): User's self-assessment

**Returns:**
```javascript
{
  logEntry: Activity_Log,
  botFeedback: string,
  isCorrect: boolean
}
```

---

### Test Generator

#### `generateRandomTest(filters)`

Generates a random test based on filters.

**Parameters:**
```javascript
{
  category_name?: string,
  topic_name?: string,
  difficulty_min?: number (1-10),
  difficulty_max?: number (1-10),
  question_types?: Array<string>,
  count?: number (default: 20)
}
```

**Returns:**
```javascript
{
  questions: Array<Question>,
  totalAvailable: number,
  selected: number,
  filters: object
}
```

**Usage:**
```javascript
import { generateRandomTest } from './workflows/testGenerator';

const test = await generateRandomTest({
  category_name: 'חירום רפואי',
  difficulty_min: 5,
  difficulty_max: 10,
  count: 25
});
```

#### `exportTestToPDF(testQuestions, testMetadata)`

Prepares test data for PDF export.

**Parameters:**
- `testQuestions` (Array): Questions to export
- `testMetadata` (object): `{ title?, instructor_name?, date?, time_limit? }`

**Returns:**
```javascript
{
  success: boolean,
  pdfData: object,
  message: string
}
```

#### `getFilterOptions()`

Gets available filter options for UI.

**Returns:**
```javascript
{
  categories: Array<string>,
  topics: Array<string>,
  question_types: Array<{value, label}>,
  difficulty_range: { min: number, max: number }
}
```

---

### Manager Dashboard

#### `getSuspendedQuestions(filters)`

Gets all suspended questions with details.

**Parameters:**
```javascript
{
  category_name?: string,
  topic_name?: string,
  min_attempts?: number (default: 0),
  max_success_rate?: number (default: 70)
}
```

**Returns:**
```javascript
{
  questions: Array<Question>,
  total: number,
  stats: {
    avg_success_rate: number,
    avg_attempts: number
  }
}
```

#### `reactivateQuestion(questionId, reason)`

Reactivates a suspended question.

**Parameters:**
- `questionId` (string): Question ID
- `reason` (string, optional): Reason for reactivation

**Returns:**
```javascript
{
  success: boolean,
  question: Question
}
```

#### `bulkReactivateQuestions(questionIds, reason)`

Reactivates multiple questions.

**Parameters:**
- `questionIds` (Array<string>): Array of question IDs
- `reason` (string, optional): Reason for reactivation

**Returns:**
```javascript
{
  total: number,
  successful: number,
  failed: number,
  results: Array<{questionId, success, ...}>
}
```

#### `getSuspensionStats()`

Gets overall suspension statistics.

**Returns:**
```javascript
{
  total: number,
  active: number,
  suspended: number,
  draft: number,
  suspended_by_type: object,
  avg_success_rate_suspended: number
}
```

---

## Entity Schemas

### Content_Hierarchy

```javascript
{
  id: string,
  category_name: string,
  topic_name: string,
  lesson_source?: string,
  createdAt: Date,
  updatedAt: Date
}
```

### Question_Bank

```javascript
{
  id: string,
  hierarchy_id: string (reference),
  question_type: 'single_choice' | 'multi_choice' | 'true_false' | 'open_ended',
  question_text: string (rich text),
  media_attachment?: File,
  difficulty_level: number (1-10),
  correct_answer?: string (JSON),
  status: 'active' | 'draft' | 'suspended',
  total_attempts: number,
  total_success: number,
  success_rate: number,
  createdAt: Date,
  updatedAt: Date
}
```

### Users

```javascript
{
  user_id: string (primary key),
  full_name: string,
  role: 'trainee' | 'instructor' | 'admin',
  createdAt: Date,
  updatedAt: Date
}
```

### Activity_Log

```javascript
{
  log_id: string,
  user_id: string (reference),
  question_id: string (reference),
  timestamp: Date,
  user_answer: string,
  is_correct: boolean,
  bot_feedback?: string,
  self_assessment?: boolean
}
```

---

## Error Handling

All functions throw errors that should be caught:

```javascript
try {
  const result = await someFunction();
} catch (error) {
  console.error('Error:', error.message);
  // Handle error appropriately
}
```

Common error messages:
- `'Question not found'` - Invalid question ID
- `'User not found'` - Invalid user ID
- `'No matching content found'` - No hierarchies match filters
- `'No questions match the selected filters'` - No questions available
- `'Bot API error: ...'` - External API failure
