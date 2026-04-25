import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import { db } from "../../firebase/config";
import { useAuth } from "../../hooks/useAuth";

export default function ExamInstructions() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agree, setAgree] = useState(false);
  const [starting, setStarting] = useState(false);
  const [existingAttemptId, setExistingAttemptId] = useState(null);
  const [attemptLocked, setAttemptLocked] = useState(false);

  useEffect(() => {
    const loadExamData = async () => {
      if (!currentUser || !examId) return;

      try {
        setLoading(true);

        const examSnap = await getDoc(doc(db, "exams", examId));
        if (!examSnap.exists()) {
          toast.error("Exam not found");
          navigate("/student/exams");
          return;
        }

        const examData = { id: examSnap.id, ...examSnap.data() };

        if (!Array.isArray(examData.assignedTo) || !examData.assignedTo.includes(currentUser.uid)) {
          toast.error("This exam is not assigned to you");
          navigate("/student/exams");
          return;
        }

        const attemptsQuery = query(
          collection(db, "examAttempts"),
          where("examId", "==", examId),
          where("studentId", "==", currentUser.uid),
        );
        const attemptsSnap = await getDocs(attemptsQuery);

        const submittedOrEvaluated = attemptsSnap.docs.find((item) => {
          const status = item.data().status;
          return status === "submitted" || status === "evaluated";
        });

        if (submittedOrEvaluated) {
          setAttemptLocked(true);
        }

        const ongoingAttempt = attemptsSnap.docs.find(
          (item) => item.data().status === "ongoing",
        );

        if (ongoingAttempt) {
          setExistingAttemptId(ongoingAttempt.id);
        }

        setExam(examData);
      } catch (error) {
        console.error("Failed to load exam instructions:", error);
        toast.error("Failed to load exam");
        navigate("/student/exams");
      } finally {
        setLoading(false);
      }
    };

    loadExamData();
  }, [currentUser, examId, navigate]);

  const handleStartExam = async () => {
    if (!currentUser || !exam || !agree) {
      return;
    }

    if (attemptLocked) {
      toast.error("You have already attempted this exam. Retake is not allowed.");
      navigate("/student/exams");
      return;
    }

    try {
      setStarting(true);

      if (existingAttemptId) {
        navigate(`/student/exam/${exam.id}/take?attempt=${existingAttemptId}`);
        return;
      }

      const attemptRef = await addDoc(collection(db, "examAttempts"), {
        examId: exam.id,
        studentId: currentUser.uid,
        startTime: Timestamp.now(),
        endTime: null,
        answers: {},
        flaggedQuestions: [],
        status: "ongoing",
        autoSaveCount: 0,
        lastAutoSave: null,
        submittedAt: null,
        totalMarksObtained: null,
        percentage: null,
        createdAt: serverTimestamp(),
        security: {
          fullscreenExits: 0,
          tabSwitches: 0,
          blurEvents: 0,
          suspiciousActivity: 0,
        },
      });

      navigate(`/student/exam/${exam.id}/take?attempt=${attemptRef.id}`);
    } catch (error) {
      console.error("Failed to start exam:", error);
      const errorCode = error?.code ? ` (${error.code})` : "";
      const errorMessage = error?.message ? ` - ${error.message}` : "";
      toast.error(`Unable to start exam${errorCode}${errorMessage}`);
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!exam) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Exam Instructions</h1>
        <p className="text-gray-600 mt-2">Please review all instructions before starting.</p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Exam Title</p>
            <p className="font-semibold text-gray-800">{exam.title}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Subject</p>
            <p className="font-semibold text-gray-800">{exam.subject}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Duration</p>
            <p className="font-semibold text-gray-800">{exam.duration} minutes</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Total Marks</p>
            <p className="font-semibold text-gray-800">{exam.totalMarks}</p>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-800">Rules</h2>
          <ul className="list-disc pl-6 mt-3 text-sm text-gray-700 space-y-2">
            <li>Exam runs on a fixed timer and auto-submits when time ends.</li>
            <li>Exam starts in full screen mode and exits are tracked.</li>
            <li>Tab switching and window focus loss are tracked as violations.</li>
            <li>Answers are auto-saved every few seconds with offline backup.</li>
            <li>Multiple security violations can auto-submit your exam.</li>
          </ul>
        </div>

        <label className="mt-6 flex items-start gap-3 p-4 rounded-lg border border-gray-200">
          <input
            type="checkbox"
            className="mt-1"
            checked={agree}
            onChange={(event) => setAgree(event.target.checked)}
          />
          <span className="text-sm text-gray-700">
            I have read the instructions and agree to follow exam rules.
          </span>
        </label>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate("/student/exams")}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Back
          </button>
          <button
            type="button"
            disabled={!agree || starting || attemptLocked}
            onClick={handleStartExam}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {starting
              ? "Starting..."
              : attemptLocked
                ? "Already Attempted"
                : existingAttemptId
                  ? "Resume Exam"
                  : "Start Exam"}
          </button>
        </div>
      </div>
    </div>
  );
}
