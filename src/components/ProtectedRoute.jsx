import { Navigate, useLocation } from "react-router";
import { useAuth } from "../hooks/useAuth";
import ConnectionError from "./ConnectionError";
import { useState } from "react";

/**
 * ProtectedRoute Component
 * Protects routes that require authentication
 *
 * @param {Object} props
 * @param {React.Component} props.children - Component to render if authenticated
 * @param {string} props.allowedRoles - Array of roles allowed to access this route
 * @param {string} props.redirectTo - Path to redirect if not authenticated (default: '/login')
 */
export default function ProtectedRoute({
  children,
  allowedRoles = null,
  redirectTo = "/login",
}) {
  const {
    currentUser,
    userRole,
    loading,
    fetchUserRole,
    mustActivateAccount,
  } = useAuth();
  const location = useLocation();
  const [retrying, setRetrying] = useState(false);

  // Show loading spinner while checking authentication
  if (loading || retrying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated, save current location
  if (!currentUser) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // If user is authenticated but role is not loaded (ad blocker issue)
  if (currentUser && !userRole) {
    const handleRetry = async () => {
      setRetrying(true);
      try {
        await fetchUserRole(currentUser.uid);
      } catch (error) {
        console.error("Retry failed:", error);
      } finally {
        setRetrying(false);
      }
    };

    return <ConnectionError onRetry={handleRetry} />;
  }

  // Check role-based access if allowedRoles is specified
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // Redirect to appropriate dashboard based on user's role
    const roleDashboards = {
      admin: "/admin/dashboard",
      examiner: "/examiner/dashboard",
      student: "/student/dashboard",
    };

    return <Navigate to={roleDashboards[userRole] || "/login"} replace />;
  }

  if (mustActivateAccount && location.pathname !== "/auth/activate-account") {
    return <Navigate to="/auth/activate-account" replace />;
  }

  // User is authenticated and has the correct role
  return children;
}

/**
 * Usage Examples:
 *
 * // Protect any route (requires authentication only)
 * <Route path="/profile" element={
 *   <ProtectedRoute>
 *     <ProfilePage />
 *   </ProtectedRoute>
 * } />
 *
 * // Protect admin-only route
 * <Route path="/admin/dashboard" element={
 *   <ProtectedRoute allowedRoles={['admin']}>
 *     <AdminDashboard />
 *   </ProtectedRoute>
 * } />
 *
 * // Protect route for multiple roles (admin and examiner)
 * <Route path="/questions" element={
 *   <ProtectedRoute allowedRoles={['admin', 'examiner']}>
 *     <QuestionBank />
 *   </ProtectedRoute>
 * } />
 *
 * // Custom redirect path
 * <Route path="/student/exam" element={
 *   <ProtectedRoute allowedRoles={['student']} redirectTo="/student/dashboard">
 *     <TakeExam />
 *   </ProtectedRoute>
 * } />
 */
