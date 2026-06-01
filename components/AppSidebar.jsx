/**
 * Desktop sidebar navigation (RTL right side)
 * Hebrew: תפריט צד
 */

import React from 'react';
import Icon from './Icon';
import { navigateTo, getCurrentPath } from '../utils/router';

export default function AppSidebar({ navItems, accountItems = [], onNavClick }) {
  const activePath = getCurrentPath();

  const link = (item) => {
    const isActive = activePath === item.path;
    return (
      <a
        key={item.path}
        href={item.path}
        className={`app-sidebar-link ${isActive ? 'active' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          if (onNavClick) onNavClick(e, item.path);
          else navigateTo(item.path);
        }}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon name={item.icon} size={20} />
        {item.label}
      </a>
    );
  };

  return (
    <aside className="app-sidebar" role="navigation" aria-label="תפריט צד">
      <p className="app-sidebar-section-label">ניווט ראשי</p>
      {navItems.map(link)}
      {accountItems.length > 0 && (
        <>
          <p className="app-sidebar-section-label">החשבון שלי</p>
          {accountItems.map(link)}
        </>
      )}
    </aside>
  );
}
