import { Outlet, useLocation, useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { LogOut, Menu, X } from "lucide-react";
import { useState, memo } from "react";
import Logo from "./Logo";
import UserProfile from "./ui/UserProfile";
import { roleConfigs } from "../config/roleConfig";

function DashboardLayout({ role }) {
  const { logout, currentUser, userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const config = roleConfigs[role] || roleConfigs.admin;
  const hideDashboardChrome =
    role === "student" &&
    /^\/student\/exam\/[^/]+\/(instructions|take)$/.test(location.pathname);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-x-hidden">
      {!hideDashboardChrome && (
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[84vw] max-w-xs sm:w-64 bg-white border-r border-gray-200 shadow-xl transform transition-transform duration-300 lg:translate-x-0 lg:shadow-none ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="h-full flex flex-col">
            {/* Logo */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Logo width="40px" className="rounded-full" />
                <span className="text-lg font-semibold text-gray-800">
                  {config.title}
                </span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 space-y-1.5 sm:space-y-2">
              {config.navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-gray-700 ${config.hoverColor} rounded-lg transition-colors`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-gray-200">
              <UserProfile
                currentUser={currentUser}
                userRole={userRole}
                theme={config.theme}
              />
            </div>

            {/* Logout */}
            <div className="px-4 pb-4">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div className={`flex-1 min-w-0 ${hideDashboardChrome ? "" : "lg:pl-64"}`}>
        {!hideDashboardChrome && (
          <header className="lg:hidden sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-700"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-4 font-semibold text-gray-800">
              {config.title} Portal
            </span>
          </header>
        )}

        {/* Page Content */}
        <main>
          <Outlet />
        </main>
      </div>

      {/* Overlay for mobile */}
      {!hideDashboardChrome && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

export default memo(DashboardLayout);
