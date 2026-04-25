export default function ScheduleStep({ formData, onChange }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold mb-6">Schedule Exam</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Exam Date *
          </label>
          <input
            type="date"
            value={formData.scheduledDate}
            onChange={(e) =>
              onChange({ ...formData, scheduledDate: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            min={new Date().toISOString().split("T")[0]}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Start Time *
          </label>
          <input
            type="time"
            value={formData.scheduledTime}
            onChange={(e) =>
              onChange({ ...formData, scheduledTime: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {formData.scheduledDate && formData.scheduledTime && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">
            Exam Schedule Summary
          </h3>
          <div className="space-y-1 text-sm text-blue-800">
            <p>
              Start:{" "}
              {new Date(
                `${formData.scheduledDate}T${formData.scheduledTime}`,
              ).toLocaleString()}
            </p>
            <p>Duration: {formData.duration} minutes</p>
            <p>
              End:{" "}
              {new Date(
                new Date(
                  `${formData.scheduledDate}T${formData.scheduledTime}`,
                ).getTime() +
                  formData.duration * 60000,
              ).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
