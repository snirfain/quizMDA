/**
 * Main App Component
 * Entry point for the application
 * Hebrew: קומפוננטה ראשית
 */

import React, { useState, useEffect } from 'react';
import { getCurrentUser, logout } from './utils/auth';
import { isTokenExpiringSoon } from './utils/apiClient';
import { getCurrentPath, getRouteByPath, navigateTo } from './utils/router';
import MainLayout from './components/MainLayout';
import AuthGuard from './components/AuthGuard';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';
import FloatingAccessibilityButton from './components/FloatingAccessibilityButton';
import FloatingContactButton from './components/FloatingContactButton';
import OfflineIndicator from './components/OfflineIndicator';
import SyncIndicator from './components/SyncIndicator';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import ConsentGate from './components/ConsentGate';
import { ensureQuestionsSynced } from './mockEntities';

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
const QuestionImportHub = React.lazy(() => import('./components/QuestionImportHub'));
const StudyPlanManager = React.lazy(() => import('./components/StudyPlanManager'));
const InstructorAnalytics = React.lazy(() => import('./components/InstructorAnalytics'));
const DataImportExport = React.lazy(() => import('./components/DataImportExport'));
const AdminStatistics = React.lazy(() => import('./components/AdminStatistics'));
const QuestionStatsDashboard = React.lazy(() => import('./components/QuestionStatsDashboard'));
const PermissionManagement = React.lazy(() => import('./components/PermissionManagement'));
const MediaBankManager = React.lazy(() => import('./components/MediaBankManager'));
const BookContentLibrary = React.lazy(() => import('./components/BookContentLibrary'));
const TranscriptUpload = React.lazy(() => import('./components/TranscriptUpload'));
const CourseSetup = React.lazy(() => import('./components/CourseSetup'));
const Leaderboard = React.lazy(() => import('./components/Leaderboard'));
const AdminPushManager = React.lazy(() => import('./components/AdminPushManager'));

export default function App() {
  const [currentPath, setCurrentPath] = useState('/');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
    updatePath();

    // NOTE: question sync no longer runs on bootstrap. Running it before the
    // user is authenticated caused 401s on fresh machines (leaving only the
    // mock seeds). Sync is now triggered post-login / for a valid session —
    // see triggerQuestionSync() (called from loadUser and the userLogin event).
    // The service worker is registered in main.jsx (robust, app-wide).

    // Listen for route changes
    window.addEventListener('popstate', updatePath);

    // Trigger the heavy question sync only AFTER a successful login.
    const handleLogin = () => triggerQuestionSync('login');
    window.addEventListener('userLogin', handleLogin);

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
      window.removeEventListener('userLogin', handleLogin);
      window.removeEventListener('userLogout', handleLogout);
      window.removeEventListener('userUpdated', handleUserUpdate);
    };
  }, []);

  /**
   * Kick off the server→IndexedDB question sync.
   *
   * Delegates to ensureQuestionsSynced(), which (1) waits for the auth token to
   * be persisted after login — fixing the post-login race that left a fresh
   * machine unauthenticated — and (2) retries with backoff on transient failures
   * (cold server / DB warm-up / network) until the full bank actually arrives,
   * so a brand-new user on a clean machine never gets stuck on the 2 seed
   * questions. Returning users and localhost dev keep their existing behavior.
   * The promise is exposed so the practice engine can await a fresh sync.
   */
  const triggerQuestionSync = (reason = '') => {
    if (typeof window === 'undefined') return;
    if (reason) console.debug('[App] מפעיל סנכרון בנק שאלות', `(${reason})`);
    window.__quizMDA_syncPromise = ensureQuestionsSynced();
  };

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      // Self-heal stuck sessions: a user logged in before the auth-token
      // mechanism (or whose token expired) has no valid token and would hit
      // 401 on every API call. Force a fresh login so they obtain a session
      // token. Skip on localhost where auth enforcement is off.
      if (currentUser && typeof window !== 'undefined') {
        const host = window.location.hostname;
        const isLocal = host === 'localhost' || host === '127.0.0.1';
        if (!isLocal && isTokenExpiringSoon(0)) {
          console.warn('Session has no valid auth token — forcing re-login');
          logout();
          setUser(null);
          return;
        }
      }
      setUser(currentUser);
      // Returning user with a valid session → sync the question bank now.
      if (currentUser) triggerQuestionSync('reload');
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
      case '/instructor/import':
        return <QuestionImportHub initialTab="manual" />;
      case '/instructor/chapter-generator':
        return <QuestionImportHub initialTab="chapter" />;
      case '/instructor/file-ingest':
        return <QuestionImportHub initialTab="file" />;
      case '/instructor/study-plans':
        return <StudyPlanManager />;
      case '/instructor/analytics':
        return <InstructorAnalytics instructorId={userId} />;
      case '/instructor/media-bank':
        return <MediaBankManager />;
      case '/instructor/book-content':
        return <BookContentLibrary />;
      case '/instructor/transcripts':
        return <TranscriptUpload />;
      case '/leaderboard':
        return <Leaderboard currentUserId={userId} />;
      case '/manager':
        return <ManagerDashboardPage />;
      case '/manager/notifications':
        return <AdminPushManager />;
      case '/admin/data-import-export':
        return <DataImportExport />;
      case '/admin/question-stats':
        return <QuestionStatsDashboard />;
      case '/setup':
        return <CourseSetup user={user} onComplete={(updatedUser) => {
          setUser(updatedUser);
          const dest = {
            trainee: '/practice', instructor: '/instructor',
            school_staff: '/instructor', manager: '/manager', admin: '/manager',
          }[updatedUser.role] || '/practice';
          navigateTo(dest);
        }} />;
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
        {user && <SyncIndicator />}
        {user && <FloatingAccessibilityButton />}
        {user && <FloatingContactButton />}
        {user && <OfflineIndicator />}
        <PwaInstallPrompt />
        {user && <ConsentGate user={user} />}
      </React.Suspense>
    </ErrorBoundary>
  );
}
