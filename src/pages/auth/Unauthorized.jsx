import { useNavigate } from "react-router";
import { useAuth } from "../../hooks/useAuth";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";

export default function Unauthorized() {
  const navigate = useNavigate();
  const { userRole } = useAuth();

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    const roleDashboards = {
      admin: "/admin/dashboard",
      examiner: "/examiner/dashboard",
      student: "/student/dashboard",
    };
    navigate(roleDashboards[userRole] || "/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
          <ShieldAlert className="w-10 h-10 text-red-600" />
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Access Denied</h1>

        {/* Message */}
        <p className="text-lg text-gray-600 mb-2">
          You don't have permission to access this page.
        </p>
        <p className="text-sm text-gray-500 mb-8">
          This area is restricted to specific user roles. If you believe this is
          an error, please contact your administrator.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleGoBack}
            className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
          <button
            onClick={handleGoHome}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg"
          >
            <Home className="w-5 h-5" />
            Go to Dashboard
          </button>
        </div>

        {/* Current Role Info */}
        {userRole && (
          <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Your current role:</span>{" "}
              <span className="font-bold capitalize">{userRole}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
