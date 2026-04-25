import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  ArrowLeft,
} from "lucide-react";
import toast from "react-hot-toast";
import Logo from "../../components/Logo";

export default function Login() {
  const [mode, setMode] = useState("login"); // 'login', 'forgot'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
    resetEmail: "",
  });

  const { login, resetPassword } = useAuth();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.identifier) {
      toast.error("Email or enrollment number is required");
      return false;
    }

    if (
      formData.identifier.includes("@") &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.identifier)
    ) {
      toast.error("Please enter a valid admin email");
      return false;
    }

    if (mode === "login") {
      if (!formData.password) {
        toast.error("Password is required");
        return false;
      }

      if (formData.password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return false;
      }
    }

    return true;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      await login(formData.identifier, formData.password, rememberMe);
      // Redirect will happen automatically via useEffect
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();

    if (!formData.resetEmail) {
      toast.error("Please enter admin email address");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.resetEmail)) {
      toast.error("Please enter a valid admin email");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(formData.resetEmail);
      toast.success("Password reset email sent! Check your inbox.");
      setMode("login");
      setFormData({ ...formData, password: "", resetEmail: "" });
    } catch (error) {
      console.error("Password reset error:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      identifier: "",
      password: "",
      resetEmail: "",
    });
    setShowPassword(false);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    resetForm();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo width="120px" className="drop-shadow-lg rounded-full" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
            Certix Exam Portal
          </h1>
          <p className="text-gray-600">
            {mode === "login" && "Welcome back! Please login to continue"}
            {mode === "forgot" && "Reset your password"}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Back to Login Button (for Forgot Password) */}
          {mode === "forgot" && (
            <button
              onClick={() => switchMode("login")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>
          )}

          {/* Login Form */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email or Enrollment Number
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="identifier"
                    value={formData.identifier}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="Enter email or enrollment number"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-600">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                <LogIn className="w-5 h-5" />
                {loading ? "Logging in..." : "Login"}
              </button>

              <p className="text-xs text-center text-gray-500 leading-relaxed">
                You can login using either your email address or enrollment number.
              </p>

              <p className="text-xs text-center text-gray-500 leading-relaxed">
                Account registration is managed by your college administrator.
                Contact your department if you do not have login credentials.
              </p>
            </form>
          )}

          {/* Forgot Password Form */}
          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
                  <Mail className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-sm text-gray-600">
                  Enter your login email to receive a password reset link.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Login Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    name="resetEmail"
                    value={formData.resetEmail}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="Enter login email"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>© 2026 Certix Exam Portal. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

