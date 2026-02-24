/**
 * Permission Management Component
 * Manage user permissions and roles
 * Hebrew: ניהול הרשאות
 */

import React, { useState, useEffect } from 'react';
import { entities } from '../config/appConfig';
import {
  permissions,
  getUserPermissions,
  getRolePermissions,
  setCustomPermissions,
  addCustomPermission,
  removeCustomPermission,
  getPermissionDescription
} from '../utils/permissions';
import LoadingSpinner from './LoadingSpinner';

export default function PermissionManagement() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadUserPermissions();
    }
  }, [selectedUser]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const allUsers = await entities.Users.find({});
      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      // Mock data for development
      setUsers([
        {
          user_id: '12345',
          full_name: 'יוסי כהן',
          email: 'yossi@example.com',
          role: 'trainee'
        },
        {
          user_id: 'instructor1',
          full_name: 'דני לוי',
          email: 'danny@example.com',
          role: 'instructor'
        }
      ]);
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

      // Reload permissions
      loadUserPermissions();
    } catch (error) {
      console.error('Error toggling permission:', error);
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
                <div style={styles.selectedUserRole}>
                  תפקיד: {selectedUser.role === 'trainee' ? 'מתאמן' :
                           selectedUser.role === 'instructor' ? 'מדריך' : 'מנהל'}
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

const styles = {
  container: {
    direction: 'rtl',
    padding: '20px',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '350px 1fr',
    gap: '20px',
    minHeight: '600px'
  },
  userList: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  searchBox: {
    padding: '15px',
    borderBottom: '1px solid #e0e0e0'
  },
  searchInput: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    direction: 'rtl'
  },
  userListContent: {
    flex: 1,
    overflowY: 'auto'
  },
  userItem: {
    padding: '15px',
    borderBottom: '1px solid #f0f0f0',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#f5f5f5'
    }
  },
  userItemActive: {
    backgroundColor: '#e3f2fd',
    borderRight: '3px solid #CC0000'
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  userName: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#212121'
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    fontSize: '14px',
    color: '#757575'
  },
  userRole: {
    fontWeight: '500'
  },
  userEmail: {
    fontSize: '12px'
  },
  permissionList: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    padding: '20px',
    overflowY: 'auto',
    maxHeight: '800px'
  },
  selectedUserHeader: {
    marginBottom: '30px',
    paddingBottom: '20px',
    borderBottom: '2px solid #e0e0e0'
  },
  selectedUserName: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: '8px'
  },
  selectedUserRole: {
    fontSize: '16px',
    color: '#757575'
  },
  permissionGroups: {
    display: 'flex',
    flexDirection: 'column',
    gap: '30px'
  },
  permissionGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  groupTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#CC0000',
    marginBottom: '10px'
  },
  permissionItem: {
    padding: '10px',
    borderRadius: '4px',
    '&:hover': {
      backgroundColor: '#f9f9f9'
    }
  },
  permissionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    fontSize: '16px'
  },
  checkbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer'
  },
  permissionText: {
    color: '#212121',
    flex: 1
  },
  roleBadge: {
    fontSize: '12px',
    color: '#757575',
    fontStyle: 'italic'
  },
  customBadge: {
    fontSize: '12px',
    color: '#4CAF50',
    fontWeight: 'bold'
  },
  noSelection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#757575',
    fontSize: '18px',
    textAlign: 'center'
  }
};
