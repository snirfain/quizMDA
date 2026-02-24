/**
 * Main App Component
 * Entry point for the application
 * Hebrew: קומפוננטה ראשית
 */

import React, { useState, useEffect } from 'react';
import { getCurrentUser } from './utils/auth';
import { getCurrentPath, getRouteByPath, navigateTo } from './utils/router';
import MainLayout from './components/MainLayout';
import AuthGuard from './components/AuthGuard';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';
import FloatingAccessibilityButton from './components/FloatingAccessibilityButton';
import OfflineIndicator from './components/OfflineIndicator';
import { registerServiceWorker } from './utils/serviceWorker';

// Lazy load pages
const HomePage = React.lazy(() => import('./pages/HomePage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const TraineeDashboard = React.lazy(() => import('./pages/TraineeDashboard'));
const InstructorDashboard = React.lazy(() => import('./pages/InstructorDashboard'));
const ManagerDashboardPage = React.lazy(() => import('./pages/ManagerDashboardPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const HelpPage = React.lazy(() => import('./pages/HelpPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));
const UnauthorizedPage = React.lazy(() => import('./pages/UnauthorizedPage'));
const ErrorPage = React.lazy(() => import('./pages/ErrorPage'));

// Lazy load components
const UserProgressDashboard = React.lazy(() => import('./components/UserProgressDashboard'));
const StudyPlanViewer = React.lazy(() => import('./components/StudyPlanViewer'));
const BookmarksList = React.lazy(() => import('./components/BookmarksList'));
const MockExam = React.lazy(() => import('./components/MockExam'));
const QuestionManagement = React.lazy(() => import('./components/QuestionManagement'));
const StudyPlanManager = React.lazy(() => import('./components/StudyPlanManager'));
const InstructorAnalytics = React.lazy(() => import('./components/InstructorAnalytics'));
const DataImportExport = React.lazy(() => import('./components/DataImportExport'));
const AdminStatistics = React.lazy(() => import('./components/AdminStatistics'));
const PermissionManagement = React.lazy(() => import('./components/PermissionManagement'));
const MediaBankManager = React.lazy(() => import('./components/MediaBankManager'));

export default function App() {
  const [currentPath, setCurrentPath] = useState('/');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
    updatePath();
    
    // Register service worker for offline support
    registerServiceWorker();
    
    // Listen for route changes
    window.addEventListener('popstate', updatePath);
    
    // Listen for logout event
    const handleLogout = () => {
      setUser(null);
      setIsLoading(false);
    };
    window.addEventListener('userLogout', handleLogout);
    
    // Listen for user update event
    const handleUserUpdate = async (e) => {
      // Update state with new user data
      const updatedUser = e.detail;
      setUser(updatedUser);
      // Also reload from localStorage to ensure consistency
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      }
    };
    window.addEventListener('userUpdated', handleUserUpdate);
    
    return () => {
      window.removeEventListener('popstate', updatePath);
      window.removeEventListener('userLogout', handleLogout);
      window.removeEventListener('userUpdated', handleUserUpdate);
    };
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePath = () => {
    const newPath = getCurrentPath();
    setCurrentPath(newPath);
  };

  const renderPage = () => {
    const route = getRouteByPath(currentPath);
    
    if (!route) {
      return <NotFoundPage />;
    }

    // Public routes
    if (route.public) {
      switch (route.path) {
        case '/':
          return <HomePage />;
        case '/login':
          return <LoginPage />;
        case '/help':
          return <HelpPage />;
        case '/404':
          return <NotFoundPage />;
        case '/unauthorized':
          return <UnauthorizedPage />;
        default:
          return <NotFoundPage />;
      }
    }

    // Protected routes
    return (
      <AuthGuard route={route}>
        {renderProtectedPage(route)}
      </AuthGuard>
    );
  };

  const renderProtectedPage = (route) => {
    const userId = user?.user_id;
    
    switch (route.path) {
      case '/practice':
        return <TraineeDashboard userId={userId} />;
      case '/progress':
        return <UserProgressDashboard userId={userId} />;
      case '/study-plans':
        return <StudyPlanViewer />;
      case '/bookmarks':
        return <BookmarksList />;
      case '/mock-exam':
        return <MockExam />;
      case '/instructor':
        return <InstructorDashboard instructorId={userId} />;
      case '/instructor/questions':
        return <QuestionManagement />;
      case '/instructor/study-plans':
        return <StudyPlanManager />;
      case '/instructor/analytics':
        return <InstructorAnalytics instructorId={userId} />;
      case '/instructor/media-bank':
        return <MediaBankManager />;
      case '/manager':
        return <ManagerDashboardPage />;
      case '/admin/data-import-export':
        return <DataImportExport />;
      case '/settings':
        return <SettingsPage />;
      case '/profile':
        return <ProfilePage />;
      default:
        return <NotFoundPage />;
    }
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        direction: 'rtl',
        gap: '12px',
      }}>
        <LoadingSpinner size="lg" />
        <span style={{ fontSize: '18px', color: '#555' }}>טוען...</span>
      </div>
    );
  }

  return (
    <ErrorBoundary showDetails={import.meta.env.DEV}>
      <React.Suspense fallback={
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          direction: 'rtl',
          gap: '12px',
        }}>
          <LoadingSpinner size="lg" />
          <span>טוען...</span>
        </div>
      }>
        <MainLayout currentPath={currentPath}>
          {renderPage()}
        </MainLayout>
        <ToastContainer />
        {user && <FloatingAccessibilityButton />}
        {user && <OfflineIndicator />}
      </React.Suspense>
    </ErrorBoundary>
  );
}
