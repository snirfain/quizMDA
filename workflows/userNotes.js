/**
 * User Notes Workflow
 * Manage user notes and bookmarks
 * Hebrew: הערות משתמש
 */

import { entities } from '../config/appConfig';

/**
 * Create a note
 */
export async function createNote(userId, questionId, noteText, isBookmark = false) {
  // Check if note already exists
  const existing = await entities.User_Notes.findOne({
    user_id: userId,
    question_id: questionId
  });

  if (existing) {
    // Update existing note
    return await entities.User_Notes.update(existing.note_id, {
      note_text: noteText,
      is_bookmark: isBookmark || existing.is_bookmark,
      updated_at: new Date()
    });
  }

  return await entities.User_Notes.create({
    user_id: userId,
    question_id: questionId,
    note_text: noteText,
    is_bookmark: isBookmark,
    created_at: new Date()
  });
}

/**
 * Update a note
 */
export async function updateNote(noteId, userId, noteText) {
  const note = await entities.User_Notes.findOne({
    note_id: noteId,
    user_id: userId
  });

  if (!note) {
    throw new Error('Note not found');
  }

  return await entities.User_Notes.update(noteId, {
    note_text: noteText,
    updated_at: new Date()
  });
}

/**
 * Delete a note
 */
export async function deleteNote(noteId, userId) {
  const note = await entities.User_Notes.findOne({
    note_id: noteId,
    user_id: userId
  });

  if (!note) {
    throw new Error('Note not found');
  }

  await entities.User_Notes.delete(noteId);
  return { success: true };
}

/**
 * Get user notes for a question
 */
export async function getUserNotes(userId, questionId) {
  return await entities.User_Notes.findOne({
    user_id: userId,
    question_id: questionId
  });
}

/**
 * Toggle bookmark
 */
export async function toggleBookmark(userId, questionId) {
  const existing = await entities.User_Notes.findOne({
    user_id: userId,
    question_id: questionId
  });

  if (existing) {
    return await entities.User_Notes.update(existing.note_id, {
      is_bookmark: !existing.is_bookmark,
      updated_at: new Date()
    });
  }

  return await entities.User_Notes.create({
    user_id: userId,
    question_id: questionId,
    is_bookmark: true,
    created_at: new Date()
  });
}

/**
 * Get user bookmarks
 */
export async function getBookmarks(userId) {
  const bookmarks = await entities.User_Notes.find({
    user_id: userId,
    is_bookmark: true
  }, {
    sort: { created_at: -1 }
  });

  // Enrich with question data
  const enrichedBookmarks = [];
  for (const bookmark of bookmarks) {
    const question = await entities.Question_Bank.findOne({
      id: bookmark.question_id
    });
    
    if (question) {
      enrichedBookmarks.push({
        ...bookmark,
        question
      });
    }
  }

  return enrichedBookmarks;
}
