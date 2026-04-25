export default function SettingsSection({
  icon,
  title,
  description,
  children,
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
      <div className="border-t pt-4">{children}</div>
    </div>
  );
}
