export function getAppBaseUrl() {
  const configuredBaseUrl = String(import.meta.env.VITE_APP_BASE_URL || "").trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  const currentOrigin = window.location.origin;
  const isLocalhost =
    currentOrigin.includes("localhost") || currentOrigin.includes("127.0.0.1");

  if (!isLocalhost) {
    return currentOrigin;
  }

  const authDomain = String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "").trim();
  if (authDomain) {
    return `https://${authDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }

  return currentOrigin;
}
