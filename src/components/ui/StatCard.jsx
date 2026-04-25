import { memo } from "react";

function StatCard({ icon: Icon, label, value, color, subtext, onClick }) {
  return (
    <div
      className={`bg-white rounded-lg shadow p-6 ${onClick ? "cursor-pointer hover:shadow-lg transition-all hover:scale-105" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-gray-500 text-sm font-medium">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold mt-2">{value}</p>
          {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
        </div>
        {Icon && (
          <div className={`p-3 rounded-full ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(StatCard);

