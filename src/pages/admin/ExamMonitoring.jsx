import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { Clock, FileText, BarChart3, Calendar } from "lucide-react";
import toast from "react-hot-toast";
import StatCard from "../../components/ui/StatCard";
import ExamCard from "../../components/admin/ExamCard";
import ExamDetailsModal from "../../components/admin/ExamDetailsModal";
import FilterBar from "../../components/admin/FilterBar";

export default function ExamMonitoring() {
  const [exams, setExams] = useState([]);
  const [filteredExams, setFilteredExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState(null);
  const [examStats, setExamStats] = useState(null);
  const [filters, setFilters] = useState({
    status: "all",
    searchTerm: "",
  });

  useEffect(() => {
    fetchAllExams();
  }, []);

  const applyFilters = useCallback(() => {
    let filtered = [...exams];

    // Filter by status
    if (filters.status !== "all") {
      filtered = filtered.filter(
        (exam) => getExamStatus(exam) === filters.status,
      );
    }

    // Search
    if (filters.searchTerm) {
      filtered = filtered.filter(
        (exam) =>
          exam.title
            ?.toLowerCase()
            .includes(filters.searchTerm.toLowerCase()) ||
          exam.subject
            ?.toLowerCase()
            .includes(filters.searchTerm.toLowerCase()) ||
          exam.creatorName
            ?.toLowerCase()
            .includes(filters.searchTerm.toLowerCase()),
      );
    }

    setFilteredExams(filtered);
  }, [exams, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const fetchAllExams = async () => {
    try {
      setLoading(true);
      const examsRef = collection(db, "exams");
      const examsSnapshot = await getDocs(examsRef);

      const examsList = await Promise.all(
        examsSnapshot.docs.map(async (examDoc) => {
          const examData = { id: examDoc.id, ...examDoc.data() };

          // Fetch creator details
          if (examData.createdBy) {
            const userDoc = await getDoc(doc(db, "users", examData.createdBy));
            if (userDoc.exists()) {
              examData.creatorName = userDoc.data().name;
            }
          }

          // Count attempts
          const attemptsQuery = query(
            collection(db, "examAttempts"),
            where("examId", "==", examDoc.id),
          );
          const attemptsSnapshot = await getDocs(attemptsQuery);
          examData.attemptCount = attemptsSnapshot.size;

          // Count completed attempts
          examData.completedCount = attemptsSnapshot.docs.filter(
            (doc) => doc.data().status === "completed",
          ).length;

          return examData;
        }),
      );

      // Sort by creation date (newest first)
      examsList.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
      );

      setExams(examsList);
    } catch (error) {
      console.error("Error fetching exams:", error);
      toast.error("Failed to load exams");
    } finally {
      setLoading(false);
    }
  };

  const getExamStatus = (exam) => {
    const now = new Date();
    const startTime = exam.startTime?.toDate();
    const endTime = exam.endTime?.toDate();

    if (!startTime || !endTime) return "draft";
    if (now < startTime) return "scheduled";
    if (now >= startTime && now <= endTime) return "active";
    return "completed";
  };

  const getStatusBadge = (status) => {
    const config = {
      draft: { bg: "bg-gray-100", text: "text-gray-700", label: "Draft" },
      scheduled: {
        bg: "bg-blue-100",
        text: "text-blue-700",
        label: "Scheduled",
      },
      active: { bg: "bg-green-100", text: "text-green-700", label: "Active" },
      completed: {
        bg: "bg-purple-100",
        text: "text-purple-700",
        label: "Completed",
      },
    };

    const { bg, text, label } = config[status] || config.draft;

    return (
      <span
        className={`px-3 py-1 text-xs rounded-full font-medium ${bg} ${text}`}
      >
        {label}
      </span>
    );
  };

  const viewExamDetails = async (exam) => {
    try {
      // Fetch detailed statistics
      const attemptsQuery = query(
        collection(db, "examAttempts"),
        where("examId", "==", exam.id),
      );
      const attemptsSnapshot = await getDocs(attemptsQuery);

      const attempts = attemptsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const completedAttempts = attempts.filter(
        (a) => a.status === "completed",
      );
      const inProgressAttempts = attempts.filter(
        (a) => a.status === "in_progress",
      );

      // Calculate average score
      const resultsQuery = query(
        collection(db, "results"),
        where("examId", "==", exam.id),
      );
      const resultsSnapshot = await getDocs(resultsQuery);
      const scores = resultsSnapshot.docs.map(
        (doc) => doc.data().percentage || 0,
      );
      const avgScore =
        scores.length > 0
          ? scores.reduce((sum, score) => sum + score, 0) / scores.length
          : 0;

      setExamStats({
        totalAttempts: attempts.length,
        completed: completedAttempts.length,
        inProgress: inProgressAttempts.length,
        averageScore: avgScore.toFixed(2),
        assignedStudents: exam.assignedStudents?.length || 0,
      });

      setSelectedExam(exam);
    } catch (error) {
      console.error("Error fetching exam details:", error);
      toast.error("Failed to load exam details");
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
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Exam Monitoring</h1>
          <p className="text-gray-600 mt-2">
            Monitor all exams across the platform
          </p>
        </div>

        {/* Overview Stats */}
        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory mb-8 md:grid md:grid-cols-4 md:gap-6 md:overflow-visible md:pb-0">
          <div className="min-w-[220px] snap-start md:min-w-0">
            <StatCard
              icon={FileText}
              label="Total Exams"
              value={exams.length}
              color="bg-blue-500"
            />
          </div>
          <div className="min-w-[220px] snap-start md:min-w-0">
            <StatCard
              icon={Clock}
              label="Active Exams"
              value={exams.filter((e) => getExamStatus(e) === "active").length}
              color="bg-green-500"
            />
          </div>
          <div className="min-w-[220px] snap-start md:min-w-0">
            <StatCard
              icon={Calendar}
              label="Scheduled"
              value={exams.filter((e) => getExamStatus(e) === "scheduled").length}
              color="bg-purple-500"
            />
          </div>
          <div className="min-w-[220px] snap-start md:min-w-0">
            <StatCard
              icon={BarChart3}
              label="Completed"
              value={exams.filter((e) => getExamStatus(e) === "completed").length}
              color="bg-orange-500"
            />
          </div>
        </div>

        {/* Filters */}
        <FilterBar
          filters={filters}
          onFilterChange={setFilters}
          showStatusFilter={true}
          statusOptions={[
            { value: "draft", label: "Draft" },
            { value: "scheduled", label: "Scheduled" },
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
          ]}
        />

        {/* Exams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              status={getExamStatus(exam)}
              onView={() => viewExamDetails(exam)}
            />
          ))}
        </div>

        {filteredExams.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg">
            No exams found matching your filters
          </div>
        )}

        {/* Exam Details Modal */}
        {selectedExam && examStats && (
          <ExamDetailsModal
            exam={selectedExam}
            stats={examStats}
            statusBadge={getStatusBadge(getExamStatus(selectedExam))}
            onClose={() => {
              setSelectedExam(null);
              setExamStats(null);
            }}
          />
        )}
      </div>
    </div>
  );
}


