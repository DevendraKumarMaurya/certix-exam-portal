import { RefreshCw, ShieldAlert, AlertCircle } from "lucide-react";

export default function ConnectionError({ onRetry }) {
  const handleDisableAdBlocker = () => {
    window.open("https://support.google.com/chrome/answer/7632919", "_blank");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
          <ShieldAlert className="w-10 h-10 text-red-600" />
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">
          Connection Blocked
        </h1>

        {/* Message */}
        <p className="text-lg text-gray-600 mb-6">
          Unable to connect to the database. This is usually caused by browser
          ad blockers or privacy extensions.
        </p>

        {/* Steps */}
        <div className="bg-blue-50 rounded-lg p-6 mb-6 text-left">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            How to Fix This:
          </h3>
          <ol className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="font-bold shrink-0">1.</span>
              <span>Disable your ad blocker for this website</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold shrink-0">2.</span>
              <span>Add this site to your ad blocker's whitelist</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold shrink-0">3.</span>
              <span>
                Disable privacy extensions (Privacy Badger, Ghostery, etc.)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold shrink-0">4.</span>
              <span>Try using a different browser or incognito mode</span>
            </li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onRetry}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg"
          >
            <RefreshCw className="w-5 h-5" />
            Retry Connection
          </button>
          <button
            onClick={handleDisableAdBlocker}
            className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            How to Disable Ad Blocker
          </button>
        </div>

        {/* Additional Help */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            If the problem persists after disabling ad blockers, please contact
            your system administrator or try accessing the site from a different
            network.
          </p>
        </div>
      </div>
    </div>
  );
}

