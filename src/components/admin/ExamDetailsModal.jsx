function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="font-medium text-gray-800">{value}</p>
    </div>
  );
}

function StatItem({ label, value }) {
  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

export default function ExamDetailsModal({
  exam,
  stats,
  statusBadge,
  onClose,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{exam.title}</h2>
            {statusBadge}
          </div>
          <p className="text-gray-600 mt-1">{exam.subject}</p>
        </div>

        <div className="p-6">
          {/* Basic Info */}
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-3">Exam Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem label="Duration" value={`${exam.duration} minutes`} />
              <InfoItem label="Total Marks" value={exam.totalMarks} />
              <InfoItem
                label="Total Questions"
                value={exam.questions?.length || 0}
              />
              <InfoItem
                label="Pass Percentage"
                value={`${exam.passingPercentage}%`}
              />
              {exam.startTime && (
                <InfoItem
                  label="Start Time"
                  value={exam.startTime.toDate().toLocaleString()}
                />
              )}
              {exam.endTime && (
                <InfoItem
                  label="End Time"
                  value={exam.endTime.toDate().toLocaleString()}
                />
              )}
            </div>
          </div>

          {/* Statistics */}
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-3">Statistics</h3>
            <div className="grid grid-cols-2 gap-4">
              <StatItem
                label="Assigned Students"
                value={stats.assignedStudents}
              />
              <StatItem label="Total Attempts" value={stats.totalAttempts} />
              <StatItem label="Completed" value={stats.completed} />
              <StatItem label="In Progress" value={stats.inProgress} />
              <StatItem
                label="Participation Rate"
                value={`${((stats.totalAttempts / stats.assignedStudents) * 100 || 0).toFixed(1)}%`}
              />
              <StatItem
                label="Average Score"
                value={`${stats.averageScore}%`}
              />
            </div>
          </div>

          {/* Description */}
          {exam.description && (
            <div className="mb-6">
              <h3 className="font-semibold text-lg mb-3">Description</h3>
              <p className="text-gray-700 whitespace-pre-line">
                {exam.description}
              </p>
            </div>
          )}

          {/* Instructions */}
          {exam.instructions && (
            <div className="mb-6">
              <h3 className="font-semibold text-lg mb-3">Instructions</h3>
              <p className="text-gray-700 whitespace-pre-line">
                {exam.instructions}
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
