import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { db } from "../../firebase/config";
import { useAuth } from "../../hooks/useAuth";
import { User, Mail, Phone, Save, Edit2, Lock, Users, FileText } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminProfile() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stats, setStats] = useState({
    usersCreated: 0,
    totalUsers: 0,
    totalExams: 0,
  });

  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    phone: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const fetchProfile = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      const userSnap = await getDoc(doc(db, "users", currentUser.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};

      setFormData({
        displayName: userData.displayName || userData.name || currentUser.displayName || "",
        email: userData.email || currentUser.email || "",
        phone: userData.phone || "",
      });

      const [createdUsersSnap, allUsersSnap, examsSnap] = await Promise.all([
        getDocs(
          query(collection(db, "users"), where("createdBy", "==", currentUser.uid)),
        ),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "exams")),
      ]);

      setStats({
        usersCreated: createdUsersSnap.size,
        totalUsers: allUsersSnap.size,
        totalExams: examsSnap.size,
      });
    } catch (error) {
      console.error("Error loading admin profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handlePasswordInput = (event) => {
    const { name, value } = event.target;
    setPasswordData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;

    try {
      setSaving(true);

      await updateProfile(currentUser, { displayName: formData.displayName });
      await updateDoc(doc(db, "users", currentUser.uid), {
        displayName: formData.displayName,
        name: formData.displayName,
        phone: formData.phone,
      });

      toast.success("Profile updated successfully");
      setEditing(false);
    } catch (error) {
      console.error("Error saving admin profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    void fetchProfile();
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();

    if (!currentUser) return;

    if (!passwordData.currentPassword) {
      toast.error("Please enter current password");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    try {
      setSaving(true);
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordData.currentPassword,
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, passwordData.newPassword);
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password changed successfully");
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error("Failed to change password");
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
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Admin Profile</h1>
          <p className="text-gray-600 mt-2">Manage your admin account details and security</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-8">
          <StatCard title="Users Created" value={stats.usersCreated} icon={Users} color="blue" />
        </div>

        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Profile Information</h2>
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

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  disabled={!editing}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={!editing}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                />
              </div>
            </div>
          </div>

          {editing && (
            <div className="px-6 pb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Change Password</h2>
          <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="password"
              name="currentPassword"
              placeholder="Current password"
              value={passwordData.currentPassword}
              onChange={handlePasswordInput}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <input
              type="password"
              name="newPassword"
              placeholder="New password"
              value={passwordData.newPassword}
              onChange={handlePasswordInput}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm new password"
              value={passwordData.confirmPassword}
              onChange={handlePasswordInput}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  const colorClass = {
    blue: "border-blue-500 text-blue-600 bg-blue-50",
    green: "border-green-500 text-green-600 bg-green-50",
    purple: "border-purple-500 text-purple-600 bg-purple-50",
  };

  return (
    <div className={`bg-white p-6 rounded-lg shadow border-l-4 ${colorClass[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        {icon ? (() => {
          const StatIcon = icon;
          return <StatIcon className="w-6 h-6" />;
        })() : null}
      </div>
    </div>
  );
}
