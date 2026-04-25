import { useState } from "react";

export default function StudentsStep({
  formData,
  availableStudents,
  onToggleStudent,
  onSelectAll,
  onDeselectAll,
  onAssignStudents,
  onAssignRangeStudents,
}) {
  const [studentSearch, setStudentSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const normalizedSearch = studentSearch.trim().toLowerCase();

  const filteredStudents = availableStudents.filter((student) => {
    const name = student.name?.toLowerCase() || "";
    const email = student.email?.toLowerCase() || "";
    const enrollment = student.enrollmentNumber?.toLowerCase() || "";

    return (
      name.includes(normalizedSearch) ||
      email.includes(normalizedSearch) ||
      enrollment.includes(normalizedSearch)
    );
  });

  const handleSelectFiltered = () => {
    if (!filteredStudents.length) return;

    const merged = Array.from(
      new Set([
        ...formData.assignedTo,
        ...filteredStudents.map((student) => student.uid),
      ]),
    );

    onAssignStudents(merged);
  };

  const handleAssignRange = () => {
    onAssignRangeStudents({
      year: yearFilter,
      start: rangeStart,
      end: rangeEnd,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Assign Students</h2>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Select All
          </button>
          <button
            onClick={onDeselectAll}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Deselect All
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        {formData.assignedTo.length} of {availableStudents.length} students
        selected
      </p>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-3">
        <p className="text-sm font-medium text-blue-900">
          Enrollment format: KA2KYY/100407XXX (YY = year, XXX = sequence)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            type="text"
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value.replace(/\D/g, "").slice(0, 2))}
            placeholder="YY (e.g. 24)"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            min="1"
            value={rangeStart}
            onChange={(event) => setRangeStart(event.target.value)}
            placeholder="Start XXX"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            min="1"
            value={rangeEnd}
            onChange={(event) => setRangeEnd(event.target.value)}
            placeholder="End XXX"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleAssignRange}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Assign Range
          </button>
        </div>
      </div>

      <div>
        <input
          type="text"
          placeholder="Search by name, email, enrollment (e.g., KA2K24)"
          value={studentSearch}
          onChange={(e) => setStudentSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <div className="mt-2">
          <button
            type="button"
            onClick={handleSelectFiltered}
            className="px-4 py-2 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
          >
            Select Filtered ({filteredStudents.length})
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-2">
        {filteredStudents.map((student) => (
            <div
              key={student.uid}
              className={`border rounded-lg p-4 cursor-pointer ${
                formData.assignedTo.includes(student.uid)
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-blue-300"
              }`}
              onClick={() => onToggleStudent(student.uid)}
            >
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.assignedTo.includes(student.uid)}
                  onChange={() => onToggleStudent(student.uid)}
                  className="w-5 h-5 text-blue-600 mr-4"
                />
                <div>
                  <h3 className="font-semibold">{student.name}</h3>
                  <p className="text-sm text-gray-600">{student.email}</p>
                  <p className="text-xs text-gray-500">
                    Enrollment: {student.enrollmentNumber || "Not set"}
                  </p>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
