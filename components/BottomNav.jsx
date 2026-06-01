/**
 * Mobile bottom navigation bar
 * Hebrew: ניווט תחתון
 */

import React from 'react';
import Icon from './Icon';
import { getCurrentPath } from '../utils/router';

export default function BottomNav({ items, onMore, onNav }) {
  const activePath = getCurrentPath();

  return (
    <nav className="app-bottom-nav" aria-label="ניווט תחתון">
      <div className="app-bottom-nav-inner">
        {items.map((item) => {
          const isActive = activePath === item.path;
          const Tag = item.onClick ? 'button' : 'a';
          const props = item.onClick
            ? { type: 'button', onClick: item.onClick }
            : {
                href: item.path,
                onClick: (e) => {
                  e.preventDefault();
                  onNav?.(e, item.path);
                },
              };
          return (
            <Tag
              key={item.id || item.path}
              className={`app-bottom-nav-item ${isActive ? 'active' : ''}`}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              {...props}
            >
              <Icon name={item.icon} size={22} />
              <span>{item.shortLabel || item.label}</span>
            </Tag>
          );
        })}
        <button
          type="button"
          className="app-bottom-nav-item"
          onClick={onMore}
          aria-label="עוד אפשרויות"
          data-menu-toggle
        >
          <Icon name="menu" size={22} />
          <span>עוד</span>
        </button>
      </div>
    </nav>
  );
}

/**
 * Pick up to 4 primary bottom-nav items for a role's nav list.
 */
export function getBottomNavItems(navItems, role) {
  const pathPriority = {
    trainee: ['/practice', '/mock-exam', '/progress', '/bookmarks'],
    instructor: ['/instructor', '/instructor/import', '/instructor/questions', '/instructor/analytics'],
    school_staff: ['/instructor', '/instructor/import', '/instructor/questions', '/settings'],
    manager: ['/manager', '/instructor', '/instructor/questions', '/settings'],
    admin: ['/manager', '/instructor/import', '/admin/question-stats', '/settings'],
  };
  const prefs = pathPriority[role] || pathPriority.trainee;
  const picked = [];
  for (const p of prefs) {
    const item = navItems.find((n) => n.path === p);
    if (item) picked.push({ ...item, id: item.path });
    if (picked.length >= 4) break;
  }
  if (picked.length < 4) {
    for (const item of navItems) {
      if (!picked.find((x) => x.path === item.path)) {
        picked.push({ ...item, id: item.path });
        if (picked.length >= 4) break;
      }
    }
  }
  const short = {
    '/practice': 'תרגול',
    '/mock-exam': 'מבחן',
    '/progress': 'התקדמות',
    '/bookmarks': 'סימניות',
    '/instructor': 'מבחנים',
    '/instructor/import': 'ייבוא',
    '/instructor/questions': 'שאלות',
    '/instructor/analytics': 'ניתוח',
    '/manager': 'בקרה',
    '/admin/question-stats': 'סטטיסטיקות',
    '/settings': 'הגדרות',
  };
  return picked.map((item) => ({
    ...item,
    shortLabel: short[item.path] || item.label.split(' ')[0],
  }));
}
