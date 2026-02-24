/**
 * Breadcrumbs Component
 * Navigation breadcrumbs with RTL support
 * Hebrew: פירורי לחם
 */

import React from 'react';
import { getBreadcrumbs } from '../utils/router';
import { getCurrentPath } from '../utils/router';
import { navigateTo } from '../utils/router';
import { getCurrentUser } from '../utils/auth';

export default function Breadcrumbs({ currentPath = null }) {
  const [breadcrumbs, setBreadcrumbs] = React.useState([]);
  const [userRole, setUserRole] = React.useState(null);

  React.useEffect(() => {
    loadBreadcrumbs();
  }, [currentPath]);

  const loadBreadcrumbs = async () => {
    const path = currentPath || getCurrentPath();
    const user = await getCurrentUser();
    const role = user?.role;
    setUserRole(role);
    
    const crumbs = getBreadcrumbs(path, role);
    setBreadcrumbs(crumbs);
  };

  const handleClick = (e, path) => {
    e.preventDefault();
    navigateTo(path);
  };

  if (breadcrumbs.length <= 1) {
    return null; // Don't show breadcrumbs if only home
  }

  return (
    <nav 
      aria-label="ניווט" 
      style={styles.container}
      role="navigation"
    >
      <ol style={styles.list} itemScope itemType="https://schema.org/BreadcrumbList">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          
          return (
            <li 
              key={crumb.path}
              style={styles.item}
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {isLast ? (
                <span 
                  style={styles.current}
                  itemProp="name"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                <>
                  <a
                    href={crumb.path}
                    onClick={(e) => handleClick(e, crumb.path)}
                    style={styles.link}
                    itemProp="item"
                    aria-label={`עבור ל-${crumb.label}`}
                  >
                    <span itemProp="name">{crumb.label}</span>
                  </a>
                  <span style={styles.separator} aria-hidden="true">
                    /
                  </span>
                </>
              )}
              <meta itemProp="position" content={index + 1} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    padding: '12px 20px',
    backgroundColor: '#f9f9f9',
    borderBottom: '1px solid #e0e0e0'
  },
  list: {
    display: 'flex',
    flexWrap: 'wrap',
    listStyle: 'none',
    margin: 0,
    padding: 0,
    gap: '8px',
    alignItems: 'center'
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  link: {
    color: '#CC0000',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'color 0.2s ease',
    '&:hover': {
      color: '#A50000',
      textDecoration: 'underline'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px',
      borderRadius: '2px'
    }
  },
  current: {
    color: '#757575',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  separator: {
    color: '#BDBDBD',
    fontSize: '14px',
    userSelect: 'none'
  }
};
