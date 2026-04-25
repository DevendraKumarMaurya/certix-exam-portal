import { useAuth } from "./useAuth";
import { useNavigate } from "react-router";
import { useEffect } from "react";

/**
 * Higher-Order Component (HOC) that wraps components requiring specific roles
 *
 * @param {React.Component} Component - Component to wrap
 * @param {string[]} allowedRoles - Array of roles allowed to access the component
 * @returns {React.Component} Wrapped component with role checking
 */
export function requireRole(Component, allowedRoles = []) {
  return function ProtectedComponent(props) {
    const { currentUser, userRole, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
      if (!loading) {
        // Not authenticated
        if (!currentUser) {
          navigate("/login", { replace: true });
          return;
        }

        // Not authorized (wrong role)
        if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
          // Redirect to appropriate dashboard based on user's role
          const roleDashboards = {
            admin: "/admin/dashboard",
            examiner: "/examiner/dashboard",
            student: "/student/dashboard",
          };

          navigate(roleDashboards[userRole] || "/", { replace: true });
        }
      }
    }, [currentUser, userRole, loading, navigate]);

    // Show loading state
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    // Don't render anything if not authenticated or not authorized
    if (
      !currentUser ||
      (allowedRoles.length > 0 && !allowedRoles.includes(userRole))
    ) {
      return null;
    }

    // Render the component if authorized
    return <Component {...props} />;
  };
}

/**
 * Usage Examples:
 *
 * // Wrap a component to require admin role
 * const AdminDashboard = () => {
 *   return <div>Admin Dashboard</div>;
 * };
 * export default requireRole(AdminDashboard, ['admin']);
 *
 * // Wrap a component to require multiple roles
 * const QuestionBank = () => {
 *   return <div>Question Bank</div>;
 * };
 * export default requireRole(QuestionBank, ['admin', 'examiner']);
 *
 * // Wrap a component to require any authenticated user
 * const Profile = () => {
 *   return <div>User Profile</div>;
 * };
 * export default requireRole(Profile); // Empty array = any authenticated user
 *
 * // Alternative: Create pre-configured wrappers
 * export const requireAdmin = (Component) => requireRole(Component, ['admin']);
 * export const requireExaminer = (Component) => requireRole(Component, ['examiner']);
 * export const requireStudent = (Component) => requireRole(Component, ['student']);
 * export const requireAuth = (Component) => requireRole(Component, []);
 *
 * // Then use like:
 * export default requireAdmin(AdminDashboard);
 */
