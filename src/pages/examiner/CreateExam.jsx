import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../hooks/useAuth";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  FileText,
  Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import StepProgress from "../../components/examiner/StepProgress";
import BasicDetailsStep from "../../components/examiner/exam-steps/BasicDetailsStep";
import ScheduleStep from "../../components/examiner/exam-steps/ScheduleStep";
import QuestionsStep from "../../components/examiner/exam-steps/QuestionsStep";
import StudentsStep from "../../components/examiner/exam-steps/StudentsStep";
import ReviewStep from "../../components/examiner/exam-steps/ReviewStep";
import QuestionModal from "../../components/examiner/QuestionModal";

export default function CreateExam() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    // Step 1: Basic Details
    title: "",
    description: "",
    subject: "",
    duration: 60,
    passingMarks: 40,

    // Step 2: Schedule
    scheduledDate: "",
    scheduledTime: "",

    // Step 3: Questions
    questions: [], // Array of { questionId, marks, order }

    // Step 4: Students
    assignedTo: [],
  });

  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [showCreateQuestionModal, setShowCreateQuestionModal] = useState(false);

  const fetchQuestions = useCallback(async () => {
    try {
      const questionsRef = collection(db, "questions");
      const q = query(
        questionsRef,
        where("createdBy", "==", currentUser.uid),
        where("isActive", "==", true),
      );
      const snapshot = await getDocs(q);

      const questions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setAvailableQuestions(questions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      toast.error("Failed to load questions");
    }
  }, [currentUser]);

  const fetchStudents = useCallback(async () => {
    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("role", "==", "student"),
        where("isActive", "==", true),
      );
      const snapshot = await getDocs(q);

      const students = snapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      }));

      setAvailableStudents(students);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Failed to load students");
    }
  }, []);

  useEffect(() => {
    if (currentStep === 3) {
      fetchQuestions();
    } else if (currentStep === 4) {
      fetchStudents();
    }
  }, [currentStep, fetchQuestions, fetchStudents]);

  const handleNext = () => {
    // Validation for each step
    if (currentStep === 1) {
      if (!formData.title.trim()) {
        toast.error("Please enter exam title");
        return;
      }
      if (!formData.subject.trim()) {
        toast.error("Please enter subject");
        return;
      }
      if (formData.duration < 1) {
        toast.error("Duration must be at least 1 minute");
        return;
      }
    } else if (currentStep === 2) {
      if (!formData.scheduledDate) {
        toast.error("Please select exam date");
        return;
      }
      if (!formData.scheduledTime) {
        toast.error("Please select exam time");
        return;
      }
    } else if (currentStep === 3) {
      if (selectedQuestions.length === 0) {
        toast.error("Please add at least one question");
        return;
      }
    } else if (currentStep === 4) {
      if (formData.assignedTo.length === 0) {
        toast.error("Please assign at least one student");
        return;
      }
    }

    setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (publishNow = false) => {
    try {
      setSaving(true);

      // Combine date and time
      const scheduledDateTime = new Date(
        `${formData.scheduledDate}T${formData.scheduledTime}`,
      );
      const endDateTime = new Date(
        scheduledDateTime.getTime() + formData.duration * 60000,
      );

      // Calculate total marks
      const totalMarks = selectedQuestions.reduce((sum, q) => sum + q.marks, 0);

      const examData = {
        title: formData.title,
        description: formData.description,
        subject: formData.subject,
        duration: Number(formData.duration),
        totalMarks,
        passingMarks: Number(formData.passingMarks),
        scheduledDate: Timestamp.fromDate(scheduledDateTime),
        scheduledTime: formData.scheduledTime,
        endDateTime: Timestamp.fromDate(endDateTime),
        questions: selectedQuestions.map((q, index) => ({
          questionId: q.id,
          marks: q.marks,
          order: index + 1,
        })),
        assignedTo: formData.assignedTo,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        status: publishNow ? "scheduled" : "draft",
        isPublished: publishNow,
      };

      await addDoc(collection(db, "exams"), examData);

      toast.success(
        publishNow ? "Exam created and published!" : "Exam saved as draft",
      );
      navigate("/examiner/manage-exams");
    } catch (error) {
      console.error("Error creating exam:", error);
      toast.error("Failed to create exam");
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = (question) => {
    if (selectedQuestions.find((q) => q.id === question.id)) {
      toast.error("Question already added");
      return;
    }

    setSelectedQuestions([
      ...selectedQuestions,
      { ...question, marks: question.marks },
    ]);
  };

  const removeQuestion = (questionId) => {
    setSelectedQuestions(selectedQuestions.filter((q) => q.id !== questionId));
  };

  const updateQuestionMarks = (questionId, newMarks) => {
    setSelectedQuestions(
      selectedQuestions.map((q) =>
        q.id === questionId ? { ...q, marks: Number(newMarks) } : q,
      ),
    );
  };

  const toggleStudent = (studentUid) => {
    if (formData.assignedTo.includes(studentUid)) {
      setFormData({
        ...formData,
        assignedTo: formData.assignedTo.filter((uid) => uid !== studentUid),
      });
    } else {
      setFormData({
        ...formData,
        assignedTo: [...formData.assignedTo, studentUid],
      });
    }
  };

  const assignStudents = (studentUids = []) => {
    const unique = Array.from(new Set(studentUids.filter(Boolean)));
    setFormData({
      ...formData,
      assignedTo: unique,
    });
  };

  const assignRangeStudents = ({ year = "", start = "", end = "" }) => {
    const parsedYear = String(year || "").trim();
    const startNumber = Number(start);
    const endNumber = Number(end);

    if (!/^\d{2}$/.test(parsedYear)) {
      toast.error("Enter valid 2-digit year (YY)");
      return;
    }

    if (
      !Number.isFinite(startNumber) ||
      !Number.isFinite(endNumber) ||
      startNumber < 1 ||
      endNumber < startNumber
    ) {
      toast.error("Enter a valid sequence range");
      return;
    }

    const matched = availableStudents.filter((student) => {
      const enrollment = String(student.enrollmentNumber || "").toUpperCase();
      const match = enrollment.match(/^KA2K(\d{2})\/100407(\d{3})$/);
      if (!match) return false;

      const [, yy, seq] = match;
      const sequence = Number(seq);

      return yy === parsedYear && sequence >= startNumber && sequence <= endNumber;
    });

    if (matched.length === 0) {
      toast.error("No students found in this enrollment range");
      return;
    }

    assignStudents(matched.map((student) => student.uid));
    toast.success(`Assigned ${matched.length} students from enrollment range`);
  };

  const selectAllStudents = () => {
    setFormData({
      ...formData,
      assignedTo: availableStudents.map((s) => s.uid),
    });
  };

  const deselectAllStudents = () => {
    setFormData({ ...formData, assignedTo: [] });
  };

  const steps = [
    { number: 1, title: "Basic Details", icon: FileText },
    { number: 2, title: "Schedule", icon: Calendar },
    { number: 3, title: "Add Questions", icon: FileText },
    { number: 4, title: "Assign Students", icon: Users },
    { number: 5, title: "Review & Publish", icon: Eye },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Create New Exam</h1>
          <p className="text-gray-600 mt-2">
            Follow the steps to create and publish an exam
          </p>
        </div>

        {/* Progress Steps */}
        <StepProgress steps={steps} currentStep={currentStep} />

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow p-8">
          {currentStep === 1 && (
            <BasicDetailsStep formData={formData} onChange={setFormData} />
          )}

          {currentStep === 2 && (
            <ScheduleStep formData={formData} onChange={setFormData} />
          )}

          {currentStep === 3 && (
            <QuestionsStep
              selectedQuestions={selectedQuestions}
              availableQuestions={availableQuestions}
              onAddQuestion={addQuestion}
              onRemoveQuestion={removeQuestion}
              onUpdateMarks={updateQuestionMarks}
              onCreateQuestion={() => setShowCreateQuestionModal(true)}
            />
          )}

          {currentStep === 4 && (
            <StudentsStep
              formData={formData}
              availableStudents={availableStudents}
              onToggleStudent={toggleStudent}
              onSelectAll={selectAllStudents}
              onDeselectAll={deselectAllStudents}
              onAssignStudents={assignStudents}
              onAssignRangeStudents={assignRangeStudents}
            />
          )}

          {currentStep === 5 && (
            <ReviewStep
              formData={formData}
              selectedQuestions={selectedQuestions}
            />
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>

            <div className="flex items-center gap-3">
              {currentStep === 5 ? (
                <>
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={saving}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Save as Draft
                  </button>
                  <button
                    onClick={() => handleSubmit(true)}
                    disabled={saving}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? "Publishing..." : "Publish Exam"}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Next
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showCreateQuestionModal && (
        <QuestionModal
          onClose={() => setShowCreateQuestionModal(false)}
          currentUser={currentUser}
          onSuccess={async (createdQuestion) => {
            await fetchQuestions();
            if (createdQuestion) {
              addQuestion(createdQuestion);
            }
            setShowCreateQuestionModal(false);
          }}
        />
      )}
    </div>
  );
}


