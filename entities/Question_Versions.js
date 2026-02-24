/**
 * Question Versions Entity (Mock)
 * Version history for questions
 * Hebrew: גרסאות שאלות
 */

// Mock data for development
const mockVersions = [];

/**
 * Question Versions Entity
 */
export const Question_Versions = {
  /**
   * Find versions
   */
  find: async (query = {}) => {
    if (typeof window !== 'undefined' && window.mockEntities && window.mockEntities.Question_Versions) {
      return window.mockEntities.Question_Versions.find(query);
    }
    
    let filtered = [...mockVersions];
    
    if (query.question_id) {
      filtered = filtered.filter(v => v.question_id === query.question_id);
    }
    
    if (query.version_number) {
      filtered = filtered.filter(v => v.version_number === query.version_number);
    }
    
    return filtered;
  },

  /**
   * Find one version
   */
  findOne: async (query) => {
    if (typeof window !== 'undefined' && window.mockEntities && window.mockEntities.Question_Versions) {
      return window.mockEntities.Question_Versions.findOne(query);
    }
    
    const versions = await Question_Versions.find(query);
    return versions.length > 0 ? versions[0] : null;
  },

  /**
   * Create version
   */
  create: async (data) => {
    if (typeof window !== 'undefined' && window.mockEntities && window.mockEntities.Question_Versions) {
      return window.mockEntities.Question_Versions.create(data);
    }
    
    const version = {
      id: `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      question_id: data.question_id,
      version_number: data.version_number || 1,
      question_data: data.question_data,
      changed_fields: data.changed_fields || [],
      changed_by: data.changed_by,
      change_reason: data.change_reason || '',
      created_at: new Date(),
      ...data
    };
    
    mockVersions.push(version);
    return version;
  },

  /**
   * Get version history for a question
   */
  getVersionHistory: async (questionId) => {
    const versions = await Question_Versions.find({ question_id: questionId });
    return versions.sort((a, b) => {
      if (a.version_number !== b.version_number) {
        return b.version_number - a.version_number; // Newest first
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
  },

  /**
   * Get latest version
   */
  getLatestVersion: async (questionId) => {
    const versions = await Question_Versions.getVersionHistory(questionId);
    return versions.length > 0 ? versions[0] : null;
  }
};

// Export for use in mockEntities.js
if (typeof window !== 'undefined') {
  window.mockEntities = window.mockEntities || {};
  window.mockEntities.Question_Versions = Question_Versions;
}
