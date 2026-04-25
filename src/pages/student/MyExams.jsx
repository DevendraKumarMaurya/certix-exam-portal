import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../hooks/useAuth";
import { Calendar, Clock, Award, Play, Eye, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";

export default function MyExams() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("upcoming");

  const fetchExams = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Fetch exams assigned to this student
      const examsRef = collection(db, "exams");
      const examsQuery = query(
        examsRef,
        where("assignedTo", "array-contains", currentUser.uid),
      );
      const examsSnapshot = await getDocs(examsQuery);

      const examsList = [];
      const now = new Date();

      for (const examDoc of examsSnapshot.docs) {
        const examData = { id: examDoc.id, ...examDoc.data() };

        // Check if student has attempted this exam
        const attemptsRef = collection(db, "examAttempts");
        const attemptQuery = query(
          attemptsRef,
          where("examId", "==", examDoc.id),
          where("studentId", "==", currentUser.uid),
        );
        const attemptSnapshot = await getDocs(attemptQuery);

        if (!attemptSnapshot.empty) {
          const attempt = attemptSnapshot.docs[0].data();
          examData.attemptStatus = attempt.status;
          examData.attemptId = attemptSnapshot.docs[0].id;
        }

        // Determine exam status
        const startTime = examData.scheduledDate?.toDate();
        const endTime = examData.endDateTime?.toDate();

        if (!startTime || !endTime) {
          examData.examStatus = "draft";
        } else if (now < startTime) {
          examData.examStatus = "upcoming";
        } else if (now >= startTime && now <= endTime) {
          examData.examStatus = "ongoing";
        } else {
          examData.examStatus = "completed";
        }

        examsList.push(examData);
      }

      // Sort by start time
      examsList.sort((a, b) => {
        const timeA = a.scheduledDate?.toDate() || new Date(0);
        const timeB = b.scheduledDate?.toDate() || new Date(0);
        return timeB - timeA;
      });

      setExams(examsList);
    } catch (error) {
      console.error("Error fetching exams:", error);
      toast.error("Failed to load exams");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const getFilteredExams = () => {
    return exams.filter((exam) => {
      if (activeTab === "upcoming") {
        return exam.examStatus === "upcoming";
      } else if (activeTab === "ongoing") {
        return exam.examStatus === "ongoing";
      } else if (activeTab === "completed") {
        return (
          exam.examStatus === "completed" ||
          exam.attemptStatus === "submitted" ||
          exam.attemptStatus === "evaluated"
        );
      }
      return false;
    });
  };

  const canStartExam = (exam) => {
    return exam.examStatus === "ongoing" && !exam.attemptId;
  };

  const canResumeExam = (exam) => {
    return exam.examStatus === "ongoing" && exam.attemptStatus === "ongoing";
  };

  const handleStartExam = (examId) => {
    navigate(`/student/exam/${examId}/instructions`);
  };

  const handleResumeExam = (examId) => {
    navigate(`/student/exam/${examId}/take`);
  };

  const handleViewResult = async (exam) => {
    try {
      const resultsRef = collection(db, "results");
      const resultQuery = query(
        resultsRef,
        where("examId", "==", exam.id),
        where("studentId", "==", currentUser.uid),
        where("isPublished", "==", true),
      );
      const resultSnapshot = await getDocs(resultQuery);

      if (!resultSnapshot.empty) {
        navigate("/student/results");
      } else {
        toast("Result not published yet");
      }
    } catch (error) {
      console.error("Error fetching result:", error);
      toast.error("Failed to load result");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const filteredExams = getFilteredExams();

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">My Exams</h1>
          <p className="text-gray-600 mt-2">View and manage your exams</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab("upcoming")}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "upcoming"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Upcoming (
                {exams.filter((e) => e.examStatus === "upcoming").length})
              </button>
              <button
                onClick={() => setActiveTab("ongoing")}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "ongoing"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Ongoing (
                {exams.filter((e) => e.examStatus === "ongoing").length})
              </button>
              <button
                onClick={() => setActiveTab("completed")}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "completed"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Completed (
                {
                  exams.filter(
                    (e) => e.examStatus === "completed" || e.attemptStatus,
                  ).length
                }
                )
              </button>
            </nav>
          </div>
        </div>

        {/* Exams Grid */}
        {filteredExams.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">No {activeTab} exams</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                onStart={handleStartExam}
                onResume={handleResumeExam}
                onViewResult={handleViewResult}
                canStart={canStartExam(exam)}
                canResume={canResumeExam(exam)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Exam Card Component
function ExamCard({
  exam,
  onStart,
  onResume,
  onViewResult,
  canStart,
  canResume,
}) {
  const getStatusBadge = () => {
    if (
      exam.attemptStatus === "submitted" ||
      exam.attemptStatus === "evaluated"
    ) {
      return (
        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
          Submitted
        </span>
      );
    } else if (exam.attemptStatus === "ongoing") {
      return (
        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
          In Progress
        </span>
      );
    } else if (exam.examStatus === "upcoming") {
      return (
        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
          Scheduled
        </span>
      );
    } else if (exam.examStatus === "ongoing") {
      return (
        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
          Live
        </span>
      );
    } else {
      return (
        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
          Ended
        </span>
      );
    }
  };

  const getActionButton = () => {
    if (canStart) {
      return (
        <button
          onClick={() => onStart(exam.id)}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
        >
          <Play className="w-4 h-4" />
          Start Exam
        </button>
      );
    } else if (canResume) {
      return (
        <button
          onClick={() => onResume(exam.id)}
          className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700"
        >
          <Play className="w-4 h-4" />
          Resume Exam
        </button>
      );
    } else if (
      exam.attemptStatus === "submitted" ||
      exam.attemptStatus === "evaluated"
    ) {
      return (
        <button
          onClick={() => onViewResult(exam)}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
        >
          <Eye className="w-4 h-4" />
          View Result
        </button>
      );
    } else if (exam.examStatus === "upcoming") {
      return (
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 bg-gray-300 text-gray-600 py-2 rounded-lg cursor-not-allowed"
        >
          <Calendar className="w-4 h-4" />
          Not Started
        </button>
      );
    } else {
      return (
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 bg-gray-300 text-gray-600 py-2 rounded-lg cursor-not-allowed"
        >
          <CheckCircle className="w-4 h-4" />
          Exam Ended
        </button>
      );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-gray-800 mb-2">
            {exam.title}
          </h3>
          <p className="text-sm text-gray-600">{exam.subject}</p>
        </div>
        {getStatusBadge()}
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>
            {exam.scheduledDate?.toDate().toLocaleDateString()} at{" "}
            {exam.scheduledDate
              ?.toDate()
              .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>{exam.duration} minutes</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Award className="w-4 h-4" />
          <span>{exam.totalMarks} marks</span>
        </div>
      </div>

      {exam.description && (
        <p className="text-sm text-gray-600 mb-6 line-clamp-2">
          {exam.description}
        </p>
      )}

      {getActionButton()}
    </div>
  );
}


