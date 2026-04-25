import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../hooks/useAuth";
import {
  Calendar,
  Clock,
  TrendingUp,
  Award,
  BookOpen,
  AlertCircle,
  CheckCircle,
  Play,
} from "lucide-react";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import StatCard from "../../components/ui/StatCard";

export default function StudentDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalExams: 0,
    completed: 0,
    upcoming: 0,
    averageScore: 0,
  });
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [recentResults, setRecentResults] = useState([]);
  const [attemptedExamIds, setAttemptedExamIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const now = new Date();

      // Fetch exams assigned to this student
      const examsRef = collection(db, "exams");
      const examsQuery = query(
        examsRef,
        where("assignedTo", "array-contains", currentUser.uid),
      );
      const examsSnapshot = await getDocs(examsQuery);
      const examMetaById = {};

      let upcoming = 0;
      const upcomingExamsList = [];

      examsSnapshot.forEach((doc) => {
        const exam = { id: doc.id, ...doc.data() };
        const examStartTime = exam.scheduledDate?.toDate();
        const examEndTime = exam.endDateTime?.toDate();

        examMetaById[exam.id] = {
          title: exam.title,
          subject: exam.subject,
          totalMarks: Number(exam.totalMarks || 0),
          passingMarks: Number(exam.passingMarks || 0),
        };

        if (examStartTime && examStartTime > now) {
          upcoming++;
        }

        if (examStartTime && examEndTime && now <= examEndTime) {
          upcomingExamsList.push(exam);
        }
      });

      // Sort upcoming exams by start time
      upcomingExamsList.sort(
        (a, b) => a.scheduledDate?.toDate() - b.scheduledDate?.toDate(),
      );

      // Fetch student's exam attempts
      const attemptsRef = collection(db, "examAttempts");
      const attemptsQuery = query(
        attemptsRef,
        where("studentId", "==", currentUser.uid),
      );
      const attemptsSnapshot = await getDocs(attemptsQuery);
      const completed = attemptsSnapshot.size;
      const attemptedIds = new Set(
        attemptsSnapshot.docs
          .map((attemptDoc) => attemptDoc.data()?.examId)
          .filter(Boolean),
      );

      // Fetch recent results
      const resultsRef = collection(db, "results");
      const resultsQuery = query(
        resultsRef,
        where("studentId", "==", currentUser.uid),
        where("isPublished", "==", true),
      );
      const resultsSnapshot = await getDocs(resultsQuery);

      const results = [];
      let totalPercentage = 0;

      resultsSnapshot.docs.forEach((resultDoc) => {
        const result = { id: resultDoc.id, ...resultDoc.data() };
        const examMeta = examMetaById[result.examId] || {};
        const totalMarks = Number(result.totalMarks ?? examMeta.totalMarks ?? 0);
        const marksObtained = Number(result.marksObtained ?? 0);
        const percentage = Number.isFinite(Number(result.percentage))
          ? Number(result.percentage)
          : totalMarks > 0
            ? (marksObtained / totalMarks) * 100
            : 0;
        const passingPercentage = Number(examMeta.passingMarks || 0);

        result.totalMarks = totalMarks;
        result.marksObtained = marksObtained;
        result.percentage = percentage;
        result.status =
          percentage >= passingPercentage
            ? "pass"
            : result.status || "fail";
        result.examTitle = result.examTitle || examMeta.title || "Exam";
        result.subject = result.subject || examMeta.subject || "-";

        totalPercentage += result.percentage || 0;
        results.push(result);
      });

      // Sort results by published date and take latest 5
      results.sort((a, b) => {
        const dateA = a.publishedAt?.toDate() || new Date(0);
        const dateB = b.publishedAt?.toDate() || new Date(0);
        return dateB - dateA;
      });

      const avgScore =
        results.length > 0 ? totalPercentage / results.length : 0;

      setStats({
        totalExams: examsSnapshot.size,
        completed,
        upcoming,
        averageScore: avgScore.toFixed(1),
      });

      setUpcomingExams(upcomingExamsList.slice(0, 5));
      setRecentResults(results.slice(0, 5));
      setAttemptedExamIds(attemptedIds);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const canStartExam = (exam) => {
    const now = new Date();
    const startTime = exam.scheduledDate?.toDate();
    const endTime = exam.endDateTime?.toDate();

    return (
      startTime &&
      endTime &&
      now >= startTime &&
      now <= endTime &&
      !attemptedExamIds.has(exam.id)
    );
  };

  const handleStartExam = (examId) => {
    navigate(`/student/exam/${examId}/instructions`);
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Student Dashboard
          </h1>
          <p className="text-gray-600 mt-1 sm:mt-2">
            Overview of your academic progress
          </p>
        </div>

        {/* Stats Grid */}
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-2 md:grid-cols-4 sm:gap-6 sm:overflow-visible sm:pb-0">
          <div className="min-w-55 snap-start sm:min-w-0">
            <StatCard
              icon={BookOpen}
              label="Total Exams"
              value={stats.totalExams}
              color="bg-blue-500"
            />
          </div>
          <div className="min-w-55 snap-start sm:min-w-0">
            <StatCard
              icon={CheckCircle}
              label="Completed"
              value={stats.completed}
              color="bg-green-500"
            />
          </div>
          <div className="min-w-55 snap-start sm:min-w-0">
            <StatCard
              icon={Calendar}
              label="Upcoming"
              value={stats.upcoming}
              color="bg-purple-500"
            />
          </div>
          <div className="min-w-55 snap-start sm:min-w-0">
            <StatCard
              icon={TrendingUp}
              label="Average Score"
              value={`${stats.averageScore}%`}
              color="bg-orange-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upcoming Exams */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                Upcoming Exams
              </h2>
              <button
                onClick={() => navigate("/student/exams")}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View All
              </button>
            </div>

            {upcomingExams.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No upcoming exams</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                {upcomingExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 mb-2">
                          {exam.title}
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">
                          {exam.subject}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {exam.scheduledDate?.toDate().toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{exam.duration} min</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Award className="w-4 h-4" />
                            <span>{exam.totalMarks} marks</span>
                          </div>
                        </div>
                      </div>
                      {canStartExam(exam) && (
                        <button
                          onClick={() => handleStartExam(exam.id)}
                          className="w-full sm:w-auto sm:ml-4 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                        >
                          <Play className="w-4 h-4" />
                          Start
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Results */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                Recent Results
              </h2>
              <button
                onClick={() => navigate("/student/results")}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View All
              </button>
            </div>

            {recentResults.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No results yet</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                {recentResults.map((result) => (
                  <div
                    key={result.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/student/result/${result.id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800">
                        {result.examTitle || "Exam"}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          result.status === "pass"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {result.status === "pass" ? "Passed" : "Failed"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {result.subject}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {result.marksObtained} / {result.totalMarks} marks
                      </span>
                      <span className="font-semibold text-blue-600">
                        {result.percentage?.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
