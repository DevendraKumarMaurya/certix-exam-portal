export default function ReviewStep({ formData, selectedQuestions }) {
  const totalMarks = selectedQuestions.reduce((sum, q) => sum + q.marks, 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold mb-6">Review & Publish</h2>

      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-700 mb-2">Exam Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Title:</span>
              <span className="ml-2 font-medium">{formData.title}</span>
            </div>
            <div>
              <span className="text-gray-600">Subject:</span>
              <span className="ml-2 font-medium">{formData.subject}</span>
            </div>
            <div>
              <span className="text-gray-600">Duration:</span>
              <span className="ml-2 font-medium">
                {formData.duration} minutes
              </span>
            </div>
            <div>
              <span className="text-gray-600">Total Marks:</span>
              <span className="ml-2 font-medium">{totalMarks}</span>
            </div>
            <div>
              <span className="text-gray-600">Passing Marks:</span>
              <span className="ml-2 font-medium">{formData.passingMarks}%</span>
            </div>
            <div>
              <span className="text-gray-600">Questions:</span>
              <span className="ml-2 font-medium">
                {selectedQuestions.length}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-700 mb-2">Schedule</h3>
          <p className="text-sm">
            {new Date(
              `${formData.scheduledDate}T${formData.scheduledTime}`,
            ).toLocaleString()}
          </p>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-700 mb-2">
            Assigned Students
          </h3>
          <p className="text-sm">{formData.assignedTo.length} students</p>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> Once published, students will be able to see
          this exam. You can save as draft to review later.
        </p>
      </div>
    </div>
  );
}
