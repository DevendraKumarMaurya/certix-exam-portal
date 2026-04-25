import { useState } from "react";

export default function QuestionsStep({
  selectedQuestions,
  availableQuestions,
  onAddQuestion,
  onRemoveQuestion,
  onUpdateMarks,
  onCreateQuestion,
}) {
  const [questionSearch, setQuestionSearch] = useState("");
  const totalMarks = selectedQuestions.reduce((sum, q) => sum + q.marks, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Add Questions</h2>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="font-semibold">{selectedQuestions.length}</span>{" "}
            questions selected
            <span className="mx-2">•</span>
            <span className="font-semibold">{totalMarks}</span> total marks
          </div>
          <button
            type="button"
            onClick={onCreateQuestion}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Question
          </button>
        </div>
      </div>

      {/* Selected Questions */}
      {selectedQuestions.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-green-900 mb-3">
            Selected Questions
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {selectedQuestions.map((question, index) => (
              <div
                key={question.id}
                className="bg-white p-3 rounded flex items-center justify-between"
              >
                <div className="flex-1">
                  <span className="font-medium text-sm">Q{index + 1}.</span>
                  <span className="ml-2 text-sm">{question.question}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    value={question.marks}
                    onChange={(e) => onUpdateMarks(question.id, e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-sm text-gray-600">marks</span>
                  <button
                    onClick={() => onRemoveQuestion(question.id)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Questions */}
      <div>
        <input
          type="text"
          placeholder="Search questions..."
          value={questionSearch}
          onChange={(e) => setQuestionSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
        />
      </div>

      {/* Available Questions */}
      <div className="max-h-96 overflow-y-auto space-y-2">
        {availableQuestions.length === 0 && (
          <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
            <p className="text-sm text-gray-600 mb-3">
              No questions found. Create a question to continue exam setup.
            </p>
            <button
              type="button"
              onClick={onCreateQuestion}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create First Question
            </button>
          </div>
        )}

        {availableQuestions
          .filter((q) =>
            q.question.toLowerCase().includes(questionSearch.toLowerCase()),
          )
          .map((question) => (
            <div
              key={question.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 cursor-pointer"
              onClick={() => onAddQuestion(question)}
            >
              <div className="flex items-start justify-between">
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
                    <span className="text-xs text-gray-600">
                      {question.marks} marks
                    </span>
                  </div>
                  <p className="text-sm">{question.question}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {question.subject} • {question.topic}
                  </p>
                </div>
                <button
                  className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddQuestion(question);
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
