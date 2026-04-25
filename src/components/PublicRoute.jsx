import { Navigate } from "react-router";
import { useAuth } from "../hooks/useAuth";

/**
 * PublicRoute Component
 * Redirects authenticated users away from public pages (like login)
 * Useful for preventing logged-in users from accessing login-only public pages
 *
 * @param {Object} props
 * @param {React.Component} props.children - Component to render if NOT authenticated
 */
export default function PublicRoute({ children }) {
  const { currentUser, userRole, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If user is authenticated, redirect to their dashboard
  if (currentUser && userRole) {
    const roleDashboards = {
      admin: "/admin/dashboard",
      examiner: "/examiner/dashboard",
      student: "/student/dashboard",
    };

    return <Navigate to={roleDashboards[userRole] || "/"} replace />;
  }

  // User is not authenticated, show the public page (login)
  return children;
}
