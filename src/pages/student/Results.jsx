import { createElement, useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../hooks/useAuth";
import {
  Award,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";

export default function Results() {
  const { currentUser } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState(null);

  const fetchResults = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      const resultsRef = collection(db, "results");
      const resultsQuery = query(
        resultsRef,
        where("studentId", "==", currentUser.uid),
        where("isPublished", "==", true),
      );
      const resultsSnapshot = await getDocs(resultsQuery);

      const resultsList = [];

      for (const resultDoc of resultsSnapshot.docs) {
        const resultData = { id: resultDoc.id, ...resultDoc.data() };
        const examDoc = await getDoc(doc(db, "exams", resultData.examId));

        if (examDoc.exists()) {
          const examData = examDoc.data();
          resultData.examTitle = examData.title;
          resultData.examSubject = examData.subject;

          const totalMarks = Number(resultData.totalMarks ?? examData.totalMarks ?? 0);
          const marksObtained = Number(resultData.marksObtained ?? 0);
          const derivedPercentage = Number.isFinite(Number(resultData.percentage))
            ? Number(resultData.percentage)
            : totalMarks > 0
              ? (marksObtained / totalMarks) * 100
              : 0;
          const passingPercentage = Number(examData.passingMarks || 0);

          resultData.totalMarks = totalMarks;
          resultData.marksObtained = marksObtained;
          resultData.percentage = derivedPercentage;
          resultData.status =
            derivedPercentage >= passingPercentage ? "pass" : "fail";
        }

        resultsList.push(resultData);
      }

      resultsList.sort((a, b) => {
        const dateA = a.submittedAt?.toDate?.() || a.evaluatedAt?.toDate?.() || new Date(0);
        const dateB = b.submittedAt?.toDate?.() || b.evaluatedAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });

      setResults(resultsList);
    } catch (error) {
      console.error("Error fetching results:", error);
      toast.error("Failed to load results");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleViewDetails = async (result) => {
    try {
      const examDoc = await getDoc(doc(db, "exams", result.examId));
      const attemptDoc = await getDoc(doc(db, "examAttempts", result.attemptId));

      if (!examDoc.exists() || !attemptDoc.exists()) {
        toast.error("Result details not found");
        return;
      }

      const examData = examDoc.data();
      const attemptData = attemptDoc.data();

      const questionRows = await Promise.all(
        (examData.questions || []).map(async (examQuestion) => {
          const questionDoc = await getDoc(doc(db, "questions", examQuestion.questionId));
          const questionData = questionDoc.exists() ? questionDoc.data() : {};
          const answer = attemptData.answers?.[examQuestion.questionId] || {};
          const markRow = (result.questionWiseMarks || []).find(
            (item) => item.questionId === examQuestion.questionId,
          );

          return {
            questionId: examQuestion.questionId,
            order: examQuestion.order,
            question: questionData.question || "Question not found",
            type: questionData.type || "unknown",
            options: questionData.options || [],
            sampleAnswer: questionData.sampleAnswer || "",
            studentAnswer: answer.answer || "",
            feedback: answer.feedback || "",
            marksAwarded: markRow?.marksAwarded ?? answer.marksObtained ?? 0,
            totalMarks: markRow?.totalMarks ?? examQuestion.marks ?? 0,
            isEvaluated:
              typeof answer.isEvaluated === "boolean"
                ? answer.isEvaluated
                : typeof markRow?.marksAwarded === "number",
          };
        }),
      );

      setSelectedResult({
        ...result,
        questionRows: questionRows.sort((a, b) => (a.order || 0) - (b.order || 0)),
      });
    } catch (error) {
      console.error("Error fetching result details:", error);
      toast.error("Failed to load result details");
    }
  };

  const calculateStats = () => {
    if (results.length === 0) {
      return { avgScore: 0, totalExams: 0, passed: 0, failed: 0 };
    }

    const totalExams = results.length;
    const totalScore = results.reduce((sum, result) => sum + (result.percentage || 0), 0);
    const avgScore = (totalScore / totalExams).toFixed(2);
    const passed = results.filter((result) => result.status === "pass").length;
    const failed = results.filter((result) => result.status === "fail").length;

    return { avgScore, totalExams, passed, failed };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (selectedResult) {
    return (
      <ResultDetails
        result={selectedResult}
        onBack={() => setSelectedResult(null)}
      />
    );
  }

  const stats = calculateStats();

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">My Results</h1>
          <p className="text-gray-600 mt-2">
            View your exam performance and detailed results
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Exams" value={stats.totalExams} icon={FileText} color="blue" />
          <StatCard title="Average Score" value={`${stats.avgScore}%`} icon={TrendingUp} color="purple" />
          <StatCard title="Passed" value={stats.passed} icon={CheckCircle} color="green" />
          <StatCard title="Failed" value={stats.failed} icon={XCircle} color="red" />
        </div>

        {results.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">No results available yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Exam
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Percentage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.map((result) => (
                    <tr key={result.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{result.examTitle}</div>
                          <div className="text-sm text-gray-500">{result.examSubject}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {(result.submittedAt?.toDate?.() || result.evaluatedAt?.toDate?.())?.toLocaleDateString?.() || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {result.marksObtained} / {result.totalMarks}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {Number(result.percentage || 0).toFixed(2)}%
                      </td>
                      <td className="px-6 py-4">
                        {result.status === "pass" ? (
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Pass
                          </span>
                        ) : (
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                            Fail
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => handleViewDetails(result)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  const colorClasses = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    green: "bg-green-500",
    red: "bg-red-500",
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
        <div className={`${colorClasses[color]} p-3 rounded-lg`}>
          {icon ? createElement(icon, { className: "w-6 h-6 text-white" }) : null}
        </div>
      </div>
    </div>
  );
}

function ResultDetails({ result, onBack }) {
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
        >
          Back to Results
        </button>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{result.examTitle}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Score</p>
                <p className="font-semibold text-gray-800">
                  {result.marksObtained} / {result.totalMarks}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Percentage</p>
                <p className="font-semibold text-gray-800">
                  {Number(result.percentage || 0).toFixed(2)}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {result.status === "pass" ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p
                  className={`font-semibold ${
                    result.status === "pass" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {result.status === "pass" ? "Passed" : "Failed"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>
              {result.submittedAt?.toDate?.()
                ? `Submitted on ${result.submittedAt.toDate().toLocaleString()}`
                : result.evaluatedAt?.toDate?.()
                  ? `Evaluated on ${result.evaluatedAt.toDate().toLocaleString()}`
                  : "Date not available"}
            </span>
          </div>
        </div>

        {result.questionRows && result.questionRows.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Question-wise Breakdown</h3>

            <div className="space-y-6">
              {result.questionRows.map((row, index) => (
                <div
                  key={row.questionId}
                  className="border-b border-gray-200 pb-6 last:border-0"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 mb-2">
                        Question {index + 1}: {row.question}
                      </p>
                      <p className="text-sm text-gray-600">
                        Type: {String(row.type || "unknown").toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Marks</p>
                      <p className="font-semibold text-gray-800">
                        {row.marksAwarded} / {row.totalMarks}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg mb-3">
                    <p className="text-sm text-gray-600 mb-1">Your Answer:</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {row.studentAnswer || "Not Answered"}
                    </p>
                  </div>

                  {row.type === "mcq" && row.options?.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {row.options.map((option, optIndex) => {
                        const optionLabel = option.text ?? String(option);
                        const isStudentAnswer = row.studentAnswer === optionLabel;
                        const isCorrectAnswer = Boolean(option?.isCorrect);

                        return (
                          <div
                            key={optIndex}
                            className={`p-3 rounded-lg ${
                              isCorrectAnswer
                                ? "bg-green-50 border border-green-200"
                                : isStudentAnswer
                                  ? "bg-blue-50 border border-blue-200"
                                  : "bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isCorrectAnswer && (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              )}
                              <span className="text-sm text-gray-700">{optionLabel}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {row.type === "descriptive" && row.sampleAnswer && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Sample Answer:</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {row.sampleAnswer}
                      </p>
                    </div>
                  )}

                  {row.feedback && (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Feedback:</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {row.feedback}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
