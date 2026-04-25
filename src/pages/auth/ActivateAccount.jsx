import { useState } from "react";
import { useNavigate } from "react-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
  reload,
  signOut,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase/config";
import { useAuth } from "../../hooks/useAuth";
import toast from "react-hot-toast";
import { Mail, Lock, CheckCircle, LogOut } from "lucide-react";
import { getAppBaseUrl } from "../../utils/appUrl";

export default function ActivateAccount() {
  const navigate = useNavigate();
  const { currentUser, userProfile, fetchUserRole } = useAuth();
  const [email, setEmail] = useState(userProfile?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pendingEmail, setPendingEmail] = useState(userProfile?.pendingEmail || "");
  const [lastError, setLastError] = useState("");

  const handleSendVerification = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      toast.error("Please login again");
      return;
    }

    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }

    if (!currentPassword) {
      toast.error("Please enter current password");
      return;
    }

    try {
      setSaving(true);
      setLastError("");

      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword,
      );
      await reauthenticateWithCredential(currentUser, credential);

      const normalizedEmail = email.trim().toLowerCase();
      
      // We must use verifyBeforeUpdateEmail since Firebase blocks direct updateEmail
      await verifyBeforeUpdateEmail(currentUser, normalizedEmail, {
        url: `${getAppBaseUrl()}/auth/action`,
        handleCodeInApp: false,
      });

      await setDoc(
        doc(db, "users", currentUser.uid),
        {
          pendingEmail: normalizedEmail,
          emailVerified: false,
          pendingSetup: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setPendingEmail(normalizedEmail);

      toast.success(
        "Verification link sent. Open your email and complete verification.",
      );
    } catch (error) {
      console.error("Activation error:", error);
      setLastError(error.code || error.message || "Unknown verification error");
      if (error.code === "auth/invalid-credential") {
        toast.error("Current password is incorrect");
      } else if (error.code === "auth/email-already-in-use") {
        toast.error("Email is already in use");
      } else if (error.code === "auth/requires-recent-login") {
        toast.error("Please login again and retry");
      } else if (error.code === "auth/operation-not-allowed") {
        toast.error("Email/password authentication is disabled in Firebase Auth settings.");
      } else if (error.code === "auth/invalid-continue-uri") {
        toast.error("Invalid redirect URL in verification settings. Check Auth authorized domains.");
      } else if (error.code === "auth/unauthorized-continue-uri") {
        toast.error("Current domain is not authorized in Firebase Auth. Add it under Authorized domains.");
      } else if (error.code === "auth/too-many-requests") {
        toast.error("Too many requests. Please wait a few minutes and try again.");
      } else {
        toast.error(error.code || "Failed to send verification link");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleVerified = async () => {
    if (!currentUser) {
      toast.error("Please login again");
      return;
    }

    try {
      setChecking(true);
      await reload(currentUser);

      if (!auth.currentUser?.emailVerified) {
        toast.error("Email is not verified yet. Please check your inbox/spam.");
        return;
      }

      const latestProfile = await fetchUserRole(currentUser.uid);
      const verifiedEmail = auth.currentUser?.email || latestProfile?.pendingEmail || pendingEmail;
      if (!verifiedEmail) {
        toast.error("Verified email not found. Please login again.");
        return;
      }

      await setDoc(
        doc(db, "users", currentUser.uid),
        {
          email: verifiedEmail,
          authEmail: verifiedEmail,
          emailVerified: true,
          pendingSetup: false,
          pendingEmail: null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      if (latestProfile?.enrollmentNumber) {
        await setDoc(
          doc(db, "loginIndex", latestProfile.enrollmentNumber),
          {
            authEmail: verifiedEmail,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      await fetchUserRole(currentUser.uid);
      const rolePath =
        (latestProfile?.role || userProfile?.role) === "examiner"
          ? "/examiner/dashboard"
          : "/student/dashboard";
      navigate(rolePath, { replace: true });
      toast.success("Account activated successfully");
    } catch (error) {
      console.error("Verification check error:", error);
      toast.error("Unable to verify account status");
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out");
    }
  };

  return (
    <div className="min-h-screen relative bg-gray-50 flex items-center justify-center p-4">
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 md:top-6 md:right-8 flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span className="text-sm font-medium">Logout</span>
      </button>

      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 space-y-5">
        <h1 className="text-2xl font-bold text-gray-800">Activate Your Account</h1>
        <p className="text-sm text-gray-600">
          Set your email and verify it using the verification link sent to your inbox.
        </p>

        {pendingEmail && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Pending verification: {pendingEmail}
          </p>
        )}

        {lastError && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            Last verification error: {lastError}
          </div>
        )}

        <form onSubmit={handleSendVerification} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Email Address</label>
            <div className="relative mt-1">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Current Password</label>
            <div className="relative mt-1">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter current password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Sending..." : "Send Verification Link"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleVerified}
          disabled={checking}
          className="w-full border border-green-600 text-green-700 py-2 rounded-lg hover:bg-green-50 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          {checking ? "Checking..." : "I have verified"}
        </button>
      </div>
    </div>
  );
}
