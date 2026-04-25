import { Search } from "lucide-react";

export default function QuestionFilters({ filters, onFilterChange }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search questions..."
            value={filters.searchTerm}
            onChange={(e) =>
              onFilterChange({ ...filters, searchTerm: e.target.value })
            }
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Type Filter */}
        <select
          value={filters.type}
          onChange={(e) => onFilterChange({ ...filters, type: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Types</option>
          <option value="mcq">MCQ</option>
          <option value="descriptive">Descriptive</option>
          <option value="numeric">Numeric</option>
        </select>

        {/* Difficulty Filter */}
        <select
          value={filters.difficulty}
          onChange={(e) =>
            onFilterChange({ ...filters, difficulty: e.target.value })
          }
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>

        {/* Subject Filter */}
        <input
          type="text"
          placeholder="Filter by subject..."
          value={filters.subject}
          onChange={(e) =>
            onFilterChange({ ...filters, subject: e.target.value })
          }
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
  );
}
