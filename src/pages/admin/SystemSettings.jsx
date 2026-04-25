import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config";
import {
  Settings,
  Save,
  Shield,
  FileText,
  Bell,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import SettingsSection from "../../components/admin/SettingsSection";
import {
  InputField,
  SelectField,
  ToggleField,
} from "../../components/admin/FormFields";

export default function SystemSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasConnectionIssue, setHasConnectionIssue] = useState(false);
  const [settings, setSettings] = useState({
    // Platform Settings
    platform: {
      name: "CertiX Exam Portal",
      allowRegistration: false,
      requireEmailVerification: false,
      defaultUserRole: "student",
    },
    // Exam Defaults
    examDefaults: {
      duration: 60,
      passingPercentage: 40,
      allowLateSubmission: false,
      showResultsImmediately: false,
      randomizeQuestions: false,
      randomizeOptions: false,
    },
    // Security Settings
    security: {
      maxLoginAttempts: 5,
      sessionTimeout: 3600, // in seconds
      requireStrongPassword: true,
      twoFactorAuth: false,
    },
    // Notification Settings
    notifications: {
      emailNotifications: true,
      examReminders: true,
      resultNotifications: true,
      systemAlerts: true,
    },
  });

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setHasConnectionIssue(false);
      const settingsDoc = await getDoc(doc(db, "settings", "system"));

      if (settingsDoc.exists()) {
        setSettings((prevSettings) => ({
          ...prevSettings,
          ...settingsDoc.data(),
        }));
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      setHasConnectionIssue(true);

      // Check if error is caused by ad blocker or browser extension
      if (error.message && error.message.includes("ERR_BLOCKED_BY_CLIENT")) {
        toast.error(
          "Request blocked by browser extension. Please disable ad blocker for this site.",
          {
            duration: 6000,
          },
        );
      } else if (
        error.code === "unavailable" ||
        error.message.includes("Failed to fetch")
      ) {
        toast.error(
          "Unable to connect to database. Please check your internet connection or disable ad blockers.",
          {
            duration: 6000,
          },
        );
      } else {
        toast.error("Failed to load settings. Using default values.");
      }

      // Continue with default settings even if fetch fails
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);

      await setDoc(doc(db, "settings", "system"), {
        ...settings,
        updatedAt: serverTimestamp(),
      });

      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);

      // Check if error is caused by ad blocker or browser extension
      if (
        error.message &&
        (error.message.includes("ERR_BLOCKED_BY_CLIENT") ||
          error.message.includes("Failed to fetch"))
      ) {
        toast.error(
          "Request blocked by browser extension. Please disable ad blocker for this site.",
          {
            duration: 6000,
          },
        );
      } else {
        toast.error("Failed to save settings. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const updatePlatformSetting = (key, value) => {
    setSettings({
      ...settings,
      platform: { ...settings.platform, [key]: value },
    });
  };

  const updateExamDefault = (key, value) => {
    setSettings({
      ...settings,
      examDefaults: { ...settings.examDefaults, [key]: value },
    });
  };

  const updateSecuritySetting = (key, value) => {
    setSettings({
      ...settings,
      security: { ...settings.security, [key]: value },
    });
  };

  const updateNotificationSetting = (key, value) => {
    setSettings({
      ...settings,
      notifications: { ...settings.notifications, [key]: value },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Connection Issue Warning */}
        {hasConnectionIssue && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-yellow-800">
                  Connection Issue Detected
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Unable to load settings from database. This is usually caused
                  by browser ad blockers or privacy extensions. Please disable
                  them for this site or add it to your whitelist.
                </p>
                <button
                  onClick={fetchSettings}
                  className="mt-2 text-sm text-yellow-800 hover:text-yellow-900 font-medium underline"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              System Settings
            </h1>
            <p className="text-gray-600 mt-2">
              Configure platform-wide settings and defaults
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        {/* Platform Settings */}
        <SettingsSection
          icon={<Settings className="w-6 h-6 text-blue-600" />}
          title="Platform Settings"
          description="General platform configuration"
        >
          <div className="space-y-4">
            <InputField
              label="Platform Name"
              type="text"
              value={settings.platform.name}
              onChange={(e) => updatePlatformSetting("name", e.target.value)}
            />

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-800">
                Public registration is disabled
              </p>
              <p className="text-xs text-amber-700 mt-1">
                New student and examiner accounts are provisioned by admins from
                User Management.
              </p>
            </div>

            <ToggleField
              label="Require Email Verification"
              description="Users must verify their email before accessing the platform"
              checked={settings.platform.requireEmailVerification}
              onChange={(checked) =>
                updatePlatformSetting("requireEmailVerification", checked)
              }
            />

            <SelectField
              label="Default User Role"
              description="Role assigned to new users by default"
              value={settings.platform.defaultUserRole}
              onChange={(e) =>
                updatePlatformSetting("defaultUserRole", e.target.value)
              }
              options={[
                { value: "student", label: "Student" },
                { value: "examiner", label: "Examiner" },
              ]}
            />
          </div>
        </SettingsSection>

        {/* Exam Defaults */}
        <SettingsSection
          icon={<FileText className="w-6 h-6 text-green-600" />}
          title="Exam Default Settings"
          description="Default values for new exams"
        >
          <div className="space-y-4">
            <InputField
              label="Default Duration (minutes)"
              type="number"
              value={settings.examDefaults.duration}
              onChange={(e) =>
                updateExamDefault("duration", parseInt(e.target.value))
              }
              min="1"
            />

            <InputField
              label="Default Passing Percentage"
              type="number"
              value={settings.examDefaults.passingPercentage}
              onChange={(e) =>
                updateExamDefault("passingPercentage", parseInt(e.target.value))
              }
              min="0"
              max="100"
            />

            <ToggleField
              label="Allow Late Submission"
              description="Students can submit exams after the deadline"
              checked={settings.examDefaults.allowLateSubmission}
              onChange={(checked) =>
                updateExamDefault("allowLateSubmission", checked)
              }
            />

            <ToggleField
              label="Show Results Immediately"
              description="Display results to students right after submission"
              checked={settings.examDefaults.showResultsImmediately}
              onChange={(checked) =>
                updateExamDefault("showResultsImmediately", checked)
              }
            />

            <ToggleField
              label="Randomize Questions"
              description="Show questions in random order for each student"
              checked={settings.examDefaults.randomizeQuestions}
              onChange={(checked) =>
                updateExamDefault("randomizeQuestions", checked)
              }
            />

            <ToggleField
              label="Randomize Options"
              description="Shuffle MCQ options for each student"
              checked={settings.examDefaults.randomizeOptions}
              onChange={(checked) =>
                updateExamDefault("randomizeOptions", checked)
              }
            />
          </div>
        </SettingsSection>

        {/* Security Settings */}
        <SettingsSection
          icon={<Shield className="w-6 h-6 text-purple-600" />}
          title="Security Settings"
          description="Platform security and authentication settings"
        >
          <div className="space-y-4">
            <InputField
              label="Max Login Attempts"
              type="number"
              value={settings.security.maxLoginAttempts}
              onChange={(e) =>
                updateSecuritySetting(
                  "maxLoginAttempts",
                  parseInt(e.target.value),
                )
              }
              min="1"
              max="10"
            />

            <InputField
              label="Session Timeout (seconds)"
              type="number"
              value={settings.security.sessionTimeout}
              onChange={(e) =>
                updateSecuritySetting(
                  "sessionTimeout",
                  parseInt(e.target.value),
                )
              }
              min="300"
            />

            <ToggleField
              label="Require Strong Password"
              description="Enforce strong password requirements (min 8 chars, uppercase, lowercase, number)"
              checked={settings.security.requireStrongPassword}
              onChange={(checked) =>
                updateSecuritySetting("requireStrongPassword", checked)
              }
            />

            <ToggleField
              label="Two-Factor Authentication"
              description="Enable two-factor authentication for all users"
              checked={settings.security.twoFactorAuth}
              onChange={(checked) =>
                updateSecuritySetting("twoFactorAuth", checked)
              }
            />
          </div>
        </SettingsSection>

        {/* Notification Settings */}
        <SettingsSection
          icon={<Bell className="w-6 h-6 text-orange-600" />}
          title="Notification Settings"
          description="Configure system notifications and alerts"
        >
          <div className="space-y-4">
            <ToggleField
              label="Email Notifications"
              description="Send email notifications to users"
              checked={settings.notifications.emailNotifications}
              onChange={(checked) =>
                updateNotificationSetting("emailNotifications", checked)
              }
            />

            <ToggleField
              label="Exam Reminders"
              description="Send reminders before exams start"
              checked={settings.notifications.examReminders}
              onChange={(checked) =>
                updateNotificationSetting("examReminders", checked)
              }
            />

            <ToggleField
              label="Result Notifications"
              description="Notify students when results are published"
              checked={settings.notifications.resultNotifications}
              onChange={(checked) =>
                updateNotificationSetting("resultNotifications", checked)
              }
            />

            <ToggleField
              label="System Alerts"
              description="Receive system-level alerts and updates"
              checked={settings.notifications.systemAlerts}
              onChange={(checked) =>
                updateNotificationSetting("systemAlerts", checked)
              }
            />
          </div>
        </SettingsSection>

        {/* Save Button (Bottom) */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? "Saving..." : "Save All Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}


