import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";

// Eager-loaded components (auth & critical)
import Login from "./pages/auth/Login";
import ActionHandler from "./pages/auth/ActionHandler";
import ActivateAccount from "./pages/auth/ActivateAccount";
import UserNotFoundRedirect from "./components/UserNotFoundRedirect";

// Lazy-loaded Layouts
const AdminLayout = lazy(() => import("./components/AdminLayout"));
const ExaminerLayout = lazy(() => import("./components/ExaminerLayout"));
const StudentLayout = lazy(() => import("./components/StudentLayout"));

// Lazy-loaded Admin Pages
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const ExamMonitoring = lazy(() => import("./pages/admin/ExamMonitoring"));
const SystemReports = lazy(() => import("./pages/admin/SystemReports"));
const SystemSettings = lazy(() => import("./pages/admin/SystemSettings"));
const AdminProfile = lazy(() => import("./pages/admin/Profile"));

// Lazy-loaded Examiner Pages
const ExaminerDashboard = lazy(() => import("./pages/examiner/Dashboard"));
const QuestionBank = lazy(() => import("./pages/examiner/QuestionBank"));
const CreateExam = lazy(() => import("./pages/examiner/CreateExam"));
const ManageExams = lazy(() => import("./pages/examiner/ManageExams"));
const ExamDetails = lazy(() => import("./pages/examiner/ExamDetails"));
const EvaluationCenter = lazy(
  () => import("./pages/examiner/EvaluationCenter"),
);
const StudentPerformance = lazy(
  () => import("./pages/examiner/StudentPerformance"),
);
const ExaminerProfile = lazy(() => import("./pages/examiner/Profile"));

// Lazy-loaded Student Pages
const StudentDashboard = lazy(() => import("./pages/student/Dashboard"));
const MyExams = lazy(() => import("./pages/student/MyExams"));
const Results = lazy(() => import("./pages/student/Results"));
const Profile = lazy(() => import("./pages/student/Profile"));
const ExamInstructions = lazy(() => import("./pages/student/ExamInstructions"));
const TakeExam = lazy(() => import("./pages/student/TakeExam"));

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public Routes - Redirect to dashboard if logged in */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route path="/auth/action" element={<ActionHandler />} />
          <Route
            path="/auth/activate-account"
            element={
              <ProtectedRoute>
                <ActivateAccount />
              </ProtectedRoute>
            }
          />
          <Route path="/user-not-found" element={<UserNotFoundRedirect />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="monitoring" element={<ExamMonitoring />} />
            <Route path="reports" element={<SystemReports />} />
            <Route path="settings" element={<SystemSettings />} />
            <Route path="profile" element={<AdminProfile />} />
          </Route>

          {/* Examiner Routes */}
          <Route
            path="/examiner"
            element={
              <ProtectedRoute allowedRoles={["examiner"]}>
                <ExaminerLayout />
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={<Navigate to="/examiner/dashboard" replace />}
            />
            <Route path="dashboard" element={<ExaminerDashboard />} />
            <Route path="questions" element={<QuestionBank />} />
            <Route path="create" element={<CreateExam />} />
            <Route path="manage" element={<ManageExams />} />
            <Route path="exam/:examId" element={<ExamDetails />} />
            <Route path="evaluate" element={<EvaluationCenter />} />
            <Route path="evaluate/:attemptId" element={<EvaluationCenter />} />
            <Route path="performance" element={<StudentPerformance />} />
            <Route path="profile" element={<ExaminerProfile />} />
          </Route>

          {/* Student Routes */}
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentLayout />
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={<Navigate to="/student/dashboard" replace />}
            />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="exams" element={<MyExams />} />
            <Route
              path="exam/:examId/instructions"
              element={<ExamInstructions />}
            />
            <Route path="exam/:examId/take" element={<TakeExam />} />
            <Route path="results" element={<Results />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
