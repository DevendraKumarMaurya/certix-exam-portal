export default function UserDistributionCard({
  role,
  count,
  icon,
  colorClass,
}) {
  return (
    <div className={`${colorClass} rounded-lg p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{role}</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-800">{count}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}

