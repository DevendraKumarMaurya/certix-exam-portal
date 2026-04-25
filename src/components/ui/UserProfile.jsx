import { memo } from "react";

function UserProfile({ currentUser, userRole, theme = "blue" }) {
  const themeColors = {
    blue: "from-blue-600 to-purple-600",
    purple: "from-purple-600 to-pink-600",
    green: "from-green-600 to-teal-600",
  };

  const roleColors = {
    admin: "text-blue-600",
    examiner: "text-purple-600",
    student: "text-green-600",
  };

  const gradientColor = themeColors[theme] || themeColors.blue;
  const roleColor = roleColors[userRole] || "text-gray-600";

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
      <div
        className={`shrink-0 w-10 h-10 bg-linear-to-br ${gradientColor} rounded-full flex items-center justify-center text-white font-bold`}
      >
        {currentUser?.displayName?.charAt(0).toUpperCase() ||
          currentUser?.email?.charAt(0).toUpperCase() ||
          "U"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">
          {currentUser?.displayName || "User"}
        </p>
        <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
        <p className={`text-xs font-medium capitalize ${roleColor}`}>
          {userRole || "user"}
        </p>
      </div>
    </div>
  );
}

export default memo(UserProfile);
