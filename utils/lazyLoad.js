/**
 * Lazy Loading Utilities
 * Code splitting and lazy component loading
 * Hebrew: טעינה עצלה
 */

import React, { Suspense, lazy } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

/**
 * Lazy load component with loading fallback
 */
export function lazyLoad(importFunc) {
  const LazyComponent = lazy(importFunc);
  
  return (props) => (
    <Suspense fallback={<LoadingSpinner fullScreen message="טוען..." />}>
      <LazyComponent {...props} />
    </Suspense>
  );
}

/**
 * Lazy load page component
 */
export const LazyTraineeDashboard = lazyLoad(() => import('../pages/TraineeDashboard'));
export const LazyInstructorDashboard = lazyLoad(() => import('../pages/InstructorDashboard'));
export const LazyManagerDashboard = lazyLoad(() => import('../pages/ManagerDashboardPage'));
export const LazySettingsPage = lazyLoad(() => import('../pages/SettingsPage'));
export const LazyProfilePage = lazyLoad(() => import('../pages/ProfilePage'));
export const LazyHelpPage = lazyLoad(() => import('../pages/HelpPage'));
export const LazyLoginPage = lazyLoad(() => import('../pages/LoginPage'));

/**
 * Lazy load heavy components
 */
export const LazyQuestionManagement = lazyLoad(() => import('../components/QuestionManagement'));
export const LazyInstructorAnalytics = lazyLoad(() => import('../components/InstructorAnalytics'));
export const LazyMockExam = lazyLoad(() => import('../components/MockExam'));
export const LazyDataImportExport = lazyLoad(() => import('../components/DataImportExport'));

/**
 * Preload component
 */
export function preloadComponent(importFunc) {
  importFunc();
}
