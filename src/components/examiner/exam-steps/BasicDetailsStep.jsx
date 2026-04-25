export default function BasicDetailsStep({ formData, onChange }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold mb-6">Basic Details</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Exam Title *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => onChange({ ...formData, title: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Final Semester Examination"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            onChange({ ...formData, description: e.target.value })
          }
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          rows="4"
          placeholder="Enter exam description and instructions..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Subject *
          </label>
          <input
            type="text"
            value={formData.subject}
            onChange={(e) => onChange({ ...formData, subject: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Mathematics"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Duration (minutes) *
          </label>
          <input
            type="number"
            min="1"
            value={formData.duration}
            onChange={(e) =>
              onChange({ ...formData, duration: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Passing Marks (%)
        </label>
        <input
          type="number"
          min="0"
          max="100"
          value={formData.passingMarks}
          onChange={(e) =>
            onChange({ ...formData, passingMarks: e.target.value })
          }
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
