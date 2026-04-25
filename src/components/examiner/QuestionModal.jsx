import { useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";

export default function QuestionModal({
  question,
  onClose,
  onSuccess,
  currentUser,
}) {
  const [formData, setFormData] = useState({
    question: question?.question || "",
    type: question?.type || "mcq",
    marks: question?.marks || 1,
    difficulty: question?.difficulty || "medium",
    subject: question?.subject || "",
    topic: question?.topic || "",
    // MCQ specific
    options: question?.options || [
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
    // Numeric specific
    correctAnswer: question?.correctAnswer || "",
    tolerance: question?.tolerance || "",
    // Descriptive specific
    maxMarks: question?.maxMarks || "",
    sampleAnswer: question?.sampleAnswer || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.question.trim()) {
      toast.error("Question text is required");
      return;
    }

    if (formData.type === "mcq" && formData.options.length < 2) {
      toast.error("MCQ must have at least 2 options");
      return;
    }

    if (
      formData.type === "mcq" &&
      !formData.options.some((opt) => opt.isCorrect)
    ) {
      toast.error("Please mark at least one correct answer");
      return;
    }

    try {
      setSaving(true);

      const questionData = {
        question: formData.question,
        type: formData.type,
        marks: Number(formData.marks),
        difficulty: formData.difficulty,
        subject: formData.subject,
        topic: formData.topic,
        createdBy: currentUser.uid,
        isActive: true,
      };

      // Add type-specific fields
      if (formData.type === "mcq") {
        questionData.options = formData.options.filter((opt) =>
          opt.text.trim(),
        );
      } else if (formData.type === "numeric") {
        questionData.correctAnswer = Number(formData.correctAnswer);
        if (formData.tolerance) {
          questionData.tolerance = Number(formData.tolerance);
        }
      } else if (formData.type === "descriptive") {
        questionData.maxMarks = Number(formData.maxMarks);
        if (formData.sampleAnswer) {
          questionData.sampleAnswer = formData.sampleAnswer;
        }
      }

      if (question?.id) {
        // Update existing question
        await updateDoc(doc(db, "questions", question.id), {
          ...questionData,
          updatedAt: serverTimestamp(),
        });
        toast.success("Question updated successfully");
        onSuccess({ id: question.id, ...questionData });
      } else {
        // Create new question
        const docRef = await addDoc(collection(db, "questions"), {
          ...questionData,
          createdAt: serverTimestamp(),
        });
        toast.success("Question created successfully");
        onSuccess({ id: docRef.id, ...questionData });
      }
    } catch (error) {
      console.error("Error saving question:", error);
      toast.error("Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  const addOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { text: "", isCorrect: false }],
    });
  };

  const removeOption = (index) => {
    const newOptions = formData.options.filter((_, i) => i !== index);
    setFormData({ ...formData, options: newOptions });
  };

  const updateOption = (index, field, value) => {
    const newOptions = [...formData.options];
    newOptions[index][field] = value;
    setFormData({ ...formData, options: newOptions });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold">
            {question ? "Edit Question" : "Add New Question"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Question Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Question Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="mcq">Multiple Choice (MCQ)</option>
              <option value="descriptive">Descriptive</option>
              <option value="numeric">Numeric</option>
            </select>
          </div>

          {/* Question Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Question *
            </label>
            <textarea
              value={formData.question}
              onChange={(e) =>
                setFormData({ ...formData, question: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows="4"
              required
            />
          </div>

          {/* Subject and Topic */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject *
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Topic *
              </label>
              <input
                type="text"
                value={formData.topic}
                onChange={(e) =>
                  setFormData({ ...formData, topic: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Marks and Difficulty */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Marks *
              </label>
              <input
                type="number"
                min="1"
                value={formData.marks}
                onChange={(e) =>
                  setFormData({ ...formData, marks: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty *
              </label>
              <select
                value={formData.difficulty}
                onChange={(e) =>
                  setFormData({ ...formData, difficulty: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {/* MCQ Options */}
          {formData.type === "mcq" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Options *
              </label>
              <div className="space-y-3">
                {formData.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={option.isCorrect}
                      onChange={(e) =>
                        updateOption(index, "isCorrect", e.target.checked)
                      }
                      className="w-5 h-5 text-blue-600"
                    />
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) =>
                        updateOption(index, "text", e.target.value)
                      }
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    {formData.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addOption}
                className="mt-3 text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                + Add Option
              </button>
            </div>
          )}

          {/* Numeric Fields */}
          {formData.type === "numeric" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correct Answer *
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.correctAnswer}
                  onChange={(e) =>
                    setFormData({ ...formData, correctAnswer: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tolerance (optional)
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.tolerance}
                  onChange={(e) =>
                    setFormData({ ...formData, tolerance: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="±0.1"
                />
              </div>
            </div>
          )}

          {/* Descriptive Fields */}
          {formData.type === "descriptive" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Marks *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.maxMarks}
                  onChange={(e) =>
                    setFormData({ ...formData, maxMarks: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sample Answer (optional)
                </label>
                <textarea
                  value={formData.sampleAnswer}
                  onChange={(e) =>
                    setFormData({ ...formData, sampleAnswer: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="4"
                  placeholder="Provide a sample answer for evaluators..."
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : question
                  ? "Update Question"
                  : "Create Question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
