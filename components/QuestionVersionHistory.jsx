/**
 * Question Version History Component
 * View and restore question versions
 * Hebrew: היסטוריית גרסאות שאלה
 */

import React, { useState, useEffect } from 'react';
import { entities } from '../config/appConfig';
import { getQuestionVersionHistory, restoreQuestionVersion, compareVersions } from '../workflows/questionVersioning';
import { getCurrentUser } from '../utils/auth';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import { showToast } from './Toast';
import { announce } from '../utils/accessibility';
import PermissionGate from './PermissionGate';
import { permissions } from '../utils/permissions';

export default function QuestionVersionHistory({ questionId, onVersionRestored }) {
  const [versions, setVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [compareVersions, setCompareVersions] = useState([null, null]);

  useEffect(() => {
    if (questionId) {
      loadVersions();
    }
  }, [questionId]);

  const loadVersions = async () => {
    setIsLoading(true);
    try {
      const versionHistory = await getQuestionVersionHistory(questionId);
      setVersions(versionHistory);
    } catch (error) {
      console.error('Error loading versions:', error);
      showToast('שגיאה בטעינת גרסאות', 'error');
      // Fallback to empty array
      setVersions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (version) => {
    if (window.confirm('האם אתה בטוח שברצונך לשחזר גרסה זו?')) {
      try {
        const user = await getCurrentUser();
        if (!user) {
          showToast('נדרש להתחבר', 'error');
          return;
        }

        await restoreQuestionVersion(questionId, version.id, user.user_id);

        showToast('גרסה שוחזרה בהצלחה', 'success');
        announce('גרסה שוחזרה בהצלחה');
        
        if (onVersionRestored) {
          onVersionRestored();
        }
        
        await loadVersions();
      } catch (error) {
        console.error('Error restoring version:', error);
        showToast(`שגיאה בשחזור גרסה: ${error.message}`, 'error');
      }
    }
  };

  const handleCompare = async () => {
    if (!compareVersions[0] || !compareVersions[1]) {
      showToast('אנא בחר שתי גרסאות להשוואה', 'warning');
      return;
    }

    try {
      const comparison = await compareVersions(compareVersions[0].id, compareVersions[1].id);
      setSelectedVersion({ comparison, type: 'comparison' });
    } catch (error) {
      console.error('Error comparing versions:', error);
      showToast(`שגיאה בהשוואת גרסאות: ${error.message}`, 'error');
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="טוען גרסאות..." />;
  }

  return (
    <PermissionGate permission={permissions.QUESTION_UPDATE}>
      <div style={styles.container}>
        <h2 style={styles.title}>היסטוריית גרסאות</h2>

        {versions.length === 0 ? (
          <div style={styles.empty} role="status">
            אין גרסאות זמינות
          </div>
        ) : (
          <>
            {versions.length > 1 && (
              <div style={styles.compareSection}>
                <h3 style={styles.compareTitle}>השוואת גרסאות:</h3>
                <div style={styles.compareSelectors}>
                  <select
                    value={compareVersions[0]?.id || ''}
                    onChange={(e) => {
                      const version = versions.find(v => v.id === e.target.value);
                      setCompareVersions([version, compareVersions[1]]);
                    }}
                    style={styles.compareSelect}
                    aria-label="בחר גרסה ראשונה"
                  >
                    <option value="">בחר גרסה ראשונה</option>
                    {versions.map(v => (
                      <option key={v.id} value={v.id}>גרסה {v.version_number}</option>
                    ))}
                  </select>
                  <span style={styles.compareVs}>vs</span>
                  <select
                    value={compareVersions[1]?.id || ''}
                    onChange={(e) => {
                      const version = versions.find(v => v.id === e.target.value);
                      setCompareVersions([compareVersions[0], version]);
                    }}
                    style={styles.compareSelect}
                    aria-label="בחר גרסה שנייה"
                  >
                    <option value="">בחר גרסה שנייה</option>
                    {versions.map(v => (
                      <option key={v.id} value={v.id}>גרסה {v.version_number}</option>
                    ))}
                  </select>
                  <button
                    style={styles.compareButton}
                    onClick={handleCompare}
                    disabled={!compareVersions[0] || !compareVersions[1]}
                    aria-label="השווה גרסאות"
                  >
                    השווה
                  </button>
                </div>
              </div>
            )}

            <div style={styles.versionsList}>
              {versions.map((version, index) => (
                <div key={version.id || index} style={styles.versionCard}>
                  <div style={styles.versionHeader}>
                    <div>
                      <strong style={styles.versionNumber}>גרסה {version.version_number}</strong>
                      <div style={styles.versionMeta}>
                        {new Date(version.created_at).toLocaleDateString('he-IL', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {version.changed_by && (
                          <span style={styles.changedBy}> • שונה על ידי: {version.changed_by}</span>
                        )}
                        {version.change_reason && (
                          <div style={styles.changeReason}>סיבה: {version.change_reason}</div>
                        )}
                      </div>
                      {version.changed_fields && version.changed_fields.length > 0 && (
                        <div style={styles.changedFields}>
                          שדות שהשתנו: {version.changed_fields.join(', ')}
                        </div>
                      )}
                    </div>
                    <div style={styles.versionActions}>
                      <button
                        style={styles.viewButton}
                        onClick={() => setSelectedVersion(version)}
                        aria-label={`צפה בגרסה ${version.version_number}`}
                      >
                        צפה
                      </button>
                      {index !== versions.length - 1 && (
                        <button
                          style={styles.restoreButton}
                          onClick={() => handleRestore(version)}
                          aria-label={`שחזר גרסה ${version.version_number}`}
                        >
                          שחזר
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={styles.versionPreview}>
                    {version.question_data?.question_text?.substring(0, 150) || 'אין תצוגה מקדימה'}
                    {version.question_data?.question_text?.length > 150 && '...'}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Version Detail Modal */}
        {selectedVersion && (
          <Modal
            isOpen={true}
            onClose={() => setSelectedVersion(null)}
            title={selectedVersion.type === 'comparison' 
              ? `השוואה בין גרסה ${selectedVersion.comparison.version1} לגרסה ${selectedVersion.comparison.version2}`
              : `גרסה ${selectedVersion.version_number}`}
            size="lg"
          >
            {selectedVersion.type === 'comparison' ? (
              <div style={styles.comparisonDetail}>
                <h4 style={styles.comparisonTitle}>הבדלים:</h4>
                {Object.keys(selectedVersion.comparison.differences).length === 0 ? (
                  <p style={styles.noDifferences}>אין הבדלים בין הגרסאות</p>
                ) : (
                  <div style={styles.differencesList}>
                    {Object.entries(selectedVersion.comparison.differences).map(([field, diff]) => (
                      <div key={field} style={styles.differenceItem}>
                        <strong style={styles.differenceField}>{field}:</strong>
                        <div style={styles.differenceValues}>
                          <div style={styles.differenceOld}>
                            <strong>גרסה {selectedVersion.comparison.version1}:</strong>
                            <pre style={styles.differenceValue}>
                              {JSON.stringify(diff.old, null, 2)}
                            </pre>
                          </div>
                          <div style={styles.differenceNew}>
                            <strong>גרסה {selectedVersion.comparison.version2}:</strong>
                            <pre style={styles.differenceValue}>
                              {JSON.stringify(diff.new, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={styles.versionDetail}>
                <div style={styles.detailSection}>
                  <strong>טקסט השאלה:</strong>
                  <div style={styles.detailContent}>
                    {selectedVersion.question_data?.question_text || 'לא זמין'}
                  </div>
                </div>
                <div style={styles.detailSection}>
                  <strong>תשובה נכונה:</strong>
                  <div style={styles.detailContent}>
                    {selectedVersion.question_data?.correct_answer || 'לא זמין'}
                  </div>
                </div>
                <div style={styles.detailSection}>
                  <strong>סוג שאלה:</strong>
                  <div style={styles.detailContent}>
                    {selectedVersion.question_data?.question_type || 'לא זמין'}
                  </div>
                </div>
                <div style={styles.detailSection}>
                  <strong>רמת קושי:</strong>
                  <div style={styles.detailContent}>
                    {selectedVersion.question_data?.difficulty_level || 'לא זמין'}
                  </div>
                </div>
                <div style={styles.detailSection}>
                  <strong>תאריך יצירה:</strong>
                  <div style={styles.detailContent}>
                    {new Date(selectedVersion.created_at).toLocaleString('he-IL')}
                  </div>
                </div>
                {selectedVersion.change_reason && (
                  <div style={styles.detailSection}>
                    <strong>סיבת שינוי:</strong>
                    <div style={styles.detailContent}>
                      {selectedVersion.change_reason}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Modal>
        )}
      </div>
    </PermissionGate>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    padding: '20px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#212121'
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: '#757575',
    fontSize: '16px'
  },
  versionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  versionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    border: '1px solid #e0e0e0'
  },
  versionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
    flexWrap: 'wrap',
    gap: '12px'
  },
  versionNumber: {
    fontSize: '16px',
    color: '#212121'
  },
  versionMeta: {
    fontSize: '12px',
    color: '#757575',
    marginTop: '4px'
  },
  versionActions: {
    display: 'flex',
    gap: '8px'
  },
  viewButton: {
    padding: '6px 12px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#A50000'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  restoreButton: {
    padding: '6px 12px',
    backgroundColor: '#4CAF50',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#388E3C'
    },
    '&:focus': {
      outline: '2px solid #4CAF50',
      outlineOffset: '2px'
    }
  },
  versionPreview: {
    fontSize: '14px',
    color: '#757575',
    lineHeight: 1.6
  },
  versionDetail: {
    direction: 'rtl',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  detailSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  detailContent: {
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    fontSize: '14px',
    lineHeight: 1.6
  },
  compareSection: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    border: '1px solid #e0e0e0'
  },
  compareTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: '#212121'
  },
  compareSelectors: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap'
  },
  compareSelect: {
    padding: '8px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    direction: 'rtl',
    minWidth: '150px'
  },
  compareVs: {
    fontSize: '14px',
    color: '#757575',
    fontWeight: 'bold'
  },
  compareButton: {
    padding: '8px 16px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
    '&:hover:not(:disabled)': {
      backgroundColor: '#A50000'
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  comparisonDetail: {
    direction: 'rtl'
  },
  comparisonTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#212121'
  },
  noDifferences: {
    textAlign: 'center',
    padding: '20px',
    color: '#757575',
    fontSize: '14px'
  },
  differencesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  differenceItem: {
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '6px',
    border: '1px solid #e0e0e0'
  },
  differenceField: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    color: '#212121'
  },
  differenceValues: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },
  differenceOld: {
    padding: '8px',
    backgroundColor: '#ffebee',
    borderRadius: '4px',
    border: '1px solid #ef9a9a'
  },
  differenceNew: {
    padding: '8px',
    backgroundColor: '#e8f5e9',
    borderRadius: '4px',
    border: '1px solid #81c784'
  },
  differenceValue: {
    margin: '4px 0 0 0',
    fontSize: '12px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  changedBy: {
    fontSize: '12px',
    color: '#757575',
    marginTop: '4px'
  },
  changeReason: {
    fontSize: '12px',
    color: '#757575',
    marginTop: '4px',
    fontStyle: 'italic'
  },
  changedFields: {
    fontSize: '12px',
    color: '#CC0000',
    marginTop: '4px',
    fontWeight: '500'
  }
};
