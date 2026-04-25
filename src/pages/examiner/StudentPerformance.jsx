import { useState, useEffect, useCallback } from "react";
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
  Search,
  TrendingUp,
  TrendingDown,
  Award,
  BarChart3,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";

export default function StudentPerformance() {
  const { currentUser } = useAuth();
  const [results, setResults] = useState([]);
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = useCallback(async () => {
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
      const examsList = examsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setExams(examsList);

      const examIds = examsList.map((e) => e.id);

      // Fetch results for exams created by this examiner
      // Firestore 'in' query supports max 10 items, so batch the queries
      const resultsList = [];
      const studentIds = new Set();

      if (examIds.length > 0) {
        const batchSize = 10;
        for (let i = 0; i < examIds.length; i += batchSize) {
          const batchIds = examIds.slice(i, i + batchSize);
          const resultsRef = collection(db, "results");
          const resultsQuery = query(
            resultsRef,
            where("examId", "in", batchIds),
          );
          const resultsSnapshot = await getDocs(resultsQuery);

          resultsSnapshot.docs.forEach((doc) => {
            const result = { id: doc.id, ...doc.data() };
            resultsList.push(result);
            studentIds.add(result.studentId);
          });
        }
      }

      setResults(resultsList);

      // Fetch student details individually
      const studentsList = [];
      for (const studentId of studentIds) {
        try {
          const studentDoc = await getDoc(doc(db, "users", studentId));
          if (studentDoc.exists()) {
            studentsList.push({ uid: studentDoc.id, ...studentDoc.data() });
          }
        } catch (error) {
          console.error(`Error fetching student ${studentId}:`, error);
        }
      }

      setStudents(studentsList);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load performance data");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStudentStats = (studentUid) => {
    const studentResults = results.filter((r) => r.studentId === studentUid);

    if (studentResults.length === 0) {
      return {
        totalExams: 0,
        averageScore: 0,
        passCount: 0,
        failCount: 0,
        passRate: 0,
      };
    }

    const totalExams = studentResults.length;
    const averageScore =
      studentResults.reduce((sum, r) => sum + r.percentage, 0) / totalExams;
    const passCount = studentResults.filter((r) => r.status === "pass").length;
    const failCount = totalExams - passCount;
    const passRate = (passCount / totalExams) * 100;

    return {
      totalExams,
      averageScore: averageScore.toFixed(2),
      passCount,
      failCount,
      passRate: passRate.toFixed(1),
    };
  };

  const getSubjectWisePerformance = (studentUid) => {
    const studentResults = results.filter((r) => r.studentId === studentUid);
    const subjectStats = {};

    studentResults.forEach((result) => {
      const exam = exams.find((e) => e.id === result.examId);
      if (exam && exam.subject) {
        if (!subjectStats[exam.subject]) {
          subjectStats[exam.subject] = {
            count: 0,
            totalPercentage: 0,
            passed: 0,
          };
        }
        subjectStats[exam.subject].count++;
        subjectStats[exam.subject].totalPercentage += result.percentage;
        if (result.status === "pass") {
          subjectStats[exam.subject].passed++;
        }
      }
    });

    return Object.entries(subjectStats).map(([subject, stats]) => ({
      subject,
      averageScore: (stats.totalPercentage / stats.count).toFixed(2),
      examsCount: stats.count,
      passRate: ((stats.passed / stats.count) * 100).toFixed(1),
    }));
  };

  const exportStudentReport = (student) => {
    const stats = getStudentStats(student.uid);
    const studentResults = results.filter((r) => r.studentId === student.uid);

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Student Performance Report\n\n";
    csvContent += `Student Name,${student.name}\n`;
    csvContent += `Email,${student.email}\n`;
    csvContent += `Total Exams,${stats.totalExams}\n`;
    csvContent += `Average Score,${stats.averageScore}%\n`;
    csvContent += `Pass Rate,${stats.passRate}%\n\n`;
    csvContent += "Exam Details\n";
    csvContent +=
      "Exam Title,Subject,Marks Obtained,Total Marks,Percentage,Status\n";

    studentResults.forEach((result) => {
      const exam = exams.find((e) => e.id === result.examId);
      if (exam) {
        csvContent += `${exam.title},${exam.subject},${result.marksObtained},${result.totalMarks},${result.percentage.toFixed(2)}%,${result.status}\n`;
      }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${student.name}_performance_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Report exported successfully");
  };

  const filteredStudents = students.filter(
    (student) =>
      student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Detail View
  if (selectedStudent) {
    const stats = getStudentStats(selectedStudent.uid);
    const studentResults = results.filter(
      (r) => r.studentId === selectedStudent.uid,
    );
    const subjectWise = getSubjectWisePerformance(selectedStudent.uid);

    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-blue-600 hover:text-blue-700 mb-2 text-sm"
              >
                ← Back to All Students
              </button>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                {selectedStudent.name}
              </h1>
              <p className="text-gray-600 mt-1">{selectedStudent.email}</p>
            </div>
            <button
              onClick={() => exportStudentReport(selectedStudent)}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-5 h-5" />
              Export Report
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-500 text-sm font-medium">Total Exams</p>
              <p className="text-2xl sm:text-3xl font-bold mt-2">{stats.totalExams}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-500 text-sm font-medium">Average Score</p>
              <p className="text-2xl sm:text-3xl font-bold mt-2 text-blue-600">
                {stats.averageScore}%
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-500 text-sm font-medium">Pass Rate</p>
              <p className="text-2xl sm:text-3xl font-bold mt-2 text-green-600">
                {stats.passRate}%
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-500 text-sm font-medium">Pass / Fail</p>
              <p className="text-2xl sm:text-3xl font-bold mt-2">
                <span className="text-green-600">{stats.passCount}</span> /
                <span className="text-red-600 ml-1">{stats.failCount}</span>
              </p>
            </div>
          </div>

          {/* Subject-wise Performance */}
          {subjectWise.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">
                Subject-wise Performance
              </h2>
              <div className="space-y-3">
                {subjectWise.map((subject, index) => (
                  <div
                    key={index}
                    className="border-l-4 border-blue-500 pl-4 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{subject.subject}</h3>
                        <p className="text-sm text-gray-600">
                          {subject.examsCount} exam
                          {subject.examsCount !== 1 ? "s" : ""} • Pass rate:{" "}
                          {subject.passRate}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">
                          {subject.averageScore}%
                        </p>
                        <p className="text-xs text-gray-500">Average</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exam History */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Exam History</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Exam</th>
                    <th className="text-left py-3 px-4">Subject</th>
                    <th className="text-center py-3 px-4">Marks</th>
                    <th className="text-center py-3 px-4">Percentage</th>
                    <th className="text-center py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {studentResults.map((result) => {
                    const exam = exams.find((e) => e.id === result.examId);
                    return (
                      <tr key={result.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{exam?.title}</td>
                        <td className="py-3 px-4">{exam?.subject}</td>
                        <td className="py-3 px-4 text-center">
                          {result.marksObtained} / {result.totalMarks}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold">
                          {result.percentage.toFixed(2)}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              result.status === "pass"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {result.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {result.publishedAt?.toDate().toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Student Performance
          </h1>
          <p className="text-gray-600 mt-2">
            View and analyze student performance across all exams
          </p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search students by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Students List */}
        {filteredStudents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredStudents.map((student) => {
              const stats = getStudentStats(student.uid);

              return (
                <div
                  key={student.uid}
                  className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedStudent(student)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        {student.name}
                      </h3>
                      <p className="text-sm text-gray-600">{student.email}</p>
                    </div>
                    {stats.averageScore >= 75 ? (
                      <Award className="w-6 h-6 text-yellow-500" />
                    ) : null}
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Exams Taken</p>
                      <p className="text-xl font-bold">{stats.totalExams}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Average</p>
                      <p className="text-xl font-bold text-blue-600">
                        {stats.averageScore}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Pass Rate</p>
                      <p className="text-xl font-bold text-green-600">
                        {stats.passRate}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="w-4 h-4" />
                        {stats.passCount} Pass
                      </span>
                      <span className="flex items-center gap-1 text-red-600">
                        <TrendingDown className="w-4 h-4" />
                        {stats.failCount} Fail
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStudent(student);
                      }}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">No student data available</p>
            <p className="text-gray-400 text-sm mt-2">
              Students will appear here once they complete exams
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


