import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../hooks/useAuth";
import {
  Users,
  FileText,
  Calendar,
  Activity,
  TrendingUp,
  UserCheck,
  UserCog,
  GraduationCap,
} from "lucide-react";
import toast from "react-hot-toast";
import StatCard from "../../components/ui/StatCard";
import UserDistributionCard from "../../components/admin/UserDistributionCard";

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalExams: 0,
    totalQuestions: 0,
    activeExams: 0,
    students: 0,
    examiners: 0,
    admins: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [currentUser]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch all users
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);

      let students = 0,
        examiners = 0,
        admins = 0;
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.role === "student") students++;
        else if (data.role === "examiner") examiners++;
        else if (data.role === "admin") admins++;
      });

      // Fetch all exams
      const examsRef = collection(db, "exams");
      const examsSnapshot = await getDocs(examsRef);

      let activeExams = 0;
      examsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === "ongoing" || data.status === "scheduled") {
          activeExams++;
        }
      });

      // Fetch all questions
      const questionsRef = collection(db, "questions");
      const questionsSnapshot = await getDocs(questionsRef);

      // Fetch recent activity (last 10 exams created)
      const recentExamsQuery = query(
        examsRef,
        orderBy("createdAt", "desc"),
        limit(10),
      );
      const recentExamsSnapshot = await getDocs(recentExamsQuery);

      const activities = [];
      for (const doc of recentExamsSnapshot.docs) {
        const exam = { id: doc.id, ...doc.data() };
        const creatorDoc = await getDocs(
          query(
            collection(db, "users"),
            where("__name__", "==", exam.createdBy),
          ),
        );
        const creatorName = creatorDoc.docs[0]?.data()?.name || "Unknown";

        activities.push({
          id: doc.id,
          type: "exam_created",
          message: `${creatorName} created exam "${exam.title}"`,
          timestamp: exam.createdAt?.toDate(),
          exam,
        });
      }

      setStats({
        totalUsers: usersSnapshot.size,
        totalExams: examsSnapshot.size,
        totalQuestions: questionsSnapshot.size,
        activeExams,
        students,
        examiners,
        admins,
      });

      setRecentActivity(activities);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1 sm:mt-2">System overview and statistics</p>
        </div>

        {/* Stats Grid */}
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-6 sm:overflow-visible sm:pb-0">
          <div className="min-w-[240px] snap-start sm:min-w-0">
            <StatCard
              icon={Users}
              label="Total Users"
              value={stats.totalUsers}
              color="bg-blue-500"
              subtext={`${stats.students} students • ${stats.examiners} examiners • ${stats.admins} admins`}
              onClick={() => navigate("/admin/users")}
            />
          </div>
          <div className="min-w-[240px] snap-start sm:min-w-0">
            <StatCard
              icon={FileText}
              label="Total Exams"
              value={stats.totalExams}
              color="bg-green-500"
              subtext={`${stats.activeExams} active`}
              onClick={() => navigate("/admin/monitoring")}
            />
          </div>
          <div className="min-w-[240px] snap-start sm:min-w-0">
            <StatCard
              icon={Calendar}
              label="Questions"
              value={stats.totalQuestions}
              color="bg-purple-500"
            />
          </div>
          <div className="min-w-[240px] snap-start sm:min-w-0">
            <StatCard
              icon={Activity}
              label="System Health"
              value="Normal"
              color="bg-green-500"
            />
          </div>
        </div>

        {/* User Distribution */}
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:pb-0 mb-2 sm:mb-4 lg:mb-8">
          <div className="min-w-[220px] snap-start lg:min-w-0">
            <UserDistributionCard
              role="Students"
              count={stats.students}
              icon={<GraduationCap className="w-8 h-8 text-blue-600" />}
              colorClass="bg-blue-50"
            />
          </div>
          <div className="min-w-[220px] snap-start lg:min-w-0">
            <UserDistributionCard
              role="Examiners"
              count={stats.examiners}
              icon={<UserCog className="w-8 h-8 text-green-600" />}
              colorClass="bg-green-50"
            />
          </div>
          <div className="min-w-[220px] snap-start lg:min-w-0">
            <UserDistributionCard
              role="Admins"
              count={stats.admins}
              icon={<UserCheck className="w-8 h-8 text-purple-600" />}
              colorClass="bg-purple-50"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-600" />
            Recent Activity
          </h2>

          {recentActivity.length > 0 ? (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="border-l-4 border-blue-500 pl-4 py-2 hover:bg-gray-50"
                >
                  <p className="text-sm font-medium text-gray-800">
                    {activity.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {activity.timestamp?.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No recent activity</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0 mt-2 sm:mt-4 md:mt-8">
          <button
            onClick={() => navigate("/admin/users")}
            className="min-w-[240px] snap-start md:min-w-0 bg-blue-600 text-white p-5 sm:p-6 rounded-lg hover:bg-blue-700 transition-colors text-left"
          >
            <Users className="w-8 h-8 mb-3" />
            <h3 className="text-lg font-semibold">Manage Users</h3>
            <p className="text-sm text-blue-100 mt-1">
              Add, edit, or remove users
            </p>
          </button>

          <button
            onClick={() => navigate("/admin/monitoring")}
            className="min-w-[240px] snap-start md:min-w-0 bg-green-600 text-white p-5 sm:p-6 rounded-lg hover:bg-green-700 transition-colors text-left"
          >
            <FileText className="w-8 h-8 mb-3" />
            <h3 className="text-lg font-semibold">Monitor Exams</h3>
            <p className="text-sm text-green-100 mt-1">
              View all exam activity
            </p>
          </button>

          <button
            onClick={() => navigate("/admin/reports")}
            className="min-w-[240px] snap-start md:min-w-0 bg-purple-600 text-white p-5 sm:p-6 rounded-lg hover:bg-purple-700 transition-colors text-left"
          >
            <TrendingUp className="w-8 h-8 mb-3" />
            <h3 className="text-lg font-semibold">View Reports</h3>
            <p className="text-sm text-purple-100 mt-1">
              Analytics and statistics
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
