import { Edit2, Trash2, Copy } from "lucide-react";

export default function QuestionCard({
  question,
  onEdit,
  onDuplicate,
  onDelete,
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-2 py-1 text-xs rounded-full font-medium ${
                question.type === "mcq"
                  ? "bg-blue-100 text-blue-700"
                  : question.type === "descriptive"
                    ? "bg-green-100 text-green-700"
                    : "bg-purple-100 text-purple-700"
              }`}
            >
              {question.type.toUpperCase()}
            </span>
            <span
              className={`px-2 py-1 text-xs rounded-full font-medium ${
                question.difficulty === "easy"
                  ? "bg-green-100 text-green-700"
                  : question.difficulty === "medium"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {question.difficulty}
            </span>
            <span className="text-xs text-gray-500">
              {question.marks} marks
            </span>
          </div>
          <h3 className="font-semibold text-gray-800 mb-2">
            {question.question}
          </h3>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Subject: {question.subject}</span>
            <span>Topic: {question.topic}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => onEdit(question)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDuplicate(question)}
            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(question.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Show preview based on question type */}
      {question.type === "mcq" && question.options && (
        <div className="mt-3 space-y-1">
          {question.options.map((option, index) => (
            <div
              key={index}
              className={`text-sm px-3 py-2 rounded ${
                option.isCorrect
                  ? "bg-green-50 text-green-700 font-medium"
                  : "bg-gray-50 text-gray-600"
              }`}
            >
              {String.fromCharCode(65 + index)}. {option.text}
            </div>
          ))}
        </div>
      )}

      {question.type === "numeric" && (
        <div className="mt-3 text-sm bg-purple-50 text-purple-700 px-3 py-2 rounded">
          Correct Answer: {question.correctAnswer}{" "}
          {question.tolerance && `(±${question.tolerance})`}
        </div>
      )}

      {question.type === "descriptive" && question.sampleAnswer && (
        <div className="mt-3 text-sm bg-gray-50 text-gray-600 px-3 py-2 rounded">
          Sample answer available • Max {question.maxMarks} marks
        </div>
      )}
    </div>
  );
}
