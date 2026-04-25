import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../hooks/useAuth";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import QuestionCard from "../../components/examiner/QuestionCard";
import QuestionModal from "../../components/examiner/QuestionModal";
import QuestionFilters from "../../components/examiner/QuestionFilters";

export default function QuestionBank() {
  const { currentUser } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [filters, setFilters] = useState({
    type: "all",
    subject: "",
    difficulty: "all",
    searchTerm: "",
  });

  const fetchQuestions = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const questionsRef = collection(db, "questions");
      const q = query(questionsRef, where("createdBy", "==", currentUser.uid));
      const snapshot = await getDocs(q);

      const questionsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setQuestions(questionsList);
    } catch (error) {
      console.error("Error fetching questions:", error);
      toast.error("Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const applyFilters = useCallback(() => {
    let filtered = [...questions];

    // Filter by type
    if (filters.type !== "all") {
      filtered = filtered.filter((q) => q.type === filters.type);
    }

    // Filter by difficulty
    if (filters.difficulty !== "all") {
      filtered = filtered.filter((q) => q.difficulty === filters.difficulty);
    }

    // Filter by subject
    if (filters.subject) {
      filtered = filtered.filter((q) =>
        q.subject?.toLowerCase().includes(filters.subject.toLowerCase()),
      );
    }

    // Search in question text
    if (filters.searchTerm) {
      filtered = filtered.filter((q) =>
        q.question?.toLowerCase().includes(filters.searchTerm.toLowerCase()),
      );
    }

    setFilteredQuestions(filtered);
  }, [questions, filters]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm("Are you sure you want to delete this question?"))
      return;

    try {
      await deleteDoc(doc(db, "questions", questionId));
      toast.success("Question deleted successfully");
      fetchQuestions();
    } catch (error) {
      console.error("Error deleting question:", error);
      toast.error("Failed to delete question");
    }
  };

  const handleEditQuestion = (question) => {
    setSelectedQuestion(question);
    setShowEditModal(true);
  };

  const handleDuplicateQuestion = (question) => {
    setSelectedQuestion({
      ...question,
      question: question.question + " (Copy)",
    });
    setShowAddModal(true);
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Question Bank</h1>
            <p className="text-gray-600 mt-2">
              {questions.length} questions created
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedQuestion(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Question
          </button>
        </div>

        {/* Filters */}
        <QuestionFilters filters={filters} onFilterChange={setFilters} />

        {/* Questions Grid */}
        {filteredQuestions.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredQuestions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                onEdit={handleEditQuestion}
                onDuplicate={handleDuplicateQuestion}
                onDelete={handleDeleteQuestion}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">No questions found</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first question
            </button>
          </div>
        )}

        {/* Add/Edit Modal */}
        {(showAddModal || showEditModal) && (
          <QuestionModal
            question={selectedQuestion}
            onClose={() => {
              setShowAddModal(false);
              setShowEditModal(false);
              setSelectedQuestion(null);
            }}
            onSuccess={() => {
              fetchQuestions();
              setShowAddModal(false);
              setShowEditModal(false);
              setSelectedQuestion(null);
            }}
            currentUser={currentUser}
          />
        )}
      </div>
    </div>
  );
}


