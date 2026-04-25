import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../hooks/useAuth";
import { CheckCircle, Edit3 } from "lucide-react";
import toast from "react-hot-toast";
import { evaluateExam } from "../../utils/evaluateExam";

export default function EvaluationCenter() {
  const { currentUser } = useAuth();
  const { attemptId } = useParams();
  const [pendingAttempts, setPendingAttempts] = useState([]);
  const [publishQueue, setPublishQueue] = useState([]);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [examData, setExamData] = useState(null);
  const [questionsData, setQuestionsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const loadExamWithQuestions = useCallback(async (examId) => {
    const examDoc = await getDoc(doc(db, "exams", examId));
    if (!examDoc.exists()) {
      throw new Error("Exam not found");
    }

    const exam = { id: examDoc.id, ...examDoc.data() };
    const questionMap = {};

    for (const examQuestion of exam.questions || []) {
      const questionDoc = await getDoc(doc(db, "questions", examQuestion.questionId));
      if (!questionDoc.exists()) continue;

      questionMap[examQuestion.questionId] = {
        id: questionDoc.id,
        ...questionDoc.data(),
        marks: examQuestion.marks,
        order: examQuestion.order,
      };
    }

    return { exam, questionMap };
  }, []);

  const buildNormalizedAnswers = useCallback((exam, questionMap, attemptAnswers = {}) => {
    const normalized = {};

    for (const examQuestion of exam?.questions || []) {
      const existingAnswer = attemptAnswers?.[examQuestion.questionId];
      const question = questionMap?.[examQuestion.questionId];
      const isManualQuestion = question?.type === "descriptive";

      normalized[examQuestion.questionId] = existingAnswer
        ? {
            ...existingAnswer,
            isEvaluated:
              typeof existingAnswer.isEvaluated === "boolean"
                ? existingAnswer.isEvaluated
                : !isManualQuestion,
            marksObtained: Number(existingAnswer.marksObtained || 0),
          }
        : {
        answer: "",
        isEvaluated: !isManualQuestion,
        marksObtained: 0,
      };
    }

    return normalized;
  }, []);

  const fetchPendingEvaluations = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Get exams created by this examiner
      const examsRef = collection(db, "exams");
      const examsQuery = query(
        examsRef,
        where("createdBy", "==", currentUser.uid),
      );
      const examsSnapshot = await getDocs(examsQuery);
      const examinerExamIds = examsSnapshot.docs.map((d) => d.id);

      // Get submitted/evaluated attempts for these exams using 'in' query (batched)
      const pending = [];
      const readyToPublish = [];
      const examTitleById = {};

      examsSnapshot.docs.forEach((examDoc) => {
        examTitleById[examDoc.id] = examDoc.data()?.title || "Untitled Exam";
      });

      if (examinerExamIds.length > 0) {
        const batchSize = 10;
        for (let i = 0; i < examinerExamIds.length; i += batchSize) {
          const batchIds = examinerExamIds.slice(i, i + batchSize);
          const attemptsRef = collection(db, "examAttempts");
          const attemptsQuery = query(
            attemptsRef,
            where("examId", "in", batchIds),
            where("status", "in", ["submitted", "evaluated"]),
          );
          const attemptsSnapshot = await getDocs(attemptsQuery);

          for (const attemptDoc of attemptsSnapshot.docs) {
            let attempt = { id: attemptDoc.id, ...attemptDoc.data() };

            // Run auto-evaluation from examiner side when attempt answers are not evaluated yet.
            const answerValues = Object.values(attempt.answers || {});
            const requiresAutoEvaluation =
              attempt.status === "submitted" &&
              (answerValues.length === 0 ||
                answerValues.some(
                  (answer) => typeof answer?.isEvaluated !== "boolean",
                ));

            if (requiresAutoEvaluation) {
              try {
                await evaluateExam(attempt.id, attempt.examId, attempt.studentId);
                const refreshedAttemptDoc = await getDoc(
                  doc(db, "examAttempts", attempt.id),
                );
                if (refreshedAttemptDoc.exists()) {
                  attempt = {
                    id: refreshedAttemptDoc.id,
                    ...refreshedAttemptDoc.data(),
                  };
                }
              } catch (evaluationError) {
                console.error("Auto-evaluation from examiner failed:", evaluationError);
              }
            }

            // Check if has unevaluated questions
            const { exam, questionMap } = await loadExamWithQuestions(attempt.examId);
            const normalizedAnswers = buildNormalizedAnswers(
              exam,
              questionMap,
              attempt.answers,
            );

            const hasUnevaluated = Object.values(normalizedAnswers || {}).some(
              (ans) => !ans.isEvaluated,
            );

            if (hasUnevaluated) {
              // Fetch student details
              const studentDoc = await getDoc(
                doc(db, "users", attempt.studentId),
              );
              const studentData = studentDoc.data();

              pending.push({
                ...attempt,
                answers: normalizedAnswers,
                examTitle: exam?.title,
                studentName: studentData?.name,
                studentEmail: studentData?.email,
              });
            }
          }

          // Fetch evaluated but unpublished results for this examiner's exams
          const resultsRef = collection(db, "results");
          const unpublishedQuery = query(
            resultsRef,
            where("examId", "in", batchIds),
            where("isPublished", "==", false),
          );
          const unpublishedSnapshot = await getDocs(unpublishedQuery);

          for (const resultDoc of unpublishedSnapshot.docs) {
            const result = { id: resultDoc.id, ...resultDoc.data() };

            const studentDoc = await getDoc(doc(db, "users", result.studentId));
            const studentData = studentDoc.exists() ? studentDoc.data() : {};

            readyToPublish.push({
              ...result,
              examTitle: examTitleById[result.examId] || "Untitled Exam",
              studentName: studentData?.name || "Unknown Student",
              studentEmail: studentData?.email || "-",
            });
          }
        }
      }

      // Sort by submission time (oldest first)
      pending.sort((a, b) => a.submittedAt?.seconds - b.submittedAt?.seconds);
      readyToPublish.sort((a, b) => {
        const dateA = a.evaluatedAt?.seconds || 0;
        const dateB = b.evaluatedAt?.seconds || 0;
        return dateB - dateA;
      });

      setPendingAttempts(pending);
      setPublishQueue(readyToPublish);
    } catch (error) {
      console.error("Error fetching pending evaluations:", error);
      toast.error("Failed to load pending evaluations");
    } finally {
      setLoading(false);
    }
  }, [buildNormalizedAnswers, currentUser, loadExamWithQuestions]);

  useEffect(() => {
    fetchPendingEvaluations();
  }, [fetchPendingEvaluations]);

  const loadAttemptForEvaluation = useCallback(async (attempt) => {
    try {
      setLoading(true);

      const { exam, questionMap } = await loadExamWithQuestions(attempt.examId);
      setExamData(exam);
      setQuestionsData(questionMap);

      const normalizedAnswers = buildNormalizedAnswers(
        exam,
        questionMap,
        attempt.answers,
      );

      const manualQuestionIds = (exam.questions || [])
        .map((question) => question.questionId)
        .filter((questionId) => !normalizedAnswers[questionId]?.isEvaluated);

      setSelectedAttempt({
        ...attempt,
        answers: normalizedAnswers,
      });
      setCurrentQuestionIndex(0);

      if (manualQuestionIds.length === 0) {
        setSelectedResult(
          buildResultSummary(
            {
              ...attempt,
              resultId: `${attempt.examId}_${attempt.studentId}`,
            },
            exam,
            normalizedAnswers,
            questionMap,
          ),
        );
        setSelectedAttempt(null);
        toast("No manual questions left. Review the summary and publish the result.");
      }
    } catch (error) {
      console.error("Error loading attempt:", error);
      toast.error("Failed to load attempt details");
    } finally {
      setLoading(false);
    }
  }, [buildNormalizedAnswers, loadExamWithQuestions]);

  useEffect(() => {
    const openAttemptFromRoute = async () => {
      if (!attemptId || !currentUser || loading) return;
      if (selectedAttempt || selectedResult) return;

      try {
        const attemptDoc = await getDoc(doc(db, "examAttempts", attemptId));
        if (!attemptDoc.exists()) {
          toast.error("Attempt not found");
          return;
        }

        const attemptData = { id: attemptDoc.id, ...attemptDoc.data() };
        const studentDoc = await getDoc(doc(db, "users", attemptData.studentId));
        const studentData = studentDoc.exists() ? studentDoc.data() : {};

        await loadAttemptForEvaluation({
          ...attemptData,
          studentName: studentData?.name || "Unknown Student",
          studentEmail: studentData?.email || "-",
        });
      } catch (error) {
        console.error("Error opening attempt from route:", error);
        toast.error("Failed to open this submission");
      }
    };

    openAttemptFromRoute();
  }, [
    attemptId,
    currentUser,
    loadAttemptForEvaluation,
    loading,
    selectedAttempt,
    selectedResult,
  ]);

  const handleEvaluation = async (questionId, marksAwarded, feedback = "") => {
    if (!selectedAttempt) return;

    try {
      const awardedMarks = Number(marksAwarded);
      const maxMarks = Number(questionsData[questionId]?.marks || 0);

      if (!Number.isFinite(awardedMarks) || awardedMarks < 0 || awardedMarks > maxMarks) {
        toast.error(`Enter marks between 0 and ${maxMarks}`);
        return;
      }

      const attemptRef = doc(db, "examAttempts", selectedAttempt.id);

      const updatedAnswers = { ...selectedAttempt.answers };
      updatedAnswers[questionId] = {
        ...updatedAnswers[questionId],
        marksObtained: awardedMarks,
        isEvaluated: true,
        feedback,
        evaluatedBy: currentUser.uid,
        evaluatedAt: new Date(),
      };

      await updateDoc(attemptRef, {
        answers: updatedAnswers,
      });

      toast.success("Answer evaluated");

      // Update local state
      setSelectedAttempt({
        ...selectedAttempt,
        answers: updatedAnswers,
      });

      const orderedQuestionIds = (examData?.questions || []).map(
        (examQuestion) => examQuestion.questionId,
      );
      const remainingManualQuestions = (examData?.questions || []).filter(
        (examQuestion) =>
          questionsData[examQuestion.questionId]?.type === "descriptive" &&
          !updatedAnswers[examQuestion.questionId]?.isEvaluated,
      );

      const isLastQuestion = currentQuestionIndex >= orderedQuestionIds.length - 1;

      if (remainingManualQuestions.length === 0 && isLastQuestion) {
        await finalizeEvaluation(updatedAnswers);
      } else {
        setCurrentQuestionIndex((previous) =>
          Math.min(previous + 1, Math.max(orderedQuestionIds.length - 1, 0)),
        );
      }
    } catch (error) {
      console.error("Error saving evaluation:", error);
      toast.error("Failed to save evaluation");
    }
  };

  const handleCompleteReview = async () => {
    if (!selectedAttempt) return;

    const normalizedAnswers = buildNormalizedAnswers(
      examData,
      questionsData,
      selectedAttempt.answers,
    );

    const remainingManualQuestions = (examData?.questions || []).filter(
      (examQuestion) =>
        questionsData[examQuestion.questionId]?.type === "descriptive" &&
        !normalizedAnswers?.[examQuestion.questionId]?.isEvaluated,
    );

    if (remainingManualQuestions.length > 0) {
      toast.error("Please complete manual evaluation for all descriptive questions first");
      return;
    }

    await finalizeEvaluation(normalizedAnswers);
  };

  const finalizeEvaluation = async (answers) => {
    try {
      // Calculate total marks
      let totalMarksObtained = 0;
      Object.values(answers).forEach((answer) => {
        if (answer.isEvaluated) {
          totalMarksObtained += answer.marksObtained || 0;
        }
      });

      const percentage = (totalMarksObtained / examData.totalMarks) * 100;
      const status = percentage >= examData.passingMarks ? "pass" : "fail";

      // Update attempt
      await updateDoc(doc(db, "examAttempts", selectedAttempt.id), {
        totalMarksObtained,
        percentage,
        status: "evaluated",
        evaluatedBy: currentUser.uid,
        evaluatedAt: serverTimestamp(),
      });

      // Create result draft; publish happens explicitly from publish queue
      const questionWiseMarks = Object.entries(answers).map(
        ([questionId, answer]) => ({
          questionId,
          marksAwarded: answer.marksObtained || 0,
          totalMarks: questionsData[questionId]?.marks || 0,
        }),
      );

      const resultId = `${selectedAttempt.examId}_${selectedAttempt.studentId}`;
      await setDoc(doc(db, "results", resultId), {
        examId: selectedAttempt.examId,
        studentId: selectedAttempt.studentId,
        attemptId: selectedAttempt.id,
        submittedAt: selectedAttempt.submittedAt || null,
        totalMarks: examData.totalMarks,
        marksObtained: totalMarksObtained,
        percentage,
        status,
        questionWiseMarks,
        evaluatedAt: serverTimestamp(),
        evaluatedBy: currentUser.uid,
        isPublished: false,
        publishedAt: null,
        publishedBy: null,
      }, { merge: true });

      toast.success("Evaluation completed. Result moved to publish queue.");

      setSelectedResult(
        buildResultSummary(
          {
            ...selectedAttempt,
            resultId,
            evaluatedBy: currentUser.uid,
            isPublished: false,
          },
          examData,
          answers,
          questionsData,
        ),
      );

      // Refresh pending list
      setSelectedAttempt(null);
      fetchPendingEvaluations();
    } catch (error) {
      console.error("Error finalizing evaluation:", error);
      toast.error("Failed to finalize evaluation");
    }
  };

  const publishResult = async (result) => {
    try {
      const resultId = typeof result === "string" ? result : result?.id;
      const resultRef = doc(db, "results", resultId);
      const resultSnap = await getDoc(resultRef);
      const existingResult = resultSnap.exists() ? resultSnap.data() : {};

      const resolvedExamId =
        existingResult.examId || result?.examId || selectedResult?.examId;
      const resolvedStudentId =
        existingResult.studentId || result?.studentId || selectedResult?.studentId;
      const resolvedAttemptId =
        existingResult.attemptId || result?.attemptId || selectedResult?.attemptId;

      if (!resolvedExamId) {
        toast.error("Missing exam reference for this result");
        return;
      }

      await setDoc(resultRef, {
        examId: resolvedExamId,
        studentId: resolvedStudentId || null,
        attemptId: resolvedAttemptId || null,
        isPublished: true,
        publishedAt: serverTimestamp(),
        publishedBy: currentUser.uid,
      }, { merge: true });

      toast.success("Result published. Student can now view it.");
      fetchPendingEvaluations();
    } catch (error) {
      console.error("Error publishing result:", error);
      toast.error("Failed to publish result");
    }
  };

  const openResultDetails = async (result) => {
    try {
      setLoading(true);

      const { exam, questionMap } = await loadExamWithQuestions(result.examId);
      setExamData(exam);
      setQuestionsData(questionMap);

      const attemptDoc = await getDoc(doc(db, "examAttempts", result.attemptId));
      const attemptData = attemptDoc.exists() ? attemptDoc.data() : {};

      setSelectedResult(
        buildResultSummary(
          {
            ...result,
            id: result.attemptId,
            studentName: result.studentName,
            studentEmail: result.studentEmail,
            evaluatedBy: result.evaluatedBy,
            isPublished: result.isPublished,
            resultId: result.id,
          },
          exam,
          buildNormalizedAnswers(exam, questionMap, attemptData.answers || {}),
          questionMap,
        ),
      );
    } catch (error) {
      console.error("Error opening result details:", error);
      toast.error("Failed to load result details");
    } finally {
      setLoading(false);
    }
  };

  const buildResultSummary = (attempt, exam, answers, questionMap) => {
    const questionRows = (exam?.questions || []).map((examQuestion) => {
      const questionId = examQuestion.questionId;
      const question = questionMap[questionId] || {};
      const answer = answers?.[questionId] || {};
      const isManual = question.type === "descriptive";

      return {
        questionId,
        question,
        answer,
        questionMark: examQuestion.marks,
        evaluatedBy: answer.evaluatedBy || attempt?.evaluatedBy || "auto-evaluation",
        isManual,
      };
    });

    const totalMarksObtained = questionRows.reduce(
      (sum, row) => sum + (row.answer.marksObtained || 0),
      0,
    );
    const percentage = exam?.totalMarks
      ? (totalMarksObtained / exam.totalMarks) * 100
      : 0;

    return {
      id: attempt?.resultId || `${attempt?.examId}_${attempt?.studentId}`,
      examId: attempt?.examId,
      studentId: attempt?.studentId,
      attemptId: attempt?.id,
      examTitle: exam?.title || "Untitled Exam",
      studentName: attempt?.studentName || "Unknown Student",
      studentEmail: attempt?.studentEmail || "-",
      totalMarks: exam?.totalMarks || 0,
      marksObtained: totalMarksObtained,
      percentage,
      status: percentage >= (exam?.passingMarks || 0) ? "pass" : "fail",
      isPublished: Boolean(attempt?.isPublished),
      evaluatedBy: attempt?.evaluatedBy || "auto-evaluation",
      questionRows,
      attemptAnswers: answers || {},
    };
  };

  const EvaluationForm = ({ questionId, question, studentAnswer }) => {
    const [marks, setMarks] = useState(studentAnswer.marksObtained || 0);
    const [feedback, setFeedback] = useState(studentAnswer.feedback || "");

    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Question {question.order}</h3>
            <span className="text-sm text-gray-600">
              Max Marks: {question.marks}
            </span>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <p className="font-medium text-gray-800">{question.question}</p>
          </div>

          {question.sampleAnswer && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                Sample Answer:
              </p>
              <p className="text-sm text-blue-800">{question.sampleAnswer}</p>
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
            <p className="text-sm font-semibold text-yellow-900 mb-2">
              Student's Answer:
            </p>
            <p className="text-sm text-yellow-800 whitespace-pre-wrap">
              {studentAnswer.answer || "No answer provided"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Marks Awarded *
              </label>
              <input
                type="number"
                min="0"
                max={question.marks}
                step="0.5"
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Feedback (optional)
              </label>
              <input
                type="text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g., Good explanation"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => handleEvaluation(questionId, marks, feedback)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Save & Next
            </button>
            <button
              onClick={() => {
                setSelectedAttempt(null);
                setExamData(null);
              }}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ReviewCard = ({ question, studentAnswer, isLastQuestion, onNext, onFinish }) => (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Question {question.order}</h3>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              question.type === "descriptive"
                ? "bg-purple-100 text-purple-700"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {question.type === "descriptive" ? "Manual Review" : "Auto-Evaluated"}
          </span>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <p className="font-medium text-gray-800">{question.question}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="font-semibold text-yellow-900 mb-1">Student Answer</p>
            <p className="text-yellow-800 whitespace-pre-wrap">
              {studentAnswer?.answer || "No answer provided"}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-900 mb-1">Evaluation</p>
            <p className="text-blue-800">
              {question.type === "descriptive" ? "Manually evaluated" : "Auto-evaluated"}
            </p>
            <p className="text-blue-800 mt-1">
              By: {studentAnswer?.evaluatedBy || "auto-evaluation"}
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="font-semibold text-green-900 mb-1">Marks</p>
            <p className="text-green-800">Awarded: {studentAnswer?.marksObtained || 0}</p>
            <p className="text-green-800 mt-1">Max: {question.marks}</p>
            {studentAnswer?.feedback && (
              <p className="text-green-800 mt-2">Feedback: {studentAnswer.feedback}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          {isLastQuestion ? (
            <button
              type="button"
              onClick={onFinish}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Finish Review
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Next Question
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSelectedAttempt(null);
              setExamData(null);
            }}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  if (loading && !selectedAttempt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (selectedResult) {
    const questionRows = selectedResult.questionRows || [];

    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <button
            type="button"
            onClick={() => {
              setSelectedResult(null);
              setExamData(null);
              setQuestionsData({});
            }}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Evaluation Center
          </button>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Evaluation Summary
                </h1>
                <p className="text-gray-600 mt-1">{selectedResult.examTitle}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Student: {selectedResult.studentName} | {selectedResult.studentEmail}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedResult.isPublished ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {selectedResult.isPublished ? "Published" : "Draft"}
                </span>
                {!selectedResult.isPublished && (
                  <button
                    type="button"
                    onClick={async () => {
                      await publishResult(selectedResult);
                      setSelectedResult((previous) => previous ? { ...previous, isPublished: true } : previous);
                    }}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                  >
                    Publish Result
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-700">Score</p>
                <p className="text-xl font-bold text-blue-900">
                  {selectedResult.marksObtained} / {selectedResult.totalMarks}
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-purple-700">Percentage</p>
                <p className="text-xl font-bold text-purple-900">
                  {Number(selectedResult.percentage || 0).toFixed(2)}%
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-700">Status</p>
                <p className="text-xl font-bold text-green-900">
                  {selectedResult.status}
                </p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-sm text-orange-700">Evaluation Type</p>
                <p className="text-xl font-bold text-orange-900">
                  {String(selectedResult.evaluatedBy || "auto-evaluation").includes("auto")
                    ? "Auto"
                    : "Manual"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {questionRows.map((row) => (
              <div key={row.questionId} className="bg-white rounded-lg shadow p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      Question {row.question.order}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {row.question.type?.toUpperCase()} | {row.questionMark} marks
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${row.answer.isEvaluated ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {row.answer.isEvaluated ? "Evaluated" : "Pending"}
                  </span>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="font-medium text-gray-800">{row.question.question}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="font-semibold text-yellow-900 mb-1">Student Answer</p>
                    <p className="text-yellow-800 whitespace-pre-wrap">{row.answer.answer || "No answer provided"}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="font-semibold text-blue-900 mb-1">Evaluation Method</p>
                    <p className="text-blue-800">{row.isManual ? "Manual by examiner" : "Auto-evaluated"}</p>
                    <p className="text-blue-800 mt-1">By: {row.answer.evaluatedBy || selectedResult.evaluatedBy || "auto-evaluation"}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="font-semibold text-green-900 mb-1">Marks</p>
                    <p className="text-green-800">Awarded: {row.answer.marksObtained || 0}</p>
                    <p className="text-green-800 mt-1">Max: {row.questionMark}</p>
                    {row.answer.feedback && (
                      <p className="text-green-800 mt-2">Feedback: {row.answer.feedback}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Evaluation Mode
  if (selectedAttempt && examData) {
    const orderedQuestionIds = (examData.questions || []).map(
      (examQuestion) => examQuestion.questionId,
    );
    const currentQuestionId = orderedQuestionIds[currentQuestionIndex];
    const currentQuestion = questionsData[currentQuestionId];
    const currentAnswer = selectedAttempt.answers[currentQuestionId];
    const pendingManualCount = orderedQuestionIds.filter(
      (questionId) =>
        questionsData[questionId]?.type === "descriptive" &&
        !selectedAttempt.answers?.[questionId]?.isEvaluated,
    ).length;
    const isLastQuestion = currentQuestionIndex >= orderedQuestionIds.length - 1;

    if (!currentQuestion) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="bg-white rounded-lg shadow p-6 text-center max-w-md">
            <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
            <p className="text-gray-700 font-medium">No manual evaluation pending</p>
            <p className="text-sm text-gray-500 mt-1">
              Review the summary panel to publish the result.
            </p>
            <button
              type="button"
              onClick={() => setSelectedAttempt(null)}
              className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Back to Summary
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Evaluate Submission
            </h1>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Exam:</span>
                <span className="ml-2 font-medium">{examData.title}</span>
              </div>
              <div>
                <span className="text-gray-600">Student:</span>
                <span className="ml-2 font-medium">
                  {selectedAttempt.studentName}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Progress:</span>
                <span className="ml-2 font-medium">
                  {Math.min(currentQuestionIndex + 1, orderedQuestionIds.length)} / {orderedQuestionIds.length}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Pending manual checks: {pendingManualCount}
            </p>
          </div>

          {/* Evaluation Form */}
          {currentAnswer &&
          !currentAnswer.isEvaluated &&
          currentQuestion.type === "descriptive" ? (
            <EvaluationForm
              questionId={currentQuestionId}
              question={currentQuestion}
              studentAnswer={currentAnswer}
            />
          ) : (
            <ReviewCard
              question={currentQuestion}
              studentAnswer={currentAnswer}
              isLastQuestion={isLastQuestion}
              onNext={() =>
                setCurrentQuestionIndex((previous) =>
                  Math.min(previous + 1, Math.max(orderedQuestionIds.length - 1, 0)),
                )
              }
              onFinish={handleCompleteReview}
            />
          )}
        </div>
      </div>
    );
  }

  // List Mode
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Evaluation Center
          </h1>
          <p className="text-gray-600 mt-2">
            {pendingAttempts.length} manual submission
            {pendingAttempts.length !== 1 ? "s" : ""} pending evaluation
          </p>
          <p className="text-gray-500 text-sm mt-1">
            MCQ and numeric attempts are auto-evaluated and appear below in the publish queue.
          </p>
        </div>

        {/* Pending Submissions */}
        {pendingAttempts.length > 0 ? (
          <div className="space-y-4">
            {pendingAttempts.map((attempt) => {
              const unevaluatedCount = Object.values(
                attempt.answers || {},
              ).filter((a) => !a.isEvaluated).length;

              return (
                <div
                  key={attempt.id}
                  className="bg-white rounded-lg shadow p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        {attempt.examTitle}
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                        <div>
                          <span>Student:</span>
                          <span className="ml-2 font-medium">
                            {attempt.studentName}
                          </span>
                        </div>
                        <div>
                          <span>Email:</span>
                          <span className="ml-2 font-medium">
                            {attempt.studentEmail}
                          </span>
                        </div>
                        <div>
                          <span>Submitted:</span>
                          <span className="ml-2 font-medium">
                            {attempt.submittedAt?.toDate().toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span>Pending:</span>
                          <span className="ml-2 font-medium text-orange-600">
                            {unevaluatedCount} question
                            {unevaluatedCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => loadAttemptForEvaluation(attempt)}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Edit3 className="w-4 h-4" />
                      Start Evaluation
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <p className="text-gray-500 text-lg mb-2">All caught up!</p>
            <p className="text-gray-400 text-sm">
              No pending evaluations at the moment
            </p>
          </div>
        )}

        <div className="mt-10 mb-4">
          <h2 className="text-xl font-bold text-gray-800">Ready To Publish</h2>
          <p className="text-gray-600 text-sm mt-1">
            {publishQueue.length} evaluated result{publishQueue.length !== 1 ? "s" : ""} waiting for publish
          </p>
        </div>

        {publishQueue.length > 0 ? (
          <div className="space-y-4">
            {publishQueue.map((result) => (
              <div key={result.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-800">
                        {result.examTitle}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          String(result.evaluatedBy || "").includes("auto")
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {String(result.evaluatedBy || "").includes("auto")
                          ? "Auto-Evaluated"
                          : "Manually Evaluated"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                      <div>
                        <span>Student:</span>
                        <span className="ml-2 font-medium">{result.studentName}</span>
                      </div>
                      <div>
                        <span>Email:</span>
                        <span className="ml-2 font-medium">{result.studentEmail}</span>
                      </div>
                      <div>
                        <span>Score:</span>
                        <span className="ml-2 font-medium">{result.marksObtained} / {result.totalMarks}</span>
                      </div>
                      <div>
                        <span>Percentage:</span>
                        <span className="ml-2 font-medium">{Number(result.percentage || 0).toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => openResultDetails(result)}
                    className="flex items-center gap-2 px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    <Edit3 className="w-4 h-4" />
                    View Evaluation
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No evaluated results waiting for publish
          </div>
        )}
      </div>
    </div>
  );
}


