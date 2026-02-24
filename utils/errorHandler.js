/**
 * Centralized Error Handler
 * Hebrew: טיפול בשגיאות
 */

/**
 * Handle and log errors
 */
export function handleError(error, context = '') {
  const errorInfo = {
    message: error.message || 'Unknown error',
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  };

  // Log to console (in production, send to logging service)
  console.error('Error:', errorInfo);

  // Return user-friendly error message in Hebrew
  return {
    userMessage: getUserFriendlyError(error),
    technicalMessage: error.message,
    context
  };
}

/**
 * Get user-friendly error message in Hebrew
 */
function getUserFriendlyError(error) {
  const errorMessages = {
    'User not found': 'משתמש לא נמצא',
    'Question not found': 'שאלה לא נמצאה',
    'Plan not found': 'תוכנית לא נמצאה',
    'User not enrolled in this plan': 'המשתמש לא רשום לתוכנית זו',
    'Notification not found': 'התראה לא נמצאה',
    'Note not found': 'הערה לא נמצאה'
  };

  return errorMessages[error.message] || 'אירעה שגיאה. אנא נסה שוב מאוחר יותר.';
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      return handleError(error, fn.name);
    }
  };
}
