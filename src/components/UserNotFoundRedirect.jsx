import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";

export default function UserNotFoundRedirect() {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Logout and redirect to login
          handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleRedirect = async () => {
    try {
      // Clear tokens
      localStorage.removeItem("authExpiry");
      sessionStorage.removeItem("authExpiry");
      // Sign out
      await signOut(auth);
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      // Redirect to login using window.location
      window.location.href = "/login";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-red-100 rounded-full">
            <AlertTriangle className="w-12 h-12 text-red-600" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-3">
          User Not Found
        </h1>

        <p className="text-gray-600 mb-6">
          Your account information could not be found in our database. This may
          happen if:
        </p>

        <ul className="text-left text-gray-600 mb-6 space-y-2">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Your account has been deleted</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Your account is pending admin approval</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>There was an error during registration</span>
          </li>
        </ul>

        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-3">
            <span className="text-2xl sm:text-3xl font-bold text-blue-600">
              {countdown}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Redirecting to login page in {countdown} second
            {countdown !== 1 ? "s" : ""}...
          </p>
        </div>

        <button
          onClick={handleRedirect}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Return to Login Now
        </button>
      </div>
    </div>
  );
}

