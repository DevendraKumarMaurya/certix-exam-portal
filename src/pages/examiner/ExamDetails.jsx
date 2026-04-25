import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { Calendar, Clock, FileText, Users, ArrowLeft, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { db } from "../../firebase/config";
import { useAuth } from "../../hooks/useAuth";

export default function ExamDetails() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [exam, setExam] = useState(null);
  const [questionDetails, setQuestionDetails] = useState([]);
  const [pendingAttemptId, setPendingAttemptId] = useState("");
  const [stats, setStats] = useState({
    attempts: 0,
    submitted: 0,
    evaluated: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadExamDetails = useCallback(async () => {
    if (!currentUser || !examId) return;

    try {
      setLoading(true);

      const examDoc = await getDoc(doc(db, "exams", examId));
      if (!examDoc.exists()) {
        toast.error("Exam not found");
        navigate("/examiner/manage");
        return;
      }

      const examData = { id: examDoc.id, ...examDoc.data() };

      if (examData.createdBy !== currentUser.uid) {
        toast.error("You do not have access to this exam");
        navigate("/examiner/manage");
        return;
      }

      setExam(examData);

      const questionDocs = await Promise.all(
        (examData.questions || []).map(async (item) => {
          const questionDoc = await getDoc(doc(db, "questions", item.questionId));
          if (!questionDoc.exists()) {
            return {
              id: item.questionId,
              order: item.order,
              marks: item.marks,
              question: "Question not found",
              type: "unknown",
            };
          }

          return {
            id: questionDoc.id,
            ...questionDoc.data(),
            order: item.order,
            marks: item.marks,
          };
        }),
      );

      setQuestionDetails(
        questionDocs.sort((a, b) => (a.order || 0) - (b.order || 0)),
      );

      const attemptsSnapshot = await getDocs(
        query(collection(db, "examAttempts"), where("examId", "==", examId)),
      );

      const attempts = attemptsSnapshot.docs.map((item) => item.data());

      setStats({
        attempts: attempts.length,
        submitted: attempts.filter((item) => item.status === "submitted").length,
        evaluated: attempts.filter((item) => item.status === "evaluated").length,
      });

      const pendingAttempt = attemptsSnapshot.docs.find(
        (item) => item.data()?.status === "submitted",
      );
      setPendingAttemptId(pendingAttempt?.id || "");
    } catch (error) {
      console.error("Error loading exam details:", error);
      toast.error("Failed to load exam details");
    } finally {
      setLoading(false);
    }
  }, [currentUser, examId, navigate]);

  useEffect(() => {
    loadExamDetails();
  }, [loadExamDetails]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!exam) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => navigate("/examiner/manage")}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Manage Exams
        </button>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                {exam.title}
              </h1>
              <p className="text-gray-600 mt-2">{exam.description || "No description provided"}</p>
            </div>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
              {String(exam.status || "draft").toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <FileText className="w-4 h-4" />
                Subject
              </div>
              <p className="font-semibold text-gray-800 mt-1">{exam.subject}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Clock className="w-4 h-4" />
                Duration
              </div>
              <p className="font-semibold text-gray-800 mt-1">{exam.duration} min</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                Total Marks
              </div>
              <p className="font-semibold text-gray-800 mt-1">{exam.totalMarks || 0}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Users className="w-4 h-4" />
                Assigned Students
              </div>
              <p className="font-semibold text-gray-800 mt-1">{exam.assignedTo?.length || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-700">Questions</p>
              <p className="text-xl font-bold text-blue-900">{exam.questions?.length || 0}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-purple-700">Attempts</p>
              <p className="text-xl font-bold text-purple-900">{stats.attempts}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <p className="text-sm text-yellow-700">Pending Evaluation</p>
              <p className="text-xl font-bold text-yellow-900">{stats.submitted}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-700">Evaluated</p>
              <p className="text-xl font-bold text-green-900">{stats.evaluated}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-6">
            <button
              type="button"
              onClick={() => navigate("/examiner/manage")}
              className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() =>
                navigate(
                  pendingAttemptId
                    ? `/examiner/evaluate/${pendingAttemptId}`
                    : "/examiner/evaluate",
                )
              }
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {pendingAttemptId ? "Open Pending Evaluation" : "Open Evaluation Center"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Schedule</h2>
          <div className="flex items-center gap-2 text-gray-700">
            <Calendar className="w-4 h-4" />
            <span>
              {exam.scheduledDate?.toDate
                ? exam.scheduledDate.toDate().toLocaleString()
                : "Not scheduled"}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Questions</h2>
          {questionDetails.length > 0 ? (
            <div className="space-y-4">
              {questionDetails.map((question) => (
                <div
                  key={question.id}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        Q{question.order}. {question.question}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {String(question.type || "unknown").toUpperCase()}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {question.marks} marks
                    </span>
                  </div>

                  {question.type === "mcq" && Array.isArray(question.options) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {question.options.map((option, index) => (
                        <div
                          key={`${question.id}-${index}`}
                          className={`rounded-lg border px-3 py-2 ${
                            option.isCorrect
                              ? "border-green-200 bg-green-50 text-green-800"
                              : "border-gray-200 bg-gray-50 text-gray-700"
                          }`}
                        >
                          {option.text}
                        </div>
                      ))}
                    </div>
                  )}

                  {question.type === "numeric" && (
                    <p className="text-sm text-gray-600">
                      Correct Answer:{" "}
                      <span className="font-medium text-gray-800">
                        {question.correctAnswer}
                      </span>
                    </p>
                  )}

                  {question.type === "descriptive" && question.sampleAnswer && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                      Sample Answer: {question.sampleAnswer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No questions found for this exam.</p>
          )}
        </div>
      </div>
    </div>
  );
}
