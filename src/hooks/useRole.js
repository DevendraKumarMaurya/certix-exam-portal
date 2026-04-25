import { useAuth } from "./useAuth";

/**
 * Custom hook to check user role
 * @returns {Object} Role checking functions
 */
export function useRole() {
  const { userRole } = useAuth();

  return {
    isAdmin: userRole === "admin",
    isExaminer: userRole === "examiner",
    isStudent: userRole === "student",
    role: userRole,
    hasRole: (role) => userRole === role,
    hasAnyRole: (roles) => roles.includes(userRole),
  };
}

/**
 * Example usage:
 *
 * import { useRole } from '../hooks/useRole';
 *
 * function MyComponent() {
 *   const { isAdmin, isExaminer, isStudent } = useRole();
 *
 *   if (isAdmin) {
 *     return <AdminPanel />;
 *   }
 *
 *   if (isExaminer) {
 *     return <ExaminerPanel />;
 *   }
 *
 *   if (isStudent) {
 *     return <StudentPanel />;
 *   }
 *
 *   return <div>No access</div>;
 * }
 *
 * // Check multiple roles
 * const { hasAnyRole } = useRole();
 * if (hasAnyRole(['admin', 'examiner'])) {
 *   // Show content for admin or examiner
 * }
 */
