import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../hooks/useAuth";
import {
  Search,
  Eye,
  Edit2,
  Trash2,
  Copy,
  Calendar,
  Clock,
  Users,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";

export default function ManageExams() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [filteredExams, setFilteredExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "all",
    searchTerm: "",
  });

  const fetchExams = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const examsRef = collection(db, "exams");
      const q = query(examsRef, where("createdBy", "==", currentUser.uid));
      const snapshot = await getDocs(q);

      const examsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort by creation date (newest first)
      examsList.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);

      setExams(examsList);
    } catch (error) {
      console.error("Error fetching exams:", error);
      toast.error("Failed to load exams");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const applyFilters = useCallback(() => {
    let filtered = [...exams];

    // Filter by status
    if (filters.status !== "all") {
      filtered = filtered.filter((exam) => exam.status === filters.status);
    }

    // Search in title and subject
    if (filters.searchTerm) {
      filtered = filtered.filter(
        (exam) =>
          exam.title
            ?.toLowerCase()
            .includes(filters.searchTerm.toLowerCase()) ||
          exam.subject
            ?.toLowerCase()
            .includes(filters.searchTerm.toLowerCase()),
      );
    }

    setFilteredExams(filtered);
  }, [exams, filters]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleDeleteExam = async (examId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this exam? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      // Check if exam has any attempts
      const attemptsRef = collection(db, "examAttempts");
      const attemptsQuery = query(attemptsRef, where("examId", "==", examId));
      const attemptsSnapshot = await getDocs(attemptsQuery);

      if (!attemptsSnapshot.empty) {
        toast.error("Cannot delete exam with existing attempts");
        return;
      }

      await deleteDoc(doc(db, "exams", examId));
      toast.success("Exam deleted successfully");
      fetchExams();
    } catch (error) {
      console.error("Error deleting exam:", error);
      toast.error("Failed to delete exam");
    }
  };

  const handleDuplicateExam = async (exam) => {
    try {
      // Destructure to remove id and createdAt, then use spread
      const newExamData = {
        ...exam,
        title: exam.title + " (Copy)",
        status: "draft",
        isPublished: false,
        createdAt: serverTimestamp(),
      };

      // Remove id and createdAt from the new object
      delete newExamData.id;
      delete newExamData.createdAt;

      await addDoc(collection(db, "exams"), newExamData);

      toast.success("Exam duplicated successfully");
      fetchExams();
    } catch (error) {
      console.error("Error duplicating exam:", error);
      toast.error("Failed to duplicate exam");
    }
  };

  const handleTogglePublish = async (examId, currentStatus) => {
    try {
      await updateDoc(doc(db, "exams", examId), {
        isPublished: !currentStatus,
        status: !currentStatus ? "scheduled" : "draft",
      });

      toast.success(currentStatus ? "Exam unpublished" : "Exam published");
      fetchExams();
    } catch (error) {
      console.error("Error updating exam:", error);
      toast.error("Failed to update exam");
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { bg: "bg-gray-100", text: "text-gray-700", label: "Draft" },
      scheduled: {
        bg: "bg-blue-100",
        text: "text-blue-700",
        label: "Scheduled",
      },
      ongoing: { bg: "bg-green-100", text: "text-green-700", label: "Ongoing" },
      completed: {
        bg: "bg-purple-100",
        text: "text-purple-700",
        label: "Completed",
      },
    };

    const config = statusConfig[status] || statusConfig.draft;

    return (
      <span
        className={`px-3 py-1 text-xs rounded-full font-medium ${config.bg} ${config.text}`}
      >
        {config.label}
      </span>
    );
  };

  const ExamCard = ({ exam }) => {
    const examDate = exam.scheduledDate?.toDate();
    const now = new Date();
    const hasStarted = examDate && examDate <= now;
    const canEdit = !hasStarted;

    return (
      <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-800">
                {exam.title}
              </h3>
              {getStatusBadge(exam.status)}
            </div>
            <p className="text-sm text-gray-600 mb-3">{exam.description}</p>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center text-gray-600">
                <FileText className="w-4 h-4 mr-2" />
                Subject: {exam.subject}
              </div>
              <div className="flex items-center text-gray-600">
                <Clock className="w-4 h-4 mr-2" />
                Duration: {exam.duration} min
              </div>
              <div className="flex items-center text-gray-600">
                <Calendar className="w-4 h-4 mr-2" />
                {examDate ? examDate.toLocaleDateString() : "Not scheduled"}
              </div>
              <div className="flex items-center text-gray-600">
                <Users className="w-4 h-4 mr-2" />
                {exam.assignedTo?.length || 0} students
              </div>
            </div>

            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="text-gray-600">
                Questions: <strong>{exam.questions?.length || 0}</strong>
              </span>
              <span className="text-gray-600">
                Total Marks: <strong>{exam.totalMarks || 0}</strong>
              </span>
              <span className="text-gray-600">
                Passing: <strong>{exam.passingMarks || 0}%</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-4 border-t">
          <button
            onClick={() => navigate(`/examiner/exam/${exam.id}`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Eye className="w-4 h-4" />
            View Details
          </button>

          {canEdit && (
            <button
              onClick={() => navigate(`/examiner/edit-exam/${exam.id}`)}
              className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 text-sm"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}

          <button
            onClick={() => handleDuplicateExam(exam)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <Copy className="w-4 h-4" />
            Duplicate
          </button>

          {exam.status === "draft" && (
            <button
              onClick={() => handleTogglePublish(exam.id, exam.isPublished)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              Publish
            </button>
          )}

          {exam.status === "scheduled" && exam.isPublished && (
            <button
              onClick={() => handleTogglePublish(exam.id, exam.isPublished)}
              className="px-4 py-2 border border-orange-500 text-orange-600 rounded-lg hover:bg-orange-50 text-sm"
            >
              Unpublish
            </button>
          )}

          <button
            onClick={() => handleDeleteExam(exam.id)}
            className="ml-auto p-2 text-red-600 hover:bg-red-50 rounded-lg"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Manage Exams</h1>
            <p className="text-gray-600 mt-2">{exams.length} exams created</p>
          </div>
          <button
            onClick={() => navigate("/examiner/create")}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create New Exam
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search exams..."
                value={filters.searchTerm}
                onChange={(e) =>
                  setFilters({ ...filters, searchTerm: e.target.value })
                }
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Exams List */}
        {filteredExams.length > 0 ? (
          <div className="space-y-4">
            {filteredExams.map((exam) => (
              <ExamCard key={exam.id} exam={exam} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg mb-2">No exams found</p>
            <p className="text-gray-400 text-sm mb-6">
              {filters.searchTerm || filters.status !== "all"
                ? "Try adjusting your filters"
                : "Get started by creating your first exam"}
            </p>
            {!filters.searchTerm && filters.status === "all" && (
              <button
                onClick={() => navigate("/examiner/create")}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create New Exam
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


