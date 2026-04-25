import { useState } from "react";
import {
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
  signOut,
} from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { db, firebaseConfig } from "../../firebase/config";
import { Copy, CheckCircle, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import { getAppBaseUrl } from "../../utils/appUrl";

export default function UserModal({ user, onClose, onSuccess }) {
  const { currentUser } = useAuth();
  const isEditingAdmin = !!user && user.role === "admin";
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    enrollmentNumber: user?.enrollmentNumber || "",
    dob: user?.dob || "",
    role: user?.role || "student",
    isActive: user?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [invitationSent, setInvitationSent] = useState(false);
  const [setupInstructions, setSetupInstructions] = useState("");
  const [copied, setCopied] = useState(false);

  const isEnrollmentRole =
    formData.role === "student" || formData.role === "examiner";

  const normalizeEnrollment = (value) =>
    value.trim().toUpperCase().replace(/\s+/g, "");

  const isValidDobFormat = (value) => {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return false;
    const [dayStr, monthStr, yearStr] = value.split("/");
    const day = Number(dayStr);
    const month = Number(monthStr);
    const year = Number(yearStr);

    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) {
      return false;
    }

    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  };

  const createAuthUserInSecondaryApp = async (email, password, displayName) => {
    const appName = `user-create-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password,
      );

      await updateProfile(userCredential.user, {
        displayName,
      });

      return userCredential;
    } finally {
      try {
        await signOut(secondaryAuth);
      } catch {
        // Ignore signout errors during cleanup.
      }
      await deleteApp(secondaryApp);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (isEnrollmentRole && !formData.enrollmentNumber.trim()) {
      toast.error("Enrollment number is required for student/examiner");
      return;
    }

    if (!user && !formData.dob.trim()) {
      toast.error("DOB is required to set initial password");
      return;
    }

    if (!user && !isValidDobFormat(formData.dob.trim())) {
      toast.error("DOB must be in DD/MM/YYYY format");
      return;
    }

    if (!isEnrollmentRole && !formData.email.trim()) {
      toast.error("Email is required for admin");
      return;
    }

    if (!user && formData.role === "admin") {
      toast.error("Admin accounts must be provisioned manually by system owner.");
      return;
    }

    try {
      setSaving(true);

      if (user) {
        const previousEnrollment = user.enrollmentNumber
          ? normalizeEnrollment(user.enrollmentNumber)
          : null;
        const nextEnrollment = isEnrollmentRole
          ? normalizeEnrollment(formData.enrollmentNumber)
          : null;

        // Update existing user
        await updateDoc(doc(db, "users", user.uid), {
          name: formData.name,
          role: formData.role,
          isActive: formData.isActive,
          enrollmentNumber: nextEnrollment,
          dob: formData.dob?.trim() || null,
          updatedAt: serverTimestamp(),
        });

        if (previousEnrollment && previousEnrollment !== nextEnrollment) {
          await deleteDoc(doc(db, "loginIndex", previousEnrollment));
        }

        if (nextEnrollment) {
          await setDoc(
            doc(db, "loginIndex", nextEnrollment),
            {
              authEmail: user.authEmail || user.email || null,
              uid: user.uid,
              role: formData.role,
              isActive: formData.isActive,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        }

        toast.success("User updated successfully");
        onSuccess();
      } else {
        // Create new user - FREE PLAN METHOD

        // 1. Check if email already exists by checking Firestore
        const usersSnapshot = await getDocs(collection(db, "users"));
        const normalizedEnrollment = isEnrollmentRole
          ? normalizeEnrollment(formData.enrollmentNumber)
          : "";
        const authEmail = isEnrollmentRole
          ? `u${Date.now()}${Math.random().toString(36).slice(2, 8)}@certix.local`
          : formData.email.trim().toLowerCase();

        const existingUser = usersSnapshot.docs.find((doc) => {
          const data = doc.data();
          return (
            data.authEmail === authEmail ||
            data.email === authEmail ||
            (normalizedEnrollment &&
              data.enrollmentNumber === normalizedEnrollment)
          );
        });

        if (existingUser) {
          toast.error("User with this enrollment/email already exists");
          return;
        }

        // 2. Set initial password from DOB as requested by admin
        const tempPassword = formData.dob.trim();

        // 3. Create user in Firebase Auth
        const userCredential = await createAuthUserInSecondaryApp(
          authEmail,
          tempPassword,
          formData.name,
        );

        // 5. Create user document in Firestore
        await setDoc(doc(db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: isEnrollmentRole ? "" : authEmail,
          authEmail,
          name: formData.name,
          displayName: formData.name,
          role: formData.role,
          enrollmentNumber: normalizedEnrollment || null,
          loginId: normalizedEnrollment || authEmail,
          dob: formData.dob.trim(),
          isActive: true,
          emailVerified: false,
          pendingSetup: true,
          createdBy: currentUser?.uid || null,
          createdAt: serverTimestamp(),
        });

        if (normalizedEnrollment) {
          await setDoc(doc(db, "loginIndex", normalizedEnrollment), {
            authEmail,
            uid: userCredential.user.uid,
            role: formData.role,
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        // 6. Prepare account setup instructions
        setSetupInstructions(
          `
Hi ${formData.name},

Welcome to Certix Exam Portal! An account has been created for you with the following details:

• Login ID: ${normalizedEnrollment || authEmail}
• Initial Password (DOB): ${tempPassword}
• Role: ${formData.role.charAt(0).toUpperCase() + formData.role.slice(1)}

IMPORTANT: Login using the credentials above and change your password immediately after first login.

Login URL: ${getAppBaseUrl()}/login

Best regards,
Certix Admin Team
        `.trim(),
        );

        setInvitationSent(true);
        toast.success("User created successfully. Copy and share credentials.");
      }
    } catch (error) {
      console.error("Error saving user:", error);

      if (error.code === "auth/email-already-in-use") {
        toast.error("Email already in use");
      } else if (error.code === "auth/weak-password") {
        toast.error("Password should be at least 6 characters");
      } else if (error.code === "auth/invalid-email") {
        toast.error("Invalid email address");
      } else {
        toast.error(error.message || "Failed to create user");
      }
    } finally {
      setSaving(false);
    }
  };

  const copyInstructions = () => {
    navigator.clipboard.writeText(setupInstructions);
    setCopied(true);
    toast.success("Instructions copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold">
            {user
              ? "Edit User"
              : invitationSent
                ? "User Created Successfully!"
                : "Add Student/Examiner"}
          </h2>
        </div>

        {invitationSent ? (
          // Show invitation instructions after user creation
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-700">
                User account created successfully. Share the login credentials
                securely with the user.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">
                What happens next:
              </p>
              <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1 ml-2">
                <li>Share the generated Login ID and DOB password</li>
                <li>User logs in from the portal login page</li>
                <li>User sets email and verifies it to activate profile</li>
              </ol>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Instructions to send to user (optional)
              </label>
              <div className="relative">
                <textarea
                  value={setupInstructions}
                  readOnly
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-sm resize-none"
                />
                <div className="absolute top-2 right-2">
                  <button
                    type="button"
                    onClick={copyInstructions}
                    className="p-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1"
                    title="Copy instructions"
                  >
                    {copied ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span className="text-xs">
                      {copied ? "Copied!" : "Copy"}
                    </span>
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Copy these instructions and send them via your internal college
                communication channel.
              </p>
            </div>

            <div className="pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setInvitationSent(false);
                  setSetupInstructions("");
                  onSuccess();
                }}
                className="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          // Show form for creating/editing user
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
                disabled={saving}
              />
            </div>

            {isEnrollmentRole ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enrollment Number *
                </label>
                <input
                  type="text"
                  value={formData.enrollmentNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      enrollmentNumber: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={!!user || saving}
                  required
                  placeholder="e.g. ENR2026001"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be used as the student's/examiner's login ID.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={!!user || saving}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date of Birth (Initial Password) {!user && "*"}
              </label>
              <input
                type="text"
                value={formData.dob}
                onChange={(e) =>
                  setFormData({ ...formData, dob: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="DD/MM/YYYY"
                disabled={saving}
                required={!user}
              />
              <p className="text-xs text-gray-500 mt-1">
                Use format DD/MM/YYYY. This will be set as the initial password.
              </p>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role *
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
                disabled={saving || isEditingAdmin}
              >
                <option value="student">Student</option>
                <option value="examiner">Examiner</option>
                {isEditingAdmin && <option value="admin">Admin</option>}
              </select>
              {isEditingAdmin && (
                <p className="text-xs text-gray-500 mt-1">
                  Admin role cannot be changed from this screen.
                </p>
              )}
            </div>

            {/* Status */}
            {user ? (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 rounded"
                  disabled={saving}
                />
                <label className="ml-2 text-sm text-gray-700">Active User</label>
              </div>
            ) : (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                New users are created as active by default.
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : user ? (
                  "Update User"
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Create User
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
