import {
  LayoutDashboard,
  Users,
  Activity,
  FileText,
  Settings,
  HelpCircle,
  ClipboardList,
  CheckSquare,
  TrendingUp,
  BookOpen,
  Award,
  User,
} from "lucide-react";

export const roleConfigs = {
  admin: {
    title: "Admin",
    theme: "blue",
    hoverColor: "hover:bg-blue-50 hover:text-blue-600",
    navItems: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/admin/dashboard" },
      { icon: Users, label: "User Management", path: "/admin/users" },
      { icon: Activity, label: "Exam Monitoring", path: "/admin/monitoring" },
      { icon: FileText, label: "System Reports", path: "/admin/reports" },
      { icon: Settings, label: "Settings", path: "/admin/settings" },
      { icon: User, label: "Profile", path: "/admin/profile" },
    ],
  },
  examiner: {
    title: "Examiner",
    theme: "purple",
    hoverColor: "hover:bg-purple-50 hover:text-purple-600",
    navItems: [
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        path: "/examiner/dashboard",
      },
      { icon: HelpCircle, label: "Question Bank", path: "/examiner/questions" },
      { icon: FileText, label: "Create Exam", path: "/examiner/create" },
      { icon: ClipboardList, label: "Manage Exams", path: "/examiner/manage" },
      {
        icon: CheckSquare,
        label: "Evaluation Center",
        path: "/examiner/evaluate",
      },
      {
        icon: TrendingUp,
        label: "Student Performance",
        path: "/examiner/performance",
      },
      { icon: User, label: "Profile", path: "/examiner/profile" },
    ],
  },
  student: {
    title: "Student",
    theme: "green",
    hoverColor: "hover:bg-green-50 hover:text-green-600",
    navItems: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/student/dashboard" },
      { icon: BookOpen, label: "My Exams", path: "/student/exams" },
      { icon: Award, label: "Results", path: "/student/results" },
      { icon: User, label: "Profile", path: "/student/profile" },
    ],
  },
};
