import { memo } from "react";

function QuickActionCard({ icon: Icon, title, description, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-left border border-gray-200 hover:border-gray-300"
    >
      <div className="flex items-start gap-4">
        <div className={`${color} p-3 rounded-lg`}>
          {Icon && <Icon className="w-6 h-6 text-white" />}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </button>
  );
}

export default memo(QuickActionCard);
