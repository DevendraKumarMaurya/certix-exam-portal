import { Users, TrendingUp, FileText, Eye } from "lucide-react";

export default function ExamCard({ exam, status, onView }) {
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

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-gray-800 mb-1">
            {exam.title}
          </h3>
          <p className="text-sm text-gray-600">{exam.subject}</p>
        </div>
        {getStatusBadge(status)}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <Users className="w-4 h-4 mr-2" />
          <span>{exam.assignedStudents?.length || 0} students assigned</span>
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <TrendingUp className="w-4 h-4 mr-2" />
          <span>
            {exam.attemptCount || 0} attempts ({exam.completedCount || 0}{" "}
            completed)
          </span>
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <FileText className="w-4 h-4 mr-2" />
          <span>{exam.questions?.length || 0} questions</span>
        </div>
        {exam.creatorName && (
          <div className="flex items-center text-sm text-gray-600">
            <span className="font-medium">Created by: {exam.creatorName}</span>
          </div>
        )}
      </div>

      <button
        onClick={onView}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
      >
        <Eye className="w-4 h-4" />
        View Details
      </button>
    </div>
  );
}
