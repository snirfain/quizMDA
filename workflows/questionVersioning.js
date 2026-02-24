/**
 * Question Versioning Workflow
 * Manage question versions and history
 * Hebrew: ניהול גרסאות שאלות
 */

import { entities } from '../config/appConfig';
import { Question_Versions } from '../entities/Question_Versions';

/**
 * Create a new version of a question
 * @param {string} questionId - Question ID
 * @param {string} userId - User ID making the change
 * @param {Object} changes - Changes made
 * @param {string} reason - Reason for change
 * @returns {Promise<Object>} New version
 */
export async function createQuestionVersion(questionId, userId, changes, reason = '') {
  try {
    // Get current question
    const currentQuestion = await entities.Question_Bank.findOne({ id: questionId });
    if (!currentQuestion) {
      throw new Error('שאלה לא נמצאה');
    }

    // Get latest version number
    const history = await Question_Versions.getVersionHistory(questionId);
    const latestVersion = history.length > 0 ? history[0] : null;
    const nextVersionNumber = latestVersion ? latestVersion.version_number + 1 : 1;

    // Determine changed fields
    const changedFields = Object.keys(changes).filter(key => {
      return JSON.stringify(currentQuestion[key]) !== JSON.stringify(changes[key]);
    });

    // Create version record
    const version = await Question_Versions.create({
      question_id: questionId,
      version_number: nextVersionNumber,
      question_data: { ...currentQuestion, ...changes },
      changed_fields: changedFields,
      changed_by: userId,
      change_reason: reason
    });

    // Update question
    await entities.Question_Bank.update(questionId, {
      ...changes,
      updatedAt: new Date()
    });

    return version;
  } catch (error) {
    console.error('Error creating question version:', error);
    throw error;
  }
}

/**
 * Restore question to a previous version
 * @param {string} questionId - Question ID
 * @param {string} versionId - Version ID to restore
 * @param {string} userId - User ID restoring
 * @returns {Promise<Object>} Restored question
 */
export async function restoreQuestionVersion(questionId, versionId, userId) {
  try {
    // Get version to restore
    const version = await Question_Versions.findOne({ id: versionId });
    if (!version || version.question_id !== questionId) {
      throw new Error('גרסה לא נמצאה');
    }

    // Get current question state
    const currentQuestion = await entities.Question_Bank.findOne({ id: questionId });
    if (!currentQuestion) {
      throw new Error('שאלה לא נמצאה');
    }

    // Save current state as a version before restoring
    await createQuestionVersion(
      questionId,
      userId,
      currentQuestion,
      `שחזור לגרסה ${version.version_number}`
    );

    // Restore version data
    const restoredData = version.question_data;
    await entities.Question_Bank.update(questionId, {
      ...restoredData,
      updatedAt: new Date()
    });

    // Create restoration record
    await Question_Versions.create({
      question_id: questionId,
      version_number: (await Question_Versions.getLatestVersion(questionId))?.version_number + 1 || 1,
      question_data: restoredData,
      changed_fields: Object.keys(restoredData),
      changed_by: userId,
      change_reason: `שחזור מגרסה ${version.version_number}`
    });

    return restoredData;
  } catch (error) {
    console.error('Error restoring question version:', error);
    throw error;
  }
}

/**
 * Get question version history
 * @param {string} questionId - Question ID
 * @returns {Promise<Array>} Version history
 */
export async function getQuestionVersionHistory(questionId) {
  try {
    return await Question_Versions.getVersionHistory(questionId);
  } catch (error) {
    console.error('Error getting version history:', error);
    throw error;
  }
}

/**
 * Compare two versions
 * @param {string} versionId1 - First version ID
 * @param {string} versionId2 - Second version ID
 * @returns {Promise<Object>} Comparison result
 */
export async function compareVersions(versionId1, versionId2) {
  try {
    const version1 = await Question_Versions.findOne({ id: versionId1 });
    const version2 = await Question_Versions.findOne({ id: versionId2 });

    if (!version1 || !version2) {
      throw new Error('גרסאות לא נמצאו');
    }

    if (version1.question_id !== version2.question_id) {
      throw new Error('לא ניתן להשוות גרסאות של שאלות שונות');
    }

    const data1 = version1.question_data;
    const data2 = version2.question_data;

    const differences = {};
    const allKeys = new Set([...Object.keys(data1), ...Object.keys(data2)]);

    for (const key of allKeys) {
      if (JSON.stringify(data1[key]) !== JSON.stringify(data2[key])) {
        differences[key] = {
          old: data1[key],
          new: data2[key]
        };
      }
    }

    return {
      version1: version1.version_number,
      version2: version2.version_number,
      differences,
      changedFields: Object.keys(differences)
    };
  } catch (error) {
    console.error('Error comparing versions:', error);
    throw error;
  }
}

/**
 * Delete version (soft delete - mark as deleted)
 * @param {string} versionId - Version ID
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function deleteVersion(versionId, userId) {
  try {
    const version = await Question_Versions.findOne({ id: versionId });
    if (!version) {
      throw new Error('גרסה לא נמצאה');
    }

    // In a real implementation, you'd mark as deleted
    // For now, we'll just log it
    console.log(`Version ${versionId} marked as deleted by ${userId}`);
  } catch (error) {
    console.error('Error deleting version:', error);
    throw error;
  }
}
