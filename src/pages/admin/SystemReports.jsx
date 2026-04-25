import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import {
  BarChart3,
  Download,
  TrendingUp,
  Users,
  FileText,
  Award,
} from "lucide-react";
import toast from "react-hot-toast";
import StatCard from "../../components/ui/StatCard";
import UserDistributionCard from "../../components/admin/UserDistributionCard";
import { exportToCSV } from "../../utils/csvExport";

export default function SystemReports() {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    overview: {},
    userStats: {},
    examStats: {},
    subjectPerformance: [],
    topPerformers: [],
    recentActivity: [],
  });

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);

      // Fetch all data
      const [usersSnapshot, examsSnapshot, attemptsSnapshot, resultsSnapshot] =
        await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "exams")),
          getDocs(collection(db, "examAttempts")),
          getDocs(collection(db, "results")),
        ]);

      const users = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const exams = examsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const attempts = attemptsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const results = resultsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Calculate overview stats
      const overview = {
        totalUsers: users.length,
        totalExams: exams.length,
        totalAttempts: attempts.length,
        totalResults: results.length,
        averageScore:
          results.length > 0
            ? (
                results.reduce((sum, r) => sum + (r.percentage || 0), 0) /
                results.length
              ).toFixed(2)
            : 0,
      };

      // User statistics
      const userStats = {
        students: users.filter((u) => u.role === "student").length,
        examiners: users.filter((u) => u.role === "examiner").length,
        admins: users.filter((u) => u.role === "admin").length,
        activeUsers: users.filter((u) => u.isActive).length,
      };

      // Exam statistics
      const now = new Date();
      const examStats = {
        published: exams.filter((e) => e.isPublished).length,
        active: exams.filter((e) => {
          const start = e.startTime?.toDate();
          const end = e.endTime?.toDate();
          return start && end && now >= start && now <= end;
        }).length,
        completed: exams.filter((e) => {
          const end = e.endTime?.toDate();
          return end && now > end;
        }).length,
        scheduled: exams.filter((e) => {
          const start = e.startTime?.toDate();
          return start && now < start;
        }).length,
      };

      // Subject-wise performance
      const subjectMap = {};
      results.forEach((result) => {
        const exam = exams.find((e) => e.id === result.examId);
        if (exam?.subject) {
          if (!subjectMap[exam.subject]) {
            subjectMap[exam.subject] = { scores: [], count: 0 };
          }
          subjectMap[exam.subject].scores.push(result.percentage || 0);
          subjectMap[exam.subject].count++;
        }
      });

      const subjectPerformance = Object.entries(subjectMap).map(
        ([subject, data]) => ({
          subject,
          avgScore: (
            data.scores.reduce((sum, s) => sum + s, 0) / data.count
          ).toFixed(2),
          attempts: data.count,
        }),
      );

      // Top performers
      const studentScores = {};
      results.forEach((result) => {
        if (!studentScores[result.studentId]) {
          studentScores[result.studentId] = { scores: [], total: 0 };
        }
        studentScores[result.studentId].scores.push(result.percentage || 0);
      });

      const topPerformersData = await Promise.all(
        Object.entries(studentScores)
          .map(([studentId, data]) => ({
            studentId,
            avgScore:
              data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length,
            examCount: data.scores.length,
          }))
          .sort((a, b) => b.avgScore - a.avgScore)
          .slice(0, 10)
          .map(async (performer) => {
            const user = users.find((u) => u.id === performer.studentId);
            return {
              ...performer,
              name: user?.name || "Unknown",
              email: user?.email || "",
            };
          }),
      );

      setReportData({
        overview,
        userStats,
        examStats,
        subjectPerformance,
        topPerformers: topPerformersData,
        recentActivity: attempts
          .sort(
            (a, b) => (b.startedAt?.seconds || 0) - (a.startedAt?.seconds || 0),
          )
          .slice(0, 10),
      });
    } catch (error) {
      console.error("Error fetching report data:", error);
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  const exportOverviewReport = () => {
    const data = [
      { Metric: "Total Users", Value: reportData.overview.totalUsers },
      { Metric: "Total Exams", Value: reportData.overview.totalExams },
      { Metric: "Total Attempts", Value: reportData.overview.totalAttempts },
      { Metric: "Total Results", Value: reportData.overview.totalResults },
      {
        Metric: "Platform Average Score",
        Value: `${reportData.overview.averageScore}%`,
      },
      { Metric: "Students", Value: reportData.userStats.students },
      { Metric: "Examiners", Value: reportData.userStats.examiners },
      { Metric: "Admins", Value: reportData.userStats.admins },
      { Metric: "Active Exams", Value: reportData.examStats.active },
      { Metric: "Completed Exams", Value: reportData.examStats.completed },
    ];
    exportToCSV(data, "platform_overview");
  };

  // Helper component for user/exam stats cards with colored border
  const UserStatCard = ({ label, value, color }) => {
    const colorConfig = {
      blue: "border-blue-500 bg-blue-50",
      green: "border-green-500 bg-green-50",
      purple: "border-purple-500 bg-purple-50",
      orange: "border-orange-500 bg-orange-50",
    };

    return (
      <div className={`${colorConfig[color]} border-l-4 p-6 rounded-lg`}>
        <p className="text-sm text-gray-600 mb-2">{label}</p>
        <p className="text-2xl sm:text-3xl font-bold text-gray-800">{value}</p>
      </div>
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
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">System Reports</h1>
            <p className="text-gray-600 mt-2">
              Comprehensive platform analytics and insights
            </p>
          </div>
          <button
            onClick={exportOverviewReport}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            <Download className="w-5 h-5" />
            Export Overview
          </button>
        </div>

        {/* Overview Stats */}
        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory mb-8 md:grid md:grid-cols-2 lg:grid-cols-5 md:gap-6 md:overflow-visible md:pb-0">
          <div className="min-w-[220px] snap-start md:min-w-0">
            <StatCard
              icon={Users}
              label="Total Users"
              value={reportData.overview.totalUsers}
              color="bg-blue-500"
            />
          </div>
          <div className="min-w-[220px] snap-start md:min-w-0">
            <StatCard
              icon={FileText}
              label="Total Exams"
              value={reportData.overview.totalExams}
              color="bg-green-500"
            />
          </div>
          <div className="min-w-[220px] snap-start md:min-w-0">
            <StatCard
              icon={TrendingUp}
              label="Total Attempts"
              value={reportData.overview.totalAttempts}
              color="bg-purple-500"
            />
          </div>
          <div className="min-w-[220px] snap-start md:min-w-0">
            <StatCard
              icon={Award}
              label="Results Published"
              value={reportData.overview.totalResults}
              color="bg-orange-500"
            />
          </div>
          <div className="min-w-[220px] snap-start md:min-w-0">
            <StatCard
              icon={BarChart3}
              label="Platform Avg"
              value={`${reportData.overview.averageScore}%`}
              color="bg-pink-500"
            />
          </div>
        </div>

        {/* User Distribution */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">
              User Distribution
            </h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-4 md:gap-6 md:overflow-visible md:pb-0">
            <div className="min-w-[200px] snap-start md:min-w-0">
              <UserStatCard
                label="Students"
                value={reportData.userStats.students}
                color="blue"
              />
            </div>
            <div className="min-w-[200px] snap-start md:min-w-0">
              <UserStatCard
                label="Examiners"
                value={reportData.userStats.examiners}
                color="green"
              />
            </div>
            <div className="min-w-[200px] snap-start md:min-w-0">
              <UserStatCard
                label="Admins"
                value={reportData.userStats.admins}
                color="purple"
              />
            </div>
            <div className="min-w-[200px] snap-start md:min-w-0">
              <UserStatCard
                label="Active Users"
                value={reportData.userStats.activeUsers}
                color="orange"
              />
            </div>
          </div>
        </div>

        {/* Exam Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Exam Status</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-4 md:gap-6 md:overflow-visible md:pb-0">
            <div className="min-w-[200px] snap-start md:min-w-0">
              <UserStatCard
                label="Published"
                value={reportData.examStats.published}
                color="blue"
              />
            </div>
            <div className="min-w-[200px] snap-start md:min-w-0">
              <UserStatCard
                label="Active"
                value={reportData.examStats.active}
                color="green"
              />
            </div>
            <div className="min-w-[200px] snap-start md:min-w-0">
              <UserStatCard
                label="Completed"
                value={reportData.examStats.completed}
                color="purple"
              />
            </div>
            <div className="min-w-[200px] snap-start md:min-w-0">
              <UserStatCard
                label="Scheduled"
                value={reportData.examStats.scheduled}
                color="orange"
              />
            </div>
          </div>
        </div>

        {/* Subject Performance */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">
              Subject-wise Performance
            </h2>
            <button
              onClick={() =>
                exportToCSV(
                  reportData.subjectPerformance,
                  "subject_performance",
                )
              }
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto pr-1">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Subject
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">
                    Attempts
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">
                    Avg Score
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">
                    Performance
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportData.subjectPerformance.map((subject, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{subject.subject}</td>
                    <td className="py-3 px-4 text-center">
                      {subject.attempts}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold">
                      {subject.avgScore}%
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              parseFloat(subject.avgScore) >= 75
                                ? "bg-green-500"
                                : parseFloat(subject.avgScore) >= 50
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            }`}
                            style={{ width: `${subject.avgScore}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reportData.subjectPerformance.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No subject performance data available
              </div>
            )}
          </div>
        </div>

        {/* Top Performers */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">
              Top 10 Performers
            </h2>
            <button
              onClick={() =>
                exportToCSV(reportData.topPerformers, "top_performers")
              }
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto pr-1">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Rank
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Email
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">
                    Exams Taken
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">
                    Avg Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportData.topPerformers.map((student, index) => (
                  <tr
                    key={student.studentId}
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      <span
                        className={`font-bold ${index < 3 ? "text-yellow-600" : "text-gray-600"}`}
                      >
                        #{index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">{student.name}</td>
                    <td className="py-3 px-4 text-gray-600">{student.email}</td>
                    <td className="py-3 px-4 text-center">
                      {student.examCount}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-semibold text-green-600">
                        {student.avgScore.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reportData.topPerformers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No performance data available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


