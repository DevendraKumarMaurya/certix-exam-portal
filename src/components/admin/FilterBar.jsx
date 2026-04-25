export default function FilterBar({
  filters,
  onFilterChange,
  showRoleFilter = false,
  showStatusFilter = false,
  statusOptions = [],
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Search */}
        <input
          type="text"
          placeholder="Search..."
          value={filters.searchTerm || ""}
          onChange={(e) =>
            onFilterChange({ ...filters, searchTerm: e.target.value })
          }
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />

        {/* Role Filter */}
        {showRoleFilter && (
          <select
            value={filters.role || "all"}
            onChange={(e) =>
              onFilterChange({ ...filters, role: e.target.value })
            }
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            <option value="student">Student</option>
            <option value="examiner">Examiner</option>
            <option value="admin">Admin</option>
          </select>
        )}

        {/* Status Filter */}
        {showStatusFilter && (
          <select
            value={filters.status || "all"}
            onChange={(e) =>
              onFilterChange({ ...filters, status: e.target.value })
            }
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
