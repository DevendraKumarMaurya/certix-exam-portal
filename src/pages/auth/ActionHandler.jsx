import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { auth, db } from "../../firebase/config";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  reload,
} from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import {
  Lock,
  CheckCircle,
  XCircle,
  Mail,
  Eye,
  EyeOff,
  ArrowLeft,
  UserPlus,
} from "lucide-react";
import toast from "react-hot-toast";
import Logo from "../../components/Logo";

export default function ActionHandler() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode");
  const token = searchParams.get("token"); // Custom verification token
  const uid = searchParams.get("uid"); // User ID for custom verification

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [validCode, setValidCode] = useState(false);
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [actionComplete, setActionComplete] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  const handleDirectActionLanding = async () => {
    try {
      if (!auth.currentUser) {
        toast.error("Open the verification link from your email inbox.");
        navigate("/login");
        return;
      }

      await reload(auth.currentUser);

      if (!auth.currentUser.emailVerified) {
        toast.error("Email is not verified yet. Please open the verification link from your email.");
        navigate("/login");
        return;
      }

      const userDocRef = doc(db, "users", auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        await updateDoc(userDocRef, {
          email: auth.currentUser.email || data.pendingEmail || data.email || "",
          authEmail: auth.currentUser.email || data.authEmail || "",
          emailVerified: true,
          pendingSetup: false,
          pendingEmail: null,
          updatedAt: new Date(),
        });
      }

      setValidCode(true);
      setActionComplete(true);
      toast.success("Email verified successfully.");
    } catch (error) {
      console.error("Direct action landing error:", error);
      toast.error("Unable to validate verification status. Please login and try again.");
      navigate("/login");
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (!mode) {
      handleDirectActionLanding();
      return;
    }

    // For custom email verification, we need token and uid
    if (mode === "verifyEmail" && token && uid) {
      verifyCustomToken();
    } else if (mode && oobCode) {
      verifyCode();
    } else {
      toast.error("Invalid or missing parameters in action link");
      navigate("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, oobCode, token, uid]);

  const verifyCode = async () => {
    setVerifying(true);
    try {
      if (mode === "resetPassword") {
        // Verify the password reset code and get the email
        const userEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(userEmail);
        setValidCode(true);

        // Check if this is a new user setup by looking for pendingSetup flag
        try {
          // Get all users and find one with matching email
          const usersRef = await getDocs(collection(db, "users"));
          const userDoc = usersRef.docs.find(
            (doc) => doc.data().email === userEmail,
          );

          if (userDoc && userDoc.data().pendingSetup === true) {
            setIsNewUser(true);
          }
        } catch (error) {
          console.error("Error checking user status:", error);
          // Continue anyway, treating as regular password reset
        }
      } else if (mode === "verifyEmail" || mode === "verifyAndChangeEmail") {
        // For email verification, we need to apply the action code
        await applyActionCode(auth, oobCode);

        // Update user's email verification status in Firestore
        try {
          // Get the current user or find user by checking auth state
          if (auth.currentUser) {
            // Update in Firestore
            const userDoc = doc(db, "users", auth.currentUser.uid);
            await updateDoc(userDoc, {
              emailVerified: true,
              verifiedAt: new Date(),
            });
          } else {
            // If no current user, we'll need to handle this differently
            console.warn("No current user found for email verification");
          }
        } catch (firestoreError) {
          console.error("Error updating Firestore:", firestoreError);
          // Continue anyway, email is still verified in Firebase Auth
        }

        setValidCode(true);
        setActionComplete(true);
        toast.success("Email verified successfully! You can now login.");
      } else {
        toast.error("Unsupported action type");
        navigate("/login");
      }
    } catch (error) {
      console.error("Verification error:", error);
      setValidCode(false);

      if (error.code === "auth/invalid-action-code") {
        toast.error(
          "This verification link is invalid or has already been used. Please request a new one.",
        );
      } else if (error.code === "auth/expired-action-code") {
        toast.error(
          "This verification link has expired. Please request a new one.",
        );
      } else if (error.code === "auth/user-disabled") {
        toast.error("This user account has been disabled.");
      } else if (error.code === "auth/user-not-found") {
        toast.error("No user found for this verification link.");
      } else {
        toast.error(
          "Failed to verify link. Please try again or contact support.",
        );
      }
    } finally {
      setVerifying(false);
    }
  };

  const verifyCustomToken = async () => {
    setVerifying(true);
    try {
      // Verify custom verification token
      const userDoc = await getDoc(doc(db, "users", uid));

      if (!userDoc.exists()) {
        throw new Error("User not found");
      }

      const userData = userDoc.data();

      // Check if token matches and hasn't expired
      if (!userData.verificationToken || userData.verificationToken !== token) {
        throw new Error("Invalid verification token");
      }

      if (
        userData.verificationTokenExpiry &&
        userData.verificationTokenExpiry.toDate() < new Date()
      ) {
        throw new Error("Verification token has expired");
      }

      // Token is valid, update user's email verification status
      await updateDoc(doc(db, "users", uid), {
        emailVerified: true,
        verifiedAt: new Date(),
        verificationToken: null, // Remove the token
        verificationTokenExpiry: null,
        pendingVerification: false,
      });

      setEmail(userData.email);
      setValidCode(true);
      setActionComplete(true);
      toast.success("Email verified successfully! You can now login.");
    } catch (error) {
      console.error("Custom verification error:", error);
      setValidCode(false);

      if (error.message === "User not found") {
        toast.error("User not found. Please contact support.");
      } else if (error.message === "Invalid verification token") {
        toast.error(
          "This verification link is invalid or has already been used.",
        );
      } else if (error.message === "Verification token has expired") {
        toast.error(
          "This verification link has expired. Please request a new one.",
        );
      } else {
        toast.error(
          "Failed to verify email. Please try again or contact support.",
        );
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    // Validation
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);

      // If this is a new user, update their Firestore document
      if (isNewUser) {
        try {
          // Find and update the user document
          const usersRef = await getDocs(collection(db, "users"));
          const userDoc = usersRef.docs.find(
            (doc) => doc.data().email === email,
          );

          if (userDoc) {
            await updateDoc(doc(db, "users", userDoc.id), {
              pendingSetup: false,
              emailVerified: true,
              passwordSet: true,
              setupCompletedAt: new Date(),
            });
          }
        } catch (firestoreError) {
          console.error("Error updating user document:", firestoreError);
          // Continue anyway - authentication was successful
        }
      }

      setActionComplete(true);
      toast.success(
        isNewUser ? "Account setup completed!" : "Password reset successful!",
      );
    } catch (error) {
      console.error("Password reset error:", error);

      if (error.code === "auth/weak-password") {
        toast.error("Password is too weak. Please use a stronger password");
      } else if (error.code === "auth/invalid-action-code") {
        toast.error("This link is invalid or has already been used");
      } else {
        toast.error("Failed to reset password. Please try again");
      }
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
          <p className="text-gray-600">Verifying your link...</p>
        </div>
      </div>
    );
  }

  if (!validCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Logo width="120px" className="drop-shadow-lg rounded-full" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
              Certix Exam Portal
            </h1>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Invalid Link
            </h2>
            <p className="text-gray-600 mb-6">
              This link is invalid, expired, or has already been used. Please
              request a new one.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (actionComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Logo width="120px" className="drop-shadow-lg rounded-full" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
              Certix Exam Portal
            </h1>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {isNewUser
                ? "Account Setup Complete!"
                : mode === "resetPassword"
                  ? "Password Reset Successful!"
                  : "Email Verified!"}
            </h2>
            <p className="text-gray-600 mb-6">
              {isNewUser
                ? "Your account has been set up successfully! You can now login with your new password."
                : mode === "resetPassword"
                  ? "Your password has been successfully reset. You can now login with your new password."
                  : "Your email has been successfully verified. You can now login to your account."}
            </p>
            <button
              onClick={() => navigate("/login")}
              className="w-full py-3 px-4 bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
            >
              Continue to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "resetPassword") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Logo width="120px" className="drop-shadow-lg rounded-full" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
              {isNewUser ? "Set Up Your Password" : "Reset Your Password"}
            </h1>
            <p className="text-gray-600">
              {isNewUser
                ? "Welcome! Create your password to complete account setup"
                : "Enter your new password below"}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 text-blue-800">
                {isNewUser ? (
                  <UserPlus className="w-5 h-5" />
                ) : (
                  <Mail className="w-5 h-5" />
                )}
                <p className="text-sm font-medium">{email}</p>
              </div>
              {isNewUser && (
                <p className="text-xs text-blue-600 mt-1">
                  Account created by administrator
                </p>
              )}
            </div>

            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isNewUser ? "Create Password" : "New Password"}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder={
                      isNewUser ? "Create your password" : "Enter new password"
                    }
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Must be at least 6 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isNewUser ? "Confirm Password" : "Confirm New Password"}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder={
                      isNewUser
                        ? "Confirm your password"
                        : "Confirm new password"
                    }
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                {isNewUser ? (
                  <UserPlus className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5" />
                )}
                {loading
                  ? isNewUser
                    ? "Setting Up Account..."
                    : "Resetting Password..."
                  : isNewUser
                    ? "Complete Setup"
                    : "Reset Password"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => navigate("/login")}
                className="text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

