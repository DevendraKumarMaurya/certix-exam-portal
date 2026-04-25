import { useState, useEffect, useCallback } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import {
  updatePassword,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { db } from "../../firebase/config";
import { useAuth } from "../../hooks/useAuth";
import {
  User,
  Mail,
  Calendar,
  Award,
  BookOpen,
  Lock,
  Save,
  Edit2,
} from "lucide-react";
import toast from "react-hot-toast";

export default function Profile() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stats, setStats] = useState({
    totalExams: 0,
    completed: 0,
    avgScore: 0,
  });

  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    phone: "",
    enrollmentNumber: "",
    course: "",
    semester: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const fetchUserData = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Fetch user profile
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setFormData({
          displayName: data.displayName || "",
          email: data.email || currentUser.email || "",
          phone: data.phone || "",
          enrollmentNumber: data.enrollmentNumber || "",
          course: data.course || "",
          semester: data.semester || "",
        });
      }

      // Fetch exam statistics
      const resultsRef = collection(db, "results");
      const resultsQuery = query(
        resultsRef,
        where("studentId", "==", currentUser.uid),
        where("isPublished", "==", true),
      );
      const resultsSnapshot = await getDocs(resultsQuery);

      const totalExams = resultsSnapshot.size;
      const completed = resultsSnapshot.docs.filter(
        (doc) => doc.data().status === "pass" || doc.data().status === "fail",
      ).length;

      let totalPercentage = 0;
      resultsSnapshot.forEach((doc) => {
        totalPercentage += doc.data().percentage || 0;
      });
      const avgScore =
        totalExams > 0 ? (totalPercentage / totalExams).toFixed(2) : 0;

      setStats({ totalExams, completed, avgScore });
    } catch (error) {
      console.error("Error fetching user data:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    // If email is being changed, require current password
    if (formData.email !== currentUser.email && !passwordData.currentPassword) {
      toast.error("Please enter your current password to update email");
      return;
    }

    try {
      setSaving(true);

      // Reauthenticate if email is being changed
      if (formData.email !== currentUser.email) {
        const credential = EmailAuthProvider.credential(
          currentUser.email,
          passwordData.currentPassword,
        );
        await reauthenticateWithCredential(currentUser, credential);

        // Update email
        await updateEmail(currentUser, formData.email);
        await updateDoc(doc(db, "users", currentUser.uid), {
          email: formData.email,
        });
      }

      // Update Firestore user document
      await updateDoc(doc(db, "users", currentUser.uid), {
        displayName: formData.displayName,
        phone: formData.phone,
        enrollmentNumber: formData.enrollmentNumber,
        course: formData.course,
        semester: formData.semester,
      });

      toast.success("Profile updated successfully");
      setEditing(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      fetchUserData();
    } catch (error) {
      console.error("Error updating profile:", error);
      if (error.code === "auth/wrong-password") {
        toast.error("Current password is incorrect");
      } else if (error.code === "auth/requires-recent-login") {
        toast.error("Please log out and log in again to update your email");
      } else if (error.code === "auth/invalid-credential") {
        toast.error("Invalid current password");
      } else {
        toast.error("Failed to update profile");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!passwordData.currentPassword) {
      toast.error("Please enter your current password");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setSaving(true);

      // Reauthenticate user with current password
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordData.currentPassword,
      );
      await reauthenticateWithCredential(currentUser, credential);

      // Update password
      await updatePassword(currentUser, passwordData.newPassword);
      toast.success("Password changed successfully");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("Error changing password:", error);
      if (error.code === "auth/wrong-password") {
        toast.error("Current password is incorrect");
      } else if (error.code === "auth/invalid-credential") {
        toast.error("Invalid current password");
      } else if (error.code === "auth/requires-recent-login") {
        toast.error("Please log out and log in again to change your password");
      } else {
        toast.error("Failed to change password");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">My Profile</h1>
          <p className="text-gray-600 mt-2">
            Manage your account settings and view your statistics
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Exams"
            value={stats.totalExams}
            icon={BookOpen}
            color="blue"
          />
          <StatCard
            title="Completed"
            value={stats.completed}
            icon={Award}
            color="green"
          />
          <StatCard
            title="Average Score"
            value={`${stats.avgScore}%`}
            icon={Calendar}
            color="purple"
          />
        </div>

        {/* Profile Information */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              Profile Information
            </h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </button>
            )}
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleInputChange}
                    disabled={!editing}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={!editing}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={!editing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enrollment Number
                </label>
                <input
                  type="text"
                  name="enrollmentNumber"
                  value={formData.enrollmentNumber}
                  onChange={handleInputChange}
                  disabled={!editing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Course
                </label>
                <input
                  type="text"
                  name="course"
                  value={formData.course}
                  onChange={handleInputChange}
                  disabled={!editing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Semester
                </label>
                <input
                  type="text"
                  name="semester"
                  value={formData.semester}
                  onChange={handleInputChange}
                  disabled={!editing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>
            </div>

            {editing && (
              <div className="mt-6 space-y-4">
                {/* Current Password for Email Change */}
                {formData.email !== currentUser.email && (
                  <div className="max-w-md">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Password <span className="text-red-500">*</span>
                      <span className="text-xs text-gray-500 ml-2">
                        (Required to change email)
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Lock className="w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        name="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        required
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter current password to verify"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setPasswordData({
                        currentPassword: "",
                        newPassword: "",
                        confirmPassword: "",
                      });
                      fetchUserData();
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">Change Password</h2>
          </div>

          <form onSubmit={handleChangePassword} className="p-6">
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    required
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter current password"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    required
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter new password"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                {saving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
// eslint-disable-next-line no-unused-vars
function StatCard({ title, value, icon: Icon, color }) {
  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    purple: "bg-purple-500",
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
        <div className={`${colorClasses[color]} p-3 rounded-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}


