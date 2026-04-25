import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  doc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../hooks/useAuth";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  Calendar,
  Mail,
  Clock,
  BarChart3,
  Award,
  FileText,
  Users,
  AlertCircle,
  Eye,
  X,
  User,
  Phone,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import toast from "react-hot-toast";
import UserModal from "../../components/admin/UserModal";
import FilterBar from "../../components/admin/FilterBar";

export default function UserManagement() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsUser, setDetailsUser] = useState(null);
  const [filters, setFilters] = useState({
    role: "all",
    status: "all",
    searchTerm: "",
  });

  useEffect(() => {
    fetchUsers();
  }, [currentUser]);

  const applyFilters = useCallback(() => {
    let filtered = [...users];

    // Filter by role
    if (filters.role !== "all") {
      filtered = filtered.filter((u) => u.role === filters.role);
    }

    // Filter by status
    if (filters.status !== "all") {
      const isActive = filters.status === "active";
      filtered = filtered.filter((u) => u.isActive === isActive);
    }

    // Search
    if (filters.searchTerm) {
      filtered = filtered.filter(
        (u) =>
          u.name?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
          u.email?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
          u.enrollmentNumber
            ?.toLowerCase()
            .includes(filters.searchTerm.toLowerCase()),
      );
    }

    setFilteredUsers(filtered);
  }, [users, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);

      // Fetch additional data for each user
      const usersList = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const userData = { uid: doc.id, ...doc.data() };

          // Fetch user statistics based on role
          if (userData.role === "student") {
            // Fetch exam attempts and results for students
            const attemptsQuery = query(
              collection(db, "examAttempts"),
              where("studentId", "==", userData.uid),
            );
            const attemptsSnapshot = await getDocs(attemptsQuery);

            const resultsQuery = query(
              collection(db, "results"),
              where("studentId", "==", userData.uid),
            );
            const resultsSnapshot = await getDocs(resultsQuery);

            userData.stats = {
              totalExams: attemptsSnapshot.size,
              completedExams: resultsSnapshot.size,
              averageScore:
                resultsSnapshot.size > 0
                  ? (
                      resultsSnapshot.docs.reduce(
                        (sum, doc) => sum + (doc.data().percentage || 0),
                        0,
                      ) / resultsSnapshot.size
                    ).toFixed(1)
                  : 0,
            };
          } else if (userData.role === "examiner") {
            // Fetch created exams and questions for examiners
            const examsQuery = query(
              collection(db, "exams"),
              where("createdBy", "==", userData.uid),
            );
            const examsSnapshot = await getDocs(examsQuery);

            const questionsQuery = query(
              collection(db, "questions"),
              where("createdBy", "==", userData.uid),
            );
            const questionsSnapshot = await getDocs(questionsQuery);

            userData.stats = {
              examsCreated: examsSnapshot.size,
              questionsCreated: questionsSnapshot.size,
            };
          } else if (userData.role === "admin") {
            // Fetch created users for admins
            const createdUsersQuery = query(
              collection(db, "users"),
              where("createdBy", "==", userData.uid),
            );
            const createdUsersSnapshot = await getDocs(createdUsersQuery);

            userData.stats = {
              usersCreated: createdUsersSnapshot.size,
            };
          }

          return userData;
        }),
      );

      // Sort by creation date (newest first)
      usersList.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
      );

      setUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (userRecord) => {
    if (userRecord.role === "admin") {
      toast.error("Admin accounts cannot be activated/deactivated from here.");
      return;
    }

    if (userRecord.uid === currentUser?.uid) {
      toast.error("You cannot deactivate your own account.");
      return;
    }

    try {
      const nextStatus = !userRecord.isActive;

      await updateDoc(doc(db, "users", userRecord.uid), {
        isActive: nextStatus,
      });

      if (userRecord.enrollmentNumber) {
        await setDoc(
          doc(db, "loginIndex", userRecord.enrollmentNumber),
          {
            authEmail: userRecord.authEmail || userRecord.email || null,
            uid: userRecord.uid,
            role: userRecord.role,
            isActive: nextStatus,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      toast.success(
        userRecord.isActive ? "User deactivated" : "User approved and activated!",
      );
      fetchUsers();
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast.error("Failed to update user status");
    }
  };

  const handleDeleteUser = async (userRecord) => {
    if (userRecord.role === "admin") {
      toast.error("Admin accounts cannot be deleted from this screen.");
      return;
    }

    if (userRecord.uid === currentUser?.uid) {
      toast.error("You cannot delete your own account.");
      return;
    }

    if (
      !window.confirm(
        "Are you sure you want to delete this user? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      // Check if user has any data
      const examsQuery = query(
        collection(db, "exams"),
        where("createdBy", "==", userRecord.uid),
      );
      const examsSnapshot = await getDocs(examsQuery);

      const attemptsQuery = query(
        collection(db, "examAttempts"),
        where("studentId", "==", userRecord.uid),
      );
      const attemptsSnapshot = await getDocs(attemptsQuery);

      if (!examsSnapshot.empty || !attemptsSnapshot.empty) {
        toast.error(
          "Cannot delete user with existing data. Deactivate instead.",
        );
        return;
      }

      await deleteDoc(doc(db, "users", userRecord.uid));

      if (userRecord.enrollmentNumber) {
        await deleteDoc(doc(db, "loginIndex", userRecord.enrollmentNumber));
      }

      toast.success("User deleted successfully");
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  const getRoleBadge = (role) => {
    const roleConfig = {
      admin: { bg: "bg-purple-100", text: "text-purple-700", label: "Admin" },
      examiner: { bg: "bg-blue-100", text: "text-blue-700", label: "Examiner" },
      student: { bg: "bg-green-100", text: "text-green-700", label: "Student" },
    };

    const config = roleConfig[role] || roleConfig.student;

    return (
      <span
        className={`px-3 py-1 text-xs rounded-full font-medium ${config.bg} ${config.text}`}
      >
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6 lg:p-8 overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              User Management
            </h1>
            <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
              Comprehensive user overview and management
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center w-full sm:w-auto gap-2 bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="whitespace-nowrap">Add Student/Examiner</span>
          </button>
        </div>

        {/* Summary Cards */}
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-6 md:overflow-visible md:pb-0 mb-6 sm:mb-8">
          <div className="min-w-[220px] snap-start md:min-w-0 bg-white p-5 sm:p-6 rounded-lg shadow border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.length}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="min-w-[220px] snap-start md:min-w-0 bg-white p-5 sm:p-6 rounded-lg shadow border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Active Users
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter((u) => u.isActive).length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="min-w-[220px] snap-start md:min-w-0 bg-white p-5 sm:p-6 rounded-lg shadow border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Pending Approval
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter((u) => !u.isActive).length}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="min-w-[220px] snap-start md:min-w-0 bg-white p-5 sm:p-6 rounded-lg shadow border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Setup Required
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter((u) => u.pendingSetup).length}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Role Distribution */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            User Distribution by Role
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:pb-0">
            <div className="min-w-[180px] snap-start md:min-w-0 text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {users.filter((u) => u.role === "student").length}
              </div>
              <div className="text-sm text-gray-600">Students</div>
            </div>
            <div className="min-w-[180px] snap-start md:min-w-0 text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {users.filter((u) => u.role === "examiner").length}
              </div>
              <div className="text-sm text-gray-600">Examiners</div>
            </div>
            <div className="min-w-[180px] snap-start md:min-w-0 text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {users.filter((u) => u.role === "admin").length}
              </div>
              <div className="text-sm text-gray-600">Admins</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <FilterBar
          filters={filters}
          onFilterChange={setFilters}
          showRoleFilter={true}
          showStatusFilter={true}
          statusOptions={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
        />

        {/* Mobile User Cards */}
        <div className="md:hidden bg-white rounded-lg shadow p-3 space-y-3 max-h-[62vh] overflow-y-auto">
          {filteredUsers.map((user) => (
            <div key={user.uid} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {user.displayName || user.name || "No Name"}
                  </p>
                  <p className="text-xs font-mono text-gray-600 break-all">
                    {user.role === "admin"
                      ? user.email || "Not set"
                      : user.enrollmentNumber || "Not set"}
                  </p>
                </div>
                {getRoleBadge(user.role)}
              </div>

              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {user.createdAt?.toDate()?.toLocaleDateString() || "Unknown"}
              </div>

              {user.stats && (
                <div className="text-xs text-gray-600">
                  {user.role === "student" && (
                    <span>{user.stats.totalExams} exams • Avg {user.stats.averageScore}%</span>
                  )}
                  {user.role === "examiner" && (
                    <span>{user.stats.examsCreated} exams • {user.stats.questionsCreated} questions</span>
                  )}
                  {user.role === "admin" && (
                    <span>{user.stats.usersCreated} users created</span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-4 gap-2 pt-1">
                <button
                  onClick={() => {
                    setDetailsUser(user);
                    setShowDetailsModal(true);
                  }}
                  className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                  title="View Full Details"
                >
                  <Eye className="w-4 h-4 mx-auto" />
                </button>
                <button
                  onClick={() => {
                    setSelectedUser(user);
                    setShowEditModal(true);
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit User"
                >
                  <Edit2 className="w-4 h-4 mx-auto" />
                </button>
                <button
                  onClick={() => handleToggleActive(user)}
                  className={`p-2 rounded-lg transition-colors ${
                    user.role === "admin" || user.uid === currentUser?.uid
                      ? "text-gray-400 cursor-not-allowed"
                      : user.isActive
                      ? "text-orange-600 hover:bg-orange-50"
                      : "text-green-600 hover:bg-green-50"
                  }`}
                  title={
                    user.role === "admin"
                      ? "Admin status changes are restricted"
                      : user.uid === currentUser?.uid
                        ? "You cannot deactivate your own account"
                        : user.isActive
                      ? "Deactivate User"
                      : "Approve & Activate User"
                  }
                  disabled={
                    user.role === "admin" || user.uid === currentUser?.uid
                  }
                >
                  {user.isActive ? (
                    <UserX className="w-4 h-4 mx-auto" />
                  ) : (
                    <UserCheck className="w-4 h-4 mx-auto" />
                  )}
                </button>
                <button
                  onClick={() => handleDeleteUser(user)}
                  className={`p-2 rounded-lg transition-colors ${
                    user.role === "admin" || user.uid === currentUser?.uid
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-red-600 hover:bg-red-50"
                  }`}
                  title={
                    user.role === "admin"
                      ? "Admin deletion is restricted"
                      : user.uid === currentUser?.uid
                        ? "You cannot delete your own account"
                        : "Delete User"
                  }
                  disabled={
                    user.role === "admin" || user.uid === currentUser?.uid
                  }
                >
                  <Trash2 className="w-4 h-4 mx-auto" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Users Table */}
        <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
          <div className="w-full max-w-full overflow-x-auto overflow-y-hidden">
            <div className="inline-block min-w-full align-middle max-h-[68vh] overflow-y-auto">
            <table className="w-full min-w-240 table-auto whitespace-nowrap">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                    User
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                    Login ID
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                    Role
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                    Activity
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="border-b hover:bg-gray-50">
                    {/* User Info */}
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">
                          {user.displayName || user.name || "No Name"}
                        </div>
                        {user.role === "admin" && (
                          <div className="text-sm text-gray-600 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                        )}
                        {user.role !== "admin" && user.enrollmentNumber && (
                          <div className="text-xs text-blue-600 font-mono">
                            Enrollment: {user.enrollmentNumber}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Created:{" "}
                          {user.createdAt?.toDate()?.toLocaleDateString() ||
                            "Unknown"}
                        </div>
                      </div>
                    </td>

                    {/* Login ID */}
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded inline-block">
                          {user.role === "admin"
                            ? user.email || "Not set"
                            : user.enrollmentNumber || "Not set"}
                        </div>
                        {user.role !== "admin" && (user.authEmail || user.email) && (
                          <div className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded inline-block">
                            {user.authEmail || user.email}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-4 px-4">
                      {getRoleBadge(user.role)}
                    </td>

                    {/* Statistics */}
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        {user.role === "student" && user.stats && (
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-1 text-gray-600">
                              <FileText className="w-3 h-3" />
                              {user.stats.totalExams} Exams
                            </div>
                            <div className="flex items-center gap-1 text-gray-600">
                              <Award className="w-3 h-3" />
                              Avg: {user.stats.averageScore}%
                            </div>
                            {user.course && (
                              <div className="text-xs text-gray-500">
                                Course: {user.course}
                              </div>
                            )}
                          </div>
                        )}
                        {user.role === "examiner" && user.stats && (
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-1 text-gray-600">
                              <FileText className="w-3 h-3" />
                              {user.stats.examsCreated} Exams
                            </div>
                            <div className="flex items-center gap-1 text-gray-600">
                              <BarChart3 className="w-3 h-3" />
                              {user.stats.questionsCreated} Questions
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Updated: {user.updatedAt?.toDate()?.toLocaleDateString() || "Never"}
                            </div>
                          </div>
                        )}
                        {user.role === "admin" && user.stats && (
                          <div className="text-sm">
                            <div className="flex items-center gap-1 text-gray-600">
                              <UserCheck className="w-3 h-3" />
                              {user.stats.usersCreated} Users Created
                            </div>
                          </div>
                        )}
                        {!user.stats && (
                          <div className="text-xs text-gray-400">
                            No activity
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setDetailsUser(user);
                            setShowDetailsModal(true);
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                          title="View Full Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowEditModal(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`p-2 rounded-lg transition-colors ${
                            user.role === "admin" || user.uid === currentUser?.uid
                              ? "text-gray-400 cursor-not-allowed"
                              : user.isActive
                              ? "text-orange-600 hover:bg-orange-50"
                              : "text-green-600 hover:bg-green-50"
                          }`}
                          title={
                            user.role === "admin"
                              ? "Admin status changes are restricted"
                              : user.uid === currentUser?.uid
                                ? "You cannot deactivate your own account"
                                : user.isActive
                              ? "Deactivate User"
                              : "Approve & Activate User"
                          }
                          disabled={
                            user.role === "admin" || user.uid === currentUser?.uid
                          }
                        >
                          {user.isActive ? (
                            <UserX className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className={`p-2 rounded-lg transition-colors ${
                            user.role === "admin" || user.uid === currentUser?.uid
                              ? "text-gray-400 cursor-not-allowed"
                              : "text-red-600 hover:bg-red-50"
                          }`}
                          title={
                            user.role === "admin"
                              ? "Admin deletion is restricted"
                              : user.uid === currentUser?.uid
                                ? "You cannot delete your own account"
                                : "Delete User"
                          }
                          disabled={
                            user.role === "admin" || user.uid === currentUser?.uid
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="flex flex-col items-center gap-2">
                <Search className="w-8 h-8 text-gray-400" />
                <p>No users found matching your filters</p>
                <p className="text-sm">
                  Try adjusting your search criteria or filters
                </p>
              </div>
            </div>
          )}
        </div>

        {filteredUsers.length === 0 && (
          <div className="md:hidden text-center py-12 text-gray-500">
            <div className="flex flex-col items-center gap-2">
              <Search className="w-8 h-8 text-gray-400" />
              <p>No users found matching your filters</p>
              <p className="text-sm">Try adjusting your search criteria or filters</p>
            </div>
          </div>
        )}

        {/* Modals */}
        {showAddModal && (
          <UserModal
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              fetchUsers();
              setShowAddModal(false);
            }}
          />
        )}

        {showEditModal && selectedUser && (
          <UserModal
            user={selectedUser}
            onClose={() => {
              setShowEditModal(false);
              setSelectedUser(null);
            }}
            onSuccess={() => {
              fetchUsers();
              setShowEditModal(false);
              setSelectedUser(null);
            }}
          />
        )}

        {/* User Details Modal */}
        {showDetailsModal && detailsUser && (
          <UserDetailsModal
            user={detailsUser}
            onClose={() => {
              setShowDetailsModal(false);
              setDetailsUser(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// User Details Modal Component
function UserDetailsModal({ user, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <User className="w-6 h-6" />
            User Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                Basic Information
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Display Name
                  </label>
                  <p className="text-gray-800">
                    {user.displayName || user.name || "Not provided"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Full Name
                  </label>
                  <p className="text-gray-800">{user.name || "Not provided"}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Email Address
                  </label>
                  <p className="text-gray-800">{user.email}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">
                    User ID (UID)
                  </label>
                  <p className="text-gray-800 font-mono text-sm bg-gray-100 p-2 rounded">
                    {user.uid}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Role
                  </label>
                  <p className="text-gray-800">
                    <span
                      className={`px-3 py-1 text-sm rounded-full font-medium ${
                        user.role === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : user.role === "examiner"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                      }`}
                    >
                      {user.role?.charAt(0).toUpperCase() +
                        user.role?.slice(1) || "Student"}
                    </span>
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Account Status
                  </label>
                  <div className="flex gap-2">
                    <span
                      className={`px-3 py-1 text-sm rounded-full font-medium ${
                        user.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {user.isActive ? "Active" : "Pending Approval"}
                    </span>
                    {user.pendingSetup && (
                      <span className="px-3 py-1 text-sm rounded-full font-medium bg-orange-100 text-orange-700">
                        Setup Required
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                Account Timeline
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Created At
                  </label>
                  <p className="text-gray-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {user.createdAt?.toDate()?.toLocaleString() || "Unknown"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Last Updated
                  </label>
                  <p className="text-gray-800 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {user.updatedAt?.toDate()?.toLocaleString() || "Never"}
                  </p>
                </div>

                {user.createdBy && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Created By
                    </label>
                    <p className="text-gray-800">Admin (System Generated)</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Student-specific Information */}
          {user.role === "student" && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                Student Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Enrollment Number
                    </label>
                    <p className="text-gray-800 font-mono">
                      {user.enrollmentNumber || "Not provided"}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Phone Number
                    </label>
                    <p className="text-gray-800 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {user.phone || "Not provided"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Course
                    </label>
                    <p className="text-gray-800 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      {user.course || "Not provided"}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Semester
                    </label>
                    <p className="text-gray-800">
                      {user.semester || "Not provided"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Statistics */}
          {user.stats && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Activity Statistics
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {user.role === "student" && (
                  <>
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {user.stats.totalExams}
                      </div>
                      <div className="text-sm text-blue-700">Total Exams</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {user.stats.completedExams}
                      </div>
                      <div className="text-sm text-green-700">Completed</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {user.stats.averageScore}%
                      </div>
                      <div className="text-sm text-purple-700">
                        Average Score
                      </div>
                    </div>
                  </>
                )}

                {user.role === "examiner" && (
                  <>
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {user.stats.examsCreated}
                      </div>
                      <div className="text-sm text-blue-700">Exams Created</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {user.stats.questionsCreated}
                      </div>
                      <div className="text-sm text-green-700">
                        Questions Created
                      </div>
                    </div>
                  </>
                )}

                {user.role === "admin" && (
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {user.stats.usersCreated}
                    </div>
                    <div className="text-sm text-purple-700">Users Created</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
