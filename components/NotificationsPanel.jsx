/**
 * Notifications Panel Component
 * Displays and manages notifications
 * Hebrew: פאנל התראות
 */

import React, { useState, useEffect } from 'react';
import { getUserNotifications, markAsRead } from '../workflows/notifications';
import { navigateTo } from '../utils/router';
import { announce } from '../utils/accessibility';

export default function NotificationsPanel({ userId, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'unread'

  useEffect(() => {
    loadNotifications();
  }, [userId, filter]);

  const loadNotifications = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const allNotifications = await getUserNotifications(userId, filter === 'unread');
      setNotifications(allNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
      announce('שגיאה בטעינת התראות', 'assertive');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markAsRead(notificationId, userId);
      await loadNotifications();
      announce('התראה סומנה כנקראה');
    } catch (error) {
      console.error('Error marking as read:', error);
      announceError('שגיאה בסימון התראה');
    }
  };

  const handleNotificationClick = (notification) => {
    if (notification.action_url) {
      navigateTo(notification.action_url);
    }
    if (!notification.read) {
      handleMarkAsRead(notification.notification_id);
    }
    if (onClose) onClose();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div 
      style={styles.panel}
      role="dialog"
      aria-label="התראות"
      aria-modal="true"
    >
      <div style={styles.header}>
        <h2 style={styles.title}>התראות</h2>
        {unreadCount > 0 && (
          <span style={styles.badge} aria-label={`${unreadCount} התראות לא נקראו`}>
            {unreadCount}
          </span>
        )}
        <button
          style={styles.closeButton}
          onClick={onClose}
          aria-label="סגור פאנל התראות"
        >
          ✕
        </button>
      </div>

      <div style={styles.filters}>
        <button
          style={{
            ...styles.filterButton,
            ...(filter === 'all' ? styles.filterButtonActive : {})
          }}
          onClick={() => setFilter('all')}
          aria-pressed={filter === 'all'}
        >
          הכל
        </button>
        <button
          style={{
            ...styles.filterButton,
            ...(filter === 'unread' ? styles.filterButtonActive : {})
          }}
          onClick={() => setFilter('unread')}
          aria-pressed={filter === 'unread'}
        >
          לא נקראו ({unreadCount})
        </button>
      </div>

      <div style={styles.content} role="list" aria-label="רשימת התראות">
        {isLoading ? (
          <div style={styles.loading}>טוען התראות...</div>
        ) : notifications.length === 0 ? (
          <div style={styles.empty} role="status">
            אין התראות
          </div>
        ) : (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.notification_id}
              notification={notification}
              onClick={() => handleNotificationClick(notification)}
              onMarkAsRead={() => handleMarkAsRead(notification.notification_id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NotificationItem({ notification, onClick, onMarkAsRead }) {
  const getTypeIcon = (type) => {
    const icons = {
      achievement: '🎉',
      reminder: '⏰',
      suspension: '⚠️',
      system: 'ℹ️'
    };
    return icons[type] || '📢';
  };

  return (
    <div
      style={{
        ...styles.notificationItem,
        ...(notification.read ? {} : styles.notificationItemUnread)
      }}
      role="listitem"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      aria-label={`${notification.title}. ${notification.message}`}
    >
      <div style={styles.notificationIcon} aria-hidden="true">
        {getTypeIcon(notification.type)}
      </div>
      <div style={styles.notificationContent}>
        <div style={styles.notificationTitle}>{notification.title}</div>
        <div style={styles.notificationMessage}>{notification.message}</div>
        <div style={styles.notificationTime}>
          {new Date(notification.created_at).toLocaleDateString('he-IL', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
      {!notification.read && (
        <button
          style={styles.markReadButton}
          onClick={(e) => {
            e.stopPropagation();
            onMarkAsRead();
          }}
          aria-label="סמן כנקרא"
        >
          ✓
        </button>
      )}
    </div>
  );
}

const styles = {
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
    maxWidth: '400px',
    maxHeight: '500px',
    display: 'flex',
    flexDirection: 'column',
    direction: 'rtl'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    borderBottom: '1px solid #e0e0e0'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold'
  },
  badge: {
    backgroundColor: '#f44336',
    color: '#FFFFFF',
    borderRadius: '12px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px',
    color: '#757575',
    '&:hover': {
      color: '#212121'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px',
      borderRadius: '2px'
    }
  },
  filters: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    borderBottom: '1px solid #e0e0e0'
  },
  filterButton: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    '&:hover': {
      backgroundColor: '#f5f5f5'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  filterButtonActive: {
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    borderColor: '#CC0000'
  },
  content: {
    overflowY: 'auto',
    maxHeight: '400px'
  },
  loading: {
    padding: '40px',
    textAlign: 'center',
    color: '#757575'
  },
  empty: {
    padding: '40px',
    textAlign: 'center',
    color: '#757575'
  },
  notificationItem: {
    display: 'flex',
    gap: '12px',
    padding: '12px 16px',
    borderBottom: '1px solid #f5f5f5',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: '#f9f9f9'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '-2px',
      backgroundColor: '#f0f7ff'
    }
  },
  notificationItemUnread: {
    backgroundColor: '#e3f2fd',
    fontWeight: '500'
  },
  notificationIcon: {
    fontSize: '24px',
    flexShrink: 0
  },
  notificationContent: {
    flex: 1,
    minWidth: 0
  },
  notificationTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '4px',
    color: '#212121'
  },
  notificationMessage: {
    fontSize: '13px',
    color: '#757575',
    marginBottom: '4px',
    lineHeight: 1.4
  },
  notificationTime: {
    fontSize: '11px',
    color: '#9E9E9E'
  },
  markReadButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#4CAF50',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '16px',
    flexShrink: 0,
    '&:hover': {
      backgroundColor: '#e8f5e9'
    },
    '&:focus': {
      outline: '2px solid #4CAF50',
      outlineOffset: '2px'
    }
  }
};
