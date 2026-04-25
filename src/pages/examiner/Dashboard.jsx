import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../hooks/useAuth";
import {
  PlusCircle,
  FileText,
  ClipboardList,
  Users,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import StatCard from "../../components/ui/StatCard";
import QuickActionCard from "../../components/ui/QuickActionCard";

export default function ExaminerDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalExams: 0,
    upcomingExams: 0,
    ongoingExams: 0,
    pendingEvaluations: 0,
    totalQuestions: 0,
  });
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Fetch exams created by this examiner
      const examsRef = collection(db, "exams");
      const examsQuery = query(
        examsRef,
        where("createdBy", "==", currentUser.uid),
      );
      const examsSnapshot = await getDocs(examsQuery);

      const now = new Date();
      let upcoming = 0;
      let ongoing = 0;
      const upcomingExamsList = [];

      examsSnapshot.forEach((doc) => {
        const exam = { id: doc.id, ...doc.data() };
        const examDate = exam.scheduledDate?.toDate();

        if (exam.status === "scheduled" && examDate > now) {
          upcoming++;
          upcomingExamsList.push(exam);
        } else if (exam.status === "ongoing") {
          ongoing++;
        }
      });

      // Fetch questions created by this examiner
      const questionsRef = collection(db, "questions");
      const questionsQuery = query(
        questionsRef,
        where("createdBy", "==", currentUser.uid),
      );
      const questionsSnapshot = await getDocs(questionsQuery);

      // Fetch exam attempts for exams created by this examiner
      let pendingCount = 0;
      const submissions = [];
      const examIds = examsSnapshot.docs.map((d) => d.id);

      // If examiner has exams, fetch attempts for those exams
      if (examIds.length > 0) {
        // Firestore 'in' query supports max 10 items, so we need to batch
        const batchSize = 10;
        for (let i = 0; i < examIds.length; i += batchSize) {
          const batchIds = examIds.slice(i, i + batchSize);
          const attemptsRef = collection(db, "examAttempts");
          const attemptsQuery = query(
            attemptsRef,
            where("examId", "in", batchIds),
            where("status", "==", "submitted"),
          );
          const attemptsSnapshot = await getDocs(attemptsQuery);

          attemptsSnapshot.docs.forEach((attemptDoc) => {
            const attempt = { id: attemptDoc.id, ...attemptDoc.data() };
            pendingCount++;
            if (submissions.length < 5) {
              submissions.push(attempt);
            }
          });
        }
      }

      // Sort upcoming exams by date
      upcomingExamsList.sort(
        (a, b) => a.scheduledDate?.toDate() - b.scheduledDate?.toDate(),
      );

      setStats({
        totalExams: examsSnapshot.size,
        upcomingExams: upcoming,
        ongoingExams: ongoing,
        pendingEvaluations: pendingCount,
        totalQuestions: questionsSnapshot.size,
      });

      setUpcomingExams(upcomingExamsList.slice(0, 5));
      setRecentSubmissions(submissions);
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
            Examiner Dashboard
          </h1>
          <p className="text-gray-600 mt-1 sm:mt-2">
            Manage your exams and evaluate student submissions
          </p>
        </div>
        {/* Stats Grid */}
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-5 sm:gap-6 sm:overflow-visible sm:pb-0">
          <div className="min-w-55 snap-start sm:min-w-0">
            <StatCard
              icon={FileText}
              label="Total Exams"
              value={stats.totalExams}
              color="bg-blue-500"
              onClick={() => navigate("/examiner/manage")}
            />
          </div>
          <div className="min-w-55 snap-start sm:min-w-0">
            <StatCard
              icon={Calendar}
              label="Upcoming Exams"
              value={stats.upcomingExams}
              color="bg-green-500"
            />
          </div>
          <div className="min-w-55 snap-start sm:min-w-0">
            <StatCard
              icon={Clock}
              label="Ongoing Exams"
              value={stats.ongoingExams}
              color="bg-yellow-500"
            />
          </div>
          <div className="min-w-55 snap-start sm:min-w-0">
            <StatCard
              icon={AlertCircle}
              label="Pending Evaluations"
              value={stats.pendingEvaluations}
              color="bg-red-500"
              onClick={() => navigate("/examiner/evaluate")}
            />
          </div>
          <div className="min-w-55 snap-start sm:min-w-0">
            <StatCard
              icon={ClipboardList}
              label="Total Questions"
              value={stats.totalQuestions}
              color="bg-purple-500"
              onClick={() => navigate("/examiner/questions")}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-2 md:gap-4 mdxl:overflow-visible md:pb-0">
            <div className="min-w-65 snap-start md:min-w-0">
              <QuickActionCard
                icon={PlusCircle}
                title="Create New Exam"
                description="Set up a new examination for students"
                onClick={() => navigate("/examiner/create")}
                color="bg-blue-500"
              />
            </div>
            <div className="min-w-65 snap-start md:min-w-0">
              <QuickActionCard
                icon={FileText}
                title="Add Question"
                description="Add questions to your question bank"
                onClick={() => navigate("/examiner/questions")}
                color="bg-green-500"
              />
            </div>
            <div className="min-w-65 snap-start md:min-w-0">
              <QuickActionCard
                icon={CheckCircle}
                title="Evaluate Submissions"
                description="Review and grade student answers"
                onClick={() => navigate("/examiner/evaluate")}
                color="bg-purple-500"
              />
            </div>
            <div className="min-w-65 snap-start md:min-w-0">
              <QuickActionCard
                icon={Users}
                title="Student Performance"
                description="View analytics and student reports"
                onClick={() => navigate("/examiner/performance")}
                color="bg-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Upcoming Exams */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-blue-600" />
              Upcoming Exams
            </h2>
            {upcomingExams.length > 0 ? (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {upcomingExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="border-l-4 border-blue-500 pl-4 py-2 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/examiner/exam/${exam.id}`)}
                  >
                    <h3 className="font-semibold">{exam.title}</h3>
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <Calendar className="w-4 h-4 mr-1" />
                      {exam.scheduledDate?.toDate().toLocaleDateString()}
                      <span className="mx-2">•</span>
                      <Clock className="w-4 h-4 mr-1" />
                      {exam.duration} min
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {exam.assignedTo?.length || 0} students assigned
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No upcoming exams scheduled
              </p>
            )}
          </div>

          {/* Recent Submissions */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
              Recent Submissions
            </h2>
            {recentSubmissions.length > 0 ? (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {recentSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="border-l-4 border-red-500 pl-4 py-2 hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      navigate(`/examiner/evaluate/${submission.id}`)
                    }
                  >
                    <h3 className="font-semibold">Exam Attempt</h3>
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <Users className="w-4 h-4 mr-1" />
                      Student ID: {submission.studentId.slice(0, 8)}...
                      <span className="mx-2">•</span>
                      <Clock className="w-4 h-4 mr-1" />
                      {submission.submittedAt?.toDate().toLocaleString()}
                    </div>
                    <p className="text-sm text-red-600 mt-1 font-medium">
                      Pending Evaluation
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No pending evaluations
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
