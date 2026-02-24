/**
 * Offline Indicator Component
 * Shows offline status and sync queue
 * Hebrew: אינדיקטור מצב לא מקוון
 */

import React, { useState, useEffect } from 'react';
import { getSyncQueue, syncWhenOnline } from '../utils/offlineStorage';
import { announce } from '../utils/accessibility';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueueLength, setSyncQueueLength] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      announce('חיבור לאינטרנט חודש');
      loadSyncQueue();
      // Auto-sync when coming online
      handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      announce('אין חיבור לאינטרנט');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadSyncQueue();

    // Poll sync queue periodically
    const interval = setInterval(loadSyncQueue, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const loadSyncQueue = async () => {
    try {
      const queue = await getSyncQueue();
      setSyncQueueLength(queue.length);
    } catch (error) {
      console.error('Error loading sync queue:', error);
    }
  };

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      // This would call the actual sync function
      // For now, just clear the queue
      const result = await syncWhenOnline(async (item) => {
        // Sync logic would go here
        console.log('Syncing item:', item);
      });

      announce(`סונכרנו ${result.successful} פריטים`);
      await loadSyncQueue();
    } catch (error) {
      console.error('Sync error:', error);
      announce('שגיאה בסנכרון');
    } finally {
      setIsSyncing(false);
    }
  };

  if (isOnline && syncQueueLength === 0) {
    return null; // Don't show when online and nothing to sync
  }

  return (
    <div 
      style={styles.container}
      role="status"
      aria-live="polite"
      aria-label={isOnline ? 'מקוון' : 'לא מקוון'}
    >
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        style={{
          ...styles.indicator,
          ...(isOnline ? styles.online : styles.offline)
        }}
        aria-expanded={showDetails}
        aria-label={isOnline ? 'מקוון' : 'לא מקוון'}
      >
        <span style={styles.icon} aria-hidden="true">
          {isOnline ? '✓' : '⚠'}
        </span>
        <span style={styles.text}>
          {isOnline ? 'מקוון' : 'לא מקוון'}
        </span>
        {syncQueueLength > 0 && (
          <span style={styles.badge} aria-label={`${syncQueueLength} פריטים ממתינים לסנכרון`}>
            {syncQueueLength}
          </span>
        )}
      </button>

      {showDetails && (
        <div style={styles.details} role="region" aria-label="פרטי סנכרון">
          <div style={styles.detailsContent}>
            <p style={styles.statusText}>
              {isOnline 
                ? 'יש חיבור לאינטרנט' 
                : 'אין חיבור לאינטרנט. הנתונים יסונכרנו אוטומטית כשחוזר החיבור.'}
            </p>
            
            {syncQueueLength > 0 && (
              <div style={styles.syncSection}>
                <p style={styles.queueText}>
                  {syncQueueLength} פריטים ממתינים לסנכרון
                </p>
                {isOnline && (
                  <button
                    type="button"
                    onClick={handleSync}
                    disabled={isSyncing}
                    style={styles.syncButton}
                    aria-label="סנכרן עכשיו"
                  >
                    {isSyncing ? 'מסנכרן...' : 'סנכרן עכשיו'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    zIndex: 1000,
    direction: 'rtl'
  },
  indicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    transition: 'all 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  online: {
    backgroundColor: '#4CAF50',
    color: '#FFFFFF'
  },
  offline: {
    backgroundColor: '#ff9800',
    color: '#FFFFFF'
  },
  icon: {
    fontSize: '18px',
    fontWeight: 'bold'
  },
  text: {
    fontSize: '14px'
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: '12px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  details: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: '8px',
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    minWidth: '300px',
    maxWidth: '400px'
  },
  detailsContent: {
    padding: '16px'
  },
  statusText: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    color: '#212121'
  },
  syncSection: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e0e0e0'
  },
  queueText: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    color: '#757575'
  },
  syncButton: {
    padding: '8px 16px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    '&:hover:not(:disabled)': {
      backgroundColor: '#1976d2'
    },
    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  }
};
