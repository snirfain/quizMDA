/**
 * Permission Management Component
 * Manage user permissions and roles
 * Hebrew: ניהול הרשאות
 */

import React, { useState, useEffect } from 'react';
import { entities } from '../config/appConfig';
import { getCurrentUser } from '../utils/auth';
import { showToast } from './Toast';
import {
  permissions,
  getUserPermissions,
  getRolePermissions,
  getCustomPermissions,
  setCustomPermissions,
  addCustomPermission,
  removeCustomPermission,
  getPermissionDescription
} from '../utils/permissions';
import LoadingSpinner from './LoadingSpinner';

const ROLES = [
  { value: 'trainee', label: 'מתאמן' },
  { value: 'instructor', label: 'מדריך' },
  { value: 'admin', label: 'מנהל' }
];

export default function PermissionManagement() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleEdit, setRoleEdit] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    loadUsers();
    getCurrentUser().then(u => setCurrentUserId(u?.user_id || null));
  }, []);

  useEffect(() => {
    if (selectedUser) {
      setRoleEdit(selectedUser.role);
      try {
        setCustomPermissions(selectedUser.user_id, selectedUser.custom_permissions || []);
      } catch (e) {
        console.warn('Could not sync selected user permissions to memory', e);
      }
      loadUserPermissions();
    } else {
      setRoleEdit(null);
    }
  }, [selectedUser]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const allUsers = await entities.Users.find({});
      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserPermissions = () => {
    if (!selectedUser) return;
    const rolePerms = getRolePermissions(selectedUser.role);
    const customPerms = getUserPermissions(selectedUser.role, selectedUser.user_id);
    
    // Get all available permissions
    const allPermissions = Object.values(permissions);
    
    // Map to permission objects with status
    const permObjects = allPermissions.map(perm => ({
      key: perm,
      description: getPermissionDescription(perm),
      hasRolePermission: rolePerms.includes(perm),
      hasCustomPermission: customPerms.includes(perm) && !rolePerms.includes(perm),
      isActive: customPerms.includes(perm)
    }));

    setUserPermissions(permObjects);
  };

  const handleTogglePermission = async (permissionKey) => {
    if (!selectedUser) return;

    try {
      const perm = userPermissions.find(p => p.key === permissionKey);
      
      if (perm.hasRolePermission) {
        alert('הרשאה זו כבר כלולה בתפקיד של המשתמש ולא ניתן להסירה');
        return;
      }

      if (perm.hasCustomPermission) {
        removeCustomPermission(selectedUser.user_id, permissionKey);
      } else {
        addCustomPermission(selectedUser.user_id, permissionKey);
      }

      const updatedList = getCustomPermissions(selectedUser.user_id);
      if (entities.Users && typeof entities.Users.update === 'function') {
        await entities.Users.update(selectedUser.user_id, { custom_permissions: updatedList });
      }
      setSelectedUser(u => (u ? { ...u, custom_permissions: updatedList } : null));
      loadUserPermissions();
    } catch (error) {
      console.error('Error toggling permission:', error);
      alert(`שגיאה: ${error.message}`);
    }
  };

  const handleRoleSave = async () => {
    if (!selectedUser || roleEdit === selectedUser.role) return;
    if (selectedUser.user_id === currentUserId) {
      if (!window.confirm('אתה משנה את התפקיד של עצמך. האם להמשיך?')) return;
    }
    try {
      if (entities.Users && typeof entities.Users.update === 'function') {
        await entities.Users.update(selectedUser.user_id, { role: roleEdit });
      }
      const updated = { ...selectedUser, role: roleEdit };
      setSelectedUser(updated);
      setUsers(prev => prev.map(u => u.user_id === updated.user_id ? updated : u));
      loadUserPermissions();
      showToast('תפקיד נשמר בהצלחה', 'success');
    } catch (error) {
      console.error('Error saving role:', error);
      alert(`שגיאה: ${error.message}`);
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.user_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPermissions = userPermissions.filter(perm =>
    perm.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    perm.key?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return <LoadingSpinner fullScreen message="טוען משתמשים..." />;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.pageTitle}>ניהול הרשאות</h2>
      <p style={styles.pageSubtitle}>הגדרת תפקידים והרשאות מותאמות אישית למשתמשים</p>
      <div style={styles.layout}>
        {/* User List */}
        <div style={styles.userList}>
          <div style={styles.searchBox}>
            <input
              type="text"
              placeholder="חפש משתמש..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
              aria-label="חפש משתמש"
            />
          </div>

          <div style={styles.userListContent}>
            {filteredUsers.map(user => (
              <div
                key={user.user_id}
                style={{
                  ...styles.userItem,
                  ...(selectedUser?.user_id === user.user_id ? styles.userItemActive : {})
                }}
                onClick={() => setSelectedUser(user)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedUser(user);
                  }
                }}
                aria-selected={selectedUser?.user_id === user.user_id}
              >
                <div style={styles.userInfo}>
                  <div style={styles.userName}>{user.full_name}</div>
                  <div style={styles.userDetails}>
                    <span style={styles.userRole}>
                      {user.role === 'trainee' ? 'מתאמן' :
                       user.role === 'instructor' ? 'מדריך' : 'מנהל'}
                    </span>
                    {user.email && (
                      <span style={styles.userEmail}>{user.email}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Permission List */}
        <div style={styles.permissionList}>
          {selectedUser ? (
            <>
              <div style={styles.selectedUserHeader}>
                <h2 style={styles.selectedUserName}>
                  הרשאות עבור: {selectedUser.full_name}
                </h2>
                <div style={styles.roleRow}>
                  <label style={styles.roleLabel}>תפקיד:</label>
                  <select
                    value={roleEdit ?? selectedUser.role}
                    onChange={(e) => setRoleEdit(e.target.value)}
                    style={styles.roleSelect}
                    aria-label="בחירת תפקיד"
                    disabled={!entities.Users || typeof entities.Users.update !== 'function'}
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleRoleSave}
                    disabled={roleEdit === selectedUser.role}
                    style={styles.roleSaveBtn}
                  >
                    שמור תפקיד
                  </button>
                </div>
              </div>

              <div style={styles.permissionGroups}>
                {['question', 'content', 'activity', 'progress', 'note', 'plan', 'user', 'analytics', 'system', 'test', 'notification', 'report'].map(group => {
                  const groupPerms = filteredPermissions.filter(p => p.key.startsWith(`${group}:`));
                  if (groupPerms.length === 0) return null;

                  return (
                    <div key={group} style={styles.permissionGroup}>
                      <h3 style={styles.groupTitle}>
                        {group === 'question' ? 'שאלות' :
                         group === 'content' ? 'תוכן' :
                         group === 'activity' ? 'פעילות' :
                         group === 'progress' ? 'התקדמות' :
                         group === 'note' ? 'הערות' :
                         group === 'plan' ? 'תוכניות לימוד' :
                         group === 'user' ? 'משתמשים' :
                         group === 'analytics' ? 'אנליטיקה' :
                         group === 'system' ? 'מערכת' :
                         group === 'test' ? 'מבחנים' :
                         group === 'notification' ? 'התראות' :
                         'דוחות'}
                      </h3>
                      {groupPerms.map(perm => (
                        <div key={perm.key} style={styles.permissionItem}>
                          <label style={styles.permissionLabel}>
                            <input
                              type="checkbox"
                              checked={perm.isActive}
                              disabled={perm.hasRolePermission}
                              onChange={() => handleTogglePermission(perm.key)}
                              style={styles.checkbox}
                              aria-label={perm.description}
                            />
                            <span style={styles.permissionText}>
                              {perm.description}
                              {perm.hasRolePermission && (
                                <span style={styles.roleBadge}> (מתפקיד)</span>
                              )}
                              {perm.hasCustomPermission && (
                                <span style={styles.customBadge}> (מותאם אישית)</span>
                              )}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={styles.noSelection}>
              <p>בחר משתמש מהרשימה כדי לראות ולנהל את ההרשאות שלו</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const cardShadow = '0 2px 12px rgba(0,0,0,0.06)';
const cardRadius = 16;

const styles = {
  container: {
    direction: 'rtl',
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
    fontFamily: "'Heebo', 'Assistant', 'Arial Hebrew', Arial, sans-serif"
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: '0 0 6px'
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#64748b',
    margin: '0 0 24px'
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '350px 1fr',
    gap: 24,
    minHeight: 600
  },
  userList: {
    backgroundColor: '#fff',
    borderRadius: cardRadius,
    boxShadow: cardShadow,
    border: '1px solid rgba(0,0,0,0.04)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  searchBox: {
    padding: 16,
    borderBottom: '1px solid #e8ecf0'
  },
  searchInput: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    fontSize: 14,
    direction: 'rtl',
    backgroundColor: '#f8fafc'
  },
  userListContent: {
    flex: 1,
    overflowY: 'auto'
  },
  userItem: {
    padding: 16,
    borderBottom: '1px solid #f0f0f0',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  userItemActive: {
    backgroundColor: '#e3f2fd',
    borderRight: '3px solid #1565c0'
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5
  },
  userName: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1a1a2e'
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    fontSize: 14,
    color: '#64748b'
  },
  userRole: {
    fontWeight: 600
  },
  userEmail: {
    fontSize: 12
  },
  permissionList: {
    backgroundColor: '#fff',
    borderRadius: cardRadius,
    boxShadow: cardShadow,
    border: '1px solid rgba(0,0,0,0.04)',
    padding: 24,
    overflowY: 'auto',
    maxHeight: 800
  },
  selectedUserHeader: {
    marginBottom: 28,
    paddingBottom: 20,
    borderBottom: '1px solid #e8ecf0'
  },
  selectedUserName: {
    fontSize: 22,
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: 8
  },
  selectedUserRole: {
    fontSize: 15,
    color: '#64748b'
  },
  roleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    flexWrap: 'wrap'
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: '#334155'
  },
  roleSelect: {
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    fontSize: 14,
    fontFamily: 'inherit',
    minWidth: 120
  },
  roleSaveBtn: {
    padding: '10px 20px',
    backgroundColor: '#1565c0',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 2px 8px rgba(21,101,192,0.3)'
  },
  permissionGroups: {
    display: 'flex',
    flexDirection: 'column',
    gap: 28
  },
  permissionGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1565c0',
    marginBottom: 10
  },
  permissionItem: {
    padding: 12,
    borderRadius: 12,
    transition: 'background-color 0.2s'
  },
  permissionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    fontSize: 15
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: 'pointer',
    accentColor: '#1565c0'
  },
  permissionText: {
    color: '#334155',
    flex: 1
  },
  roleBadge: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic'
  },
  customBadge: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: 600
  },
  noSelection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#64748b',
    fontSize: 16,
    textAlign: 'center'
  }
};
